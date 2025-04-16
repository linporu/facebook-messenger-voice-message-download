/**
 * web-request-interceptor.js
 * 使用 Chrome 的 webRequest API 監控網路請求，用於攔截語音訊息的下載 URL
 */

import {
  extractDurationFromContentDisposition,
  extractDurationFromUrl,
  isLikelyAudioFile,
} from "../audio/extractDurationFunctions.js";
import { registerDownloadUrl } from "../background/data-store.js";
import { Logger } from "../utils/logger.js";
import {
  SUPPORTED_SITES,
  BLOB_MONITOR_CONSTANTS,
  MODULE_NAMES,
  WEB_REQUEST_CONSTANTS,
  VOICE_MESSAGE_URL_PATTERNS,
} from "../utils/constants.js";

const logger = Logger.createModuleLogger(MODULE_NAMES.WEB_REQUEST);

// ================================================
// 公開函數
// ================================================

/**
 * 初始化 webRequest 攔截器
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function initWebRequestInterceptor(voiceMessages) {
  try {
    logger.debug("初始化 webRequest 攔截器");

    // 檢查 WebRequest API 是否可用
    if (!chrome || !chrome.webRequest) {
      logger.error("chrome.webRequest API 不可用");
      return;
    }

    // 設置網路請求監聽器
    setupWebRequestListeners(voiceMessages);

    logger.info("webRequest 攔截器已初始化", {
      patterns: VOICE_MESSAGE_URL_PATTERNS,
    });
  } catch (error) {
    logger.error("初始化 webRequest 攔截器時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// ================================================
// 監聽器初始化
// ================================================

/**
 * 設置網路請求監聽器
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
function setupWebRequestListeners(voiceMessages) {
  // 監聽已接收標頭的請求 - 主要用於早期識別
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => handleRequest(voiceMessages, details),
    { urls: VOICE_MESSAGE_URL_PATTERNS },
    ["responseHeaders"]
  );

  // 監聽完成的請求 - 確保所有數據都已接收
  chrome.webRequest.onCompleted.addListener(
    (details) => handleRequest(voiceMessages, details),
    { urls: VOICE_MESSAGE_URL_PATTERNS },
    ["responseHeaders"]
  );
}

// ================================================
// 請求處理函數
// ================================================

/**
 * 處理網路請求
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} details - 請求詳情
 */
