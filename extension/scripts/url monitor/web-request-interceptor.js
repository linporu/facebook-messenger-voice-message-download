/**
 * web-request-interceptor.js
 * 使用 Chrome 的 webRequest API 監控網路請求，用於攔截語音訊息的下載 URL
 */

import { isLikelyVoiceMessage } from "./audio-analyzer.js";
import { Logger } from "../utils/logger.js";
import {
  MODULE_NAMES,
  VOICE_MESSAGE_URL_PATTERNS,
  MESSAGE_ACTIONS,
  SUPPORTED_SITES,
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

    // 提取 metadata
    const metadata = getMetadata(responseHeaders);

    // 判斷是否可能為語音訊息
    if (!isLikelyVoiceMessage(url, method, statusCode, metadata)) {
      return;
    }

    logger.debug("偵測到語音訊息請求", {
      url: url.substring(0, 100) + "...",
      type: details.type,
      statusCode: statusCode,
      method: method,
    });

    // 向所有可能的標籤頁發送訊息，請求計算音訊持續時間
    broadcastToContentScripts({
      action: MESSAGE_ACTIONS.GET_AUDIO_DURATION,
      url: url,
      metadata: {
        contentType: metadata.contentType,
        contentLength: metadata.contentLength,
        lastModified: metadata.lastModified,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("處理請求時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// ================================================
// Metadata 提取函數
// ================================================

/**
 * 從請求標頭中提取 metadata
 * @param {Array} responseHeaders - 回應標頭陣列
 * @returns {Object} - 提取 metadata
 */
function getMetadata(responseHeaders) {
  const metadata = {
    contentDisposition: null,
    contentType: null,
    contentLength: null,
    lastModified: null,
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
      case "content-type":
        metadata.contentType = headerValue;
        break;
      case "content-length":
        metadata.contentLength = headerValue;
        break;
      case "last-modified":
        metadata.lastModified = headerValue;
        break;
    }
  }
  return metadata;
}

// ================================================
// 向內容腳本廣播訊息函數
// ================================================

/**
 * 向所有標籤頁廣播訊息
 * @param {Object} message - 要發送的訊息
 */
function broadcastToContentScripts(message) {
  chrome.tabs.query({ url: SUPPORTED_SITES.PATTERNS }, (tabs) => {
    logger.debug(`向 ${tabs.length} 個標籤頁廣播訊息`, { message });

    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          logger.debug(`向標籤頁 ${tab.id} 發送訊息失敗`, {
            error: chrome.runtime.lastError.message,
          });
        } else if (response && response.success) {
          logger.debug(`標籤頁 ${tab.id} 已接收訊息`, {
            responseData: response,
          });
        }
      });
    }
  });
}
