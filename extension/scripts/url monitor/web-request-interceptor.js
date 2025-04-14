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

// ================================================
// 常數與配置
// ================================================

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("web-request-interceptor");

// 語音訊息 URL 的匹配模式
const VOICE_MESSAGE_URL_PATTERNS = [
  "*://*.facebook.com/*",
  "*://*.fbcdn.net/*",
  "*://*.messenger.com/*",
  "*://*.cdninstagram.com/*", // Instagram CDN
  "*://*.fbsbx.com/*", // Facebook 安全瀏覽擴展域名
];

// 可能的音訊檔案關鍵字
const AUDIO_KEYWORDS = [
  ".mp4",
  ".mp3",
  ".aac",
  ".m4a",
  "/audioclip-",
  "audio",
  "voice",
  "sound",
  "/v/t",
  "/o1/v/t2/f2/m69/",
  "/o1/v/t62/", // 新的 Facebook 語音訊息格式
  "/o2/v/", // 另一種可能的格式
  "attachment",
  "clip",
  "message",
  "media",
];

// 平均音訊比特率（kbps）- 用於估計持續時間
const AVERAGE_AUDIO_BITRATE = 32; // 32kbps

// 成功的 HTTP 狀態碼
const SUCCESS_STATUS_CODES = [200, 206]; // OK, Partial Content

// ================================================
// 公用輔助函數
// ================================================

/**
 * 檢查 URL 是否可能包含語音訊息
 * @param {string} url - 要檢查的 URL
 * @returns {boolean} - 是否可能是語音訊息
 */
function isPotentialVoiceMessageUrl(url) {
  if (!url) return false;

  return (
    url.includes(".mp4") ||
    url.includes("audio") ||
    url.includes("voice") ||
    url.includes("fbsbx.com") ||
    AUDIO_KEYWORDS.some((keyword) => url.includes(keyword))
  );
}

/**
 * 從請求標頭中提取音訊相關元數據
 * @param {Array} responseHeaders - 回應標頭陣列
 * @param {string} url - 請求 URL
 * @returns {Object} - 提取的元數據
 */