function handleRequest(voiceMessages, details) {
  try {
    const { url, method, statusCode, responseHeaders } = details;

    // 提取基本標頭資訊
    const metadata = extractMetadata(responseHeaders);

    // 判斷是否為語音訊息
    if (!isVoiceMessage(url, method, statusCode, metadata)) {
      return;
    }

    logger.debug("偵測到潛在語音訊息請求", {
      url: url.substring(0, 100) + "...",
      type: details.type,
      statusCode: statusCode,
      method: method,
    });

    // 完成元數據提取（增加持續時間等資訊）
    const durationMS = getDuration(metadata, url);

    if (durationMS) {
      logger.info("處理語音訊息檔案", {
        url: url.substring(0, 100) + "...",
        durationMs: durationMS,
        contentType: metadata.contentType,
        contentLength: metadata.contentLength,
      });

      // 註冊下載 URL
      const id = registerDownloadUrl(
        voiceMessages,
        durationMS,
        url,
        metadata.lastModified
      );

      logger.debug("註冊下載 URL 完成", { id });
    }
  } catch (error) {
    logger.error("處理請求時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// ================================================
// URL 檢測函數
// ================================================

/**
 * 判斷請求是否為語音訊息
 * @param {string} url - 請求 URL
 * @param {string} method - HTTP 方法
 * @param {number} statusCode - HTTP 狀態碼
 * @param {Object} metadata - 選擇性，請求的元數據
 * @returns {boolean} - 是否為語音訊息
 */
function isVoiceMessage(url, method, statusCode, metadata = null) {
  // 1. 基本檢查：URL 存在、為 GET 請求、狀態碼表示成功
  if (!url || method !== "GET") return false;

  if (
    statusCode &&
    !WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES.includes(statusCode)
  ) {
    return false;
  }

  // 2. URL 模式檢查
  const hasAudioKeyword = WEB_REQUEST_CONSTANTS.AUDIO_KEYWORDS.some((keyword) =>
    url.includes(keyword)
  );

  const isFromKnownCdn = SUPPORTED_SITES.CDN_PATTERNS.some((pattern) => {
    const domain = pattern.replace("*://*.", "").replace("/*", "");
    return url.includes(domain);
  });

  if (!hasAudioKeyword && !isFromKnownCdn) return false;

  // 3. 若有提供元數據，進行額外檢查
  if (metadata) {
    // 檢查內容類型是否為音訊
    if (metadata.contentType && !isLikelyAudioFile(metadata.contentType, url)) {
      return false;
    }

    // 檢查檔案大小是否在合理範圍內
    if (metadata.contentLength) {
      const fileSizeBytes = parseInt(metadata.contentLength, 10);
      if (
        !isNaN(fileSizeBytes) &&
        (fileSizeBytes < BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE ||
          fileSizeBytes > BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE)
      ) {
        return false;
      }
    }
  }

  return true;
}

// ================================================
// 元數據提取函數
// ================================================

/**
 * 從請求標頭中提取基本資訊
 * @param {Array} responseHeaders - 回應標頭陣列
 * @returns {Object} - 提取的基本元數據
 */
function extractMetadata(responseHeaders) {
  const metadata = {
    lastModified: null,
    contentType: null,
    contentLength: null,
    contentDisposition: null,
  };

  if (!responseHeaders) return metadata;

  // 從標頭中提取資訊
  for (const header of responseHeaders) {
    const headerName = header.name.toLowerCase();
    const headerValue = header.value;

    switch (headerName) {
      case "content-disposition":
        metadata.contentDisposition = headerValue;
        break;
      case "last-modified":
        metadata.lastModified = headerValue;
        break;
      case "content-type":
        metadata.contentType = headerValue;
        break;
      case "content-length":
        metadata.contentLength = headerValue;
        break;
    }
  }

  return metadata;
}

/**
 * 嘗試獲取音訊持續時間
 * @param {Object} metadata - 基本元數據
 * @param {string} url - 檔案 URL
 * @returns {number|null} - 持續時間（毫秒）或 null
 */
function getDuration(metadata, url) {
  // 1. 嘗試從 content-disposition 提取
  if (metadata.contentDisposition) {
    const duration = extractDurationFromContentDisposition(
      metadata.contentDisposition
    );
    if (duration) return duration;
  }

  // 2. 嘗試從 URL 提取
  const urlDuration = extractDurationFromUrl(url);
  if (urlDuration) return urlDuration;

  // 3. 嘗試從檔案大小估算
  if (metadata.contentLength && isLikelyAudioFile(metadata.contentType, url)) {
    const fileSizeBytes = parseInt(metadata.contentLength, 10);
    if (isNaN(fileSizeBytes)) return null;

    // 檢查檔案大小是否在合理範圍內
    if (
      fileSizeBytes < BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE ||
      fileSizeBytes > BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE
    ) {
      return null;
    }

    // 估計持續時間：檔案大小（位元）/ 比特率（每秒位元）
    let estimatedDuration = Math.round(
      ((fileSizeBytes * 8) /
        (WEB_REQUEST_CONSTANTS.AVERAGE_AUDIO_BITRATE * 1024)) *
        1000
    );

    // 確保持續時間在有效範圍內
    estimatedDuration = Math.max(
      estimatedDuration,
      BLOB_MONITOR_CONSTANTS.MIN_VALID_DURATION
    );
    estimatedDuration = Math.min(
      estimatedDuration,
      BLOB_MONITOR_CONSTANTS.MAX_VALID_DURATION
    );

    metadata.isDurationEstimated = true;
    return estimatedDuration;
  }

  return null;
}
