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

// ================================================
// 常數與配置
// ================================================

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.WEB_REQUEST);

// ================================================
// URL 檢測函數
// ================================================

/**
 * 檢查 URL 是否可能包含語音訊息
 * @param {string} url - 要檢查的 URL
 * @returns {boolean} - 是否可能是語音訊息
 */
function isPotentialVoiceMessageUrl(url) {
  if (!url) return false;

  // 檢查 URL 是否包含任何已知音訊關鍵字
  return (
    WEB_REQUEST_CONSTANTS.AUDIO_KEYWORDS.some((keyword) =>
      url.includes(keyword)
    ) ||
    // 檢查是否來自已知的 Facebook 的安全瀏覽擴展域名
    SUPPORTED_SITES.CDN_PATTERNS.some((pattern) => {
      const domain = pattern.replace("*://*.", "").replace("/*", "");
      return url.includes(domain);
    })
  );
}

/**
 * 判斷請求是否為有效的語音訊息候選項
 * @param {string} url - 請求 URL
 * @param {string} method - HTTP 方法
 * @param {number} statusCode - HTTP 狀態碼
 * @returns {boolean} - 是否為有效的候選項
 */
function isVoiceMessageCandidate(url, method, statusCode) {
  // 快速篩選
  if (!isPotentialVoiceMessageUrl(url)) return false;

  // 只處理 GET 請求
  if (method !== "GET") return false;

  // 如果提供了狀態碼，檢查是否為成功狀態
  if (
    statusCode &&
    !WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES.includes(statusCode)
  ) {
    return false;
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
function extractBasicHeaderInfo(responseHeaders) {
  const metadata = {
    durationMs: null,
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

/**
 * 從請求標頭中提取音訊相關元數據
 * @param {Array} responseHeaders - 回應標頭陣列
 * @param {string} url - 請求 URL
 * @returns {Object} - 提取的元數據
 */
function extractAudioMetadata(responseHeaders, url) {
  // 提取基本標頭資訊
  const metadata = extractBasicHeaderInfo(responseHeaders);

  // 嘗試獲取持續時間
  metadata.durationMs = getDuration(metadata, url);

  return metadata;
}

// ================================================
// 註冊與處理函數
// ================================================

/**
 * 處理和註冊音訊檔案
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} metadata - 音訊元數據
 * @param {string} url - 檔案 URL
 * @returns {string|null} - 註冊的 ID 或 null
 */
function processAndRegisterAudio(voiceMessages, metadata, url) {
  if (!metadata.durationMs) {
    logger.debug("無法確定音訊持續時間，跳過處理", {
      url: url.substring(0, 100) + "...",
    });
    return null;
  }

  logger.info("處理語音訊息檔案", {
    url: url.substring(0, 100) + "...",
    durationMs: metadata.durationMs,
    isDurationEstimated: metadata.isDurationEstimated || false,
    contentType: metadata.contentType,
    contentLength: metadata.contentLength,
  });

  // 註冊下載 URL
  const id = registerDownloadUrl(
    voiceMessages,
    metadata.durationMs,
    url,
    metadata.lastModified
  );

  logger.debug("註冊下載 URL 完成", { id });
  return id;
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

    // 判斷是否為有效的語音訊息候選項
    if (!isVoiceMessageCandidate(url, method, statusCode)) {
      return;
    }

    logger.debug("偵測到潛在語音訊息請求", {
      url: url.substring(0, 100) + "...",
      type: details.type,
      statusCode: statusCode,
      method: method,
    });

    // 提取音訊元數據
    const metadata = extractAudioMetadata(responseHeaders, url);

    // 處理和註冊
    processAndRegisterAudio(voiceMessages, metadata, url);
  } catch (error) {
    logger.error("處理請求時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// ================================================
// 訊息處理函數
// ================================================

/**
 * 處理內容腳本初始化訊息
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 * @returns {Object} - 處理結果
 */
function handleContentScriptInit(message, sender) {
  logger.debug("收到內容腳本初始化訊息", {
    url: message.url,
    tabId: sender.tab?.id,
  });
  return { success: true };
}

/**
 * 統一訊息處理路由
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 */
function handleMessage(voiceMessages, message, sender, sendResponse) {
  try {
    let response;

    switch (message.action) {
      case "contentScriptInitialized":
        response = handleContentScriptInit(message, sender);
        break;

      default:
        // 忽略未知訊息
        response = { success: false, error: "未知的訊息類型" };
        break;
    }

    sendResponse(response);
  } catch (error) {
    logger.error("處理訊息時發生錯誤", {
      action: message.action,
      error: error.message,
    });
    sendResponse({ success: false, error: error.message });
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

/**
 * 設置訊息監聽器
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
function setupMessageListeners(voiceMessages) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(voiceMessages, message, sender, sendResponse);
    return true; // 保持訊息通道開啟以進行非同步回應
  });
}

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

    // 設置訊息監聽器
    setupMessageListeners(voiceMessages);

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