function extractAudioMetadata(responseHeaders, url) {
  const metadata = {
    durationMs: null,
    lastModified: null,
    contentType: null,
    contentLength: null,
    contentDisposition: null,
  };

  // 從標頭中提取資訊
  if (responseHeaders) {
    for (const header of responseHeaders) {
      const headerName = header.name.toLowerCase();
      const headerValue = header.value;

      switch (headerName) {
        case "content-disposition":
          metadata.contentDisposition = headerValue;
          metadata.durationMs =
            extractDurationFromContentDisposition(headerValue);
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
  }

  // 如果無法從標頭中提取持續時間，嘗試從 URL 提取
  if (!metadata.durationMs) {
    metadata.durationMs = extractDurationFromUrl(url);
  }

  // 如果仍然無法提取持續時間，但有檔案大小，則估計持續時間
  if (
    !metadata.durationMs &&
    metadata.contentLength &&
    isLikelyAudioFile(metadata.contentType, url)
  ) {
    const fileSizeBytes = parseInt(metadata.contentLength, 10);
    if (!isNaN(fileSizeBytes)) {
      // 估計持續時間：檔案大小（位元）/ 比特率（每秒位元）
      metadata.durationMs = Math.round(
        ((fileSizeBytes * 8) / (AVERAGE_AUDIO_BITRATE * 1024)) * 1000
      );
      metadata.isDurationEstimated = true;
    }
  }

  return metadata;
}

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
 * 處理已完成的請求
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} details - 請求詳情
 */
function handleCompletedRequest(voiceMessages, details) {
  try {
    const { url, method, statusCode, responseHeaders, type } = details;

    // 快速過濾非相關請求
    if (!isPotentialVoiceMessageUrl(url)) {
      return;
    }

    logger.debug("偵測到潛在語音訊息請求", {
      url: url.substring(0, 100) + "...",
      type: type,
      statusCode: statusCode,
      method: method,
    });

    // 只處理成功的 GET 請求
    if (method !== "GET" || !SUCCESS_STATUS_CODES.includes(statusCode)) {
      logger.debug("跳過非 GET 或非成功狀態的請求", { method, statusCode });
      return;
    }

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

/**
 * 處理接收到的標頭
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} details - 請求詳情
 */
function handleHeadersReceived(voiceMessages, details) {
  try {
    const { url, responseHeaders } = details;

    // 快速過濾非相關請求
    if (!isPotentialVoiceMessageUrl(url)) {
      return;
    }

    // 提取音訊元數據
    const metadata = extractAudioMetadata(responseHeaders, url);

    // 只記錄確定是語音訊息的項目
    if (
      metadata.contentDisposition &&
      metadata.contentDisposition.includes("audioclip")
    ) {
      logger.debug("偵測到語音訊息檔案標頭", {
        url: url.substring(0, 100) + "...",
        contentType: metadata.contentType,
        contentLength: metadata.contentLength,
        durationMs: metadata.durationMs,
        isDurationEstimated: metadata.isDurationEstimated || false,
      });
    }
  } catch (error) {
    logger.error("處理標頭時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * 處理 blob URL 訊息
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 */
function handleBlobUrlMessage(voiceMessages, message, sender) {
  try {
    const { blobUrl, blobType, blobSize, timestamp, durationMs } = message;

    // 檢查是否為音訊/視頻 blob
    const isAudioOrVideo =
      blobType &&
      (blobType.includes("audio") ||
        blobType.includes("video") ||
        blobType.includes("mp4"));

    if (!isAudioOrVideo) {
      logger.debug("跳過非音訊/視頻的 blob", { blobType });
      return;
    }

    logger.debug("偵測到音訊相關的 blob URL", {
      blobType,
      blobSize,
      tabId: sender.tab?.id,
    });

    // 註冊 Blob URL
    const id = registerDownloadUrl(
      voiceMessages,
      durationMs,
      blobUrl,
      null // 沒有 lastModified 資訊
    );

    logger.debug("成功註冊 Blob URL", { id, durationMs });
    logger.info(
      "注意：Blob URL 已存儲，但不會自動下載。用戶需要右鍵點擊才會下載。"
    );
  } catch (error) {
    logger.error("處理 blob URL 訊息時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// ================================================
// 訊息處理器
// ================================================

/**
 * 設置訊息監聽器，處理內容腳本的訊息
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
function setupMessageListeners(voiceMessages) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      switch (message.action) {
        case "contentScriptInitialized":
          logger.debug("收到內容腳本初始化訊息", {
            url: message.url,
            tabId: sender.tab?.id,
          });
          sendResponse({ success: true });
          break;

        case "blobUrlDetected":
          logger.debug("收到 blob URL 偵測訊息", {
            blobType: message.blobType,
            blobSize: message.blobSize,
            timestamp: message.timestamp,
            tabId: sender.tab?.id,
          });

          handleBlobUrlMessage(voiceMessages, message, sender);
          sendResponse({ success: true, message: "Blob URL 已接收" });
          break;

        default:
          // 忽略未知訊息
          break;
      }
    } catch (error) {
      logger.error("處理訊息時發生錯誤", {
        action: message.action,
        error: error.message,
      });
      sendResponse({ success: false, error: error.message });
    }

    return true; // 保持訊息通道開啟以進行非同步回應
  });
}

// ================================================
// 監聽器初始化
// ================================================

/**
 * 設置網路請求監聽器
 */
function setupWebRequestListeners(voiceMessages) {
  // 監聽完成的請求
  chrome.webRequest.onCompleted.addListener(
    (details) => handleCompletedRequest(voiceMessages, details),
    { urls: VOICE_MESSAGE_URL_PATTERNS },
    ["responseHeaders"]
  );

  // 監聽請求頭
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => handleHeadersReceived(voiceMessages, details),
    { urls: VOICE_MESSAGE_URL_PATTERNS },
    ["responseHeaders"]
  );

  // 監聽所有請求（用於早期偵測）
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      // 只處理 GET 請求
      if (details.method === "GET") {
        const url = details.url;

        // 記錄可能的語音訊息請求
        if (isPotentialVoiceMessageUrl(url)) {
          logger.debug("提前偵測到可能的語音訊息請求", {
            url: url.substring(0, 100) + "...",
            type: details.type,
          });
        }
      }
      return { cancel: false };
    },
    { urls: VOICE_MESSAGE_URL_PATTERNS }
  );

  // 監聽請求頭發送（最小化處理，僅保留功能）
  chrome.webRequest.onSendHeaders.addListener(
    (details) => ({ requestHeaders: details.requestHeaders }),
    { urls: VOICE_MESSAGE_URL_PATTERNS },
    ["requestHeaders"]
  );
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

    // 記錄初始化時間，用於調試
    const initTime = new Date().toISOString();
    logger.debug("攔截器初始化時間", { time: initTime });

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

/**
 * 處理 blob URL 訊息 - 向後兼容的公開函數
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 */
export function setupBlobUrlMessageListener(voiceMessages, message, sender) {
  handleBlobUrlMessage(voiceMessages, message, sender);
}
