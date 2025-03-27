/**
 * web-request-interceptor.js
 * 使用 Chrome 的 webRequest API 監控網路請求，用於攔截語音訊息的下載 URL
 */

import {
  extractDurationFromContentDisposition,
  extractDurationFromUrl,
} from "../voice-detector/extractDurationFunctions.js";
import { registerDownloadUrl } from "../voice-detector/data-store.js";

// 語音訊息 URL 的匹配模式
const VOICE_MESSAGE_URL_PATTERNS = [
  // 全域的匹配模式，捕捉所有請求
  "*://*.facebook.com/*",
  "*://*.fbcdn.net/*",
  "*://*.messenger.com/*",
  "*://*.cdninstagram.com/*", // 新增 Instagram CDN
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
  "attachment",
  "clip",
  "message",
  "media",
];

/**
 * 初始化 webRequest 攔截器
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function initWebRequestInterceptor(voiceMessages) {
  console.log("[DEBUG-BACKGROUND] 初始化 webRequest 攔截器");

  // 記錄初始化時間，用於調試
  const initTime = new Date().toISOString();
  console.log(`[DEBUG-WEBREQUEST] 攔截器初始化時間: ${initTime}`);

  // 監聽完成的請求
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      handleCompletedRequest(voiceMessages, details);
    },
    { urls: VOICE_MESSAGE_URL_PATTERNS },
    ["responseHeaders"]
  );

  // 監聽請求頭，用於獲取更多資訊
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
      handleHeadersReceived(voiceMessages, details);
    },
    { urls: VOICE_MESSAGE_URL_PATTERNS },
    ["responseHeaders"]
  );

  // 監聽所有請求，用於調試
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      // 只調試記錄 GET 請求
      if (details.method === "GET") {
        const url = details.url;

        // 檢查是否可能是音訊檔案
        const isPossibleAudio = AUDIO_KEYWORDS.some((keyword) =>
          url.includes(keyword)
        );

        // 檢查是否是 XHR 或 fetch 請求
        const isXhrOrFetch =
          details.type === "xmlhttprequest" || details.type === "fetch";

        // 檢查是否是媒體請求
        const isMedia = details.type === "media" || details.type === "object";

        // 判斷是否應該記錄此請求
        const shouldLog =
          isPossibleAudio || isMedia || (isXhrOrFetch && Math.random() < 0.1);

        if (shouldLog) {
          console.log("[DEBUG-WEBREQUEST-ALL] 攔截到請求:", {
            url: url.substring(0, 150) + "...",
            type: details.type,
            method: details.method,
            tabId: details.tabId,
            frameId: details.frameId,
            isPossibleAudio,
            isXhrOrFetch,
            isMedia,
            timestamp: new Date().toISOString(),
          });
        }
      }
      return { cancel: false };
    },
    {
      urls: [
        "*://*.facebook.com/*",
        "*://*.fbcdn.net/*",
        "*://*.messenger.com/*",
        "*://*.cdninstagram.com/*",
      ],
    }
  );

  // 監聽請求頭發送
  chrome.webRequest.onSendHeaders.addListener(
    (details) => {
      if (details.method === "GET") {
        const url = details.url;
        const isPossibleAudio = AUDIO_KEYWORDS.some((keyword) =>
          url.includes(keyword)
        );

        if (isPossibleAudio) {
          console.log("[DEBUG-WEBREQUEST-SEND-HEADERS] 發送請求頭:", {
            url: url.substring(0, 100) + "...",
            headers: details.requestHeaders
              ?.map((h) => `${h.name}: ${h.value?.substring(0, 50)}`)
              .join("\n"),
            timestamp: new Date().toISOString(),
          });
        }
      }
      return { requestHeaders: details.requestHeaders };
    },
    { urls: VOICE_MESSAGE_URL_PATTERNS },
    ["requestHeaders"]
  );

  // 監聽內容腳本的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "contentScriptInitialized") {
      console.log("[DEBUG-BACKGROUND] 收到內容腳本初始化訊息:", {
        url: message.url,
        tabId: sender.tab?.id,
      });
      sendResponse({ success: true });
    }
    return true;
  });

  console.log(
    "[DEBUG-BACKGROUND] webRequest 攔截器已初始化，監聽以下 URL 模式:",
    VOICE_MESSAGE_URL_PATTERNS
  );
}

/**
 * 處理已完成的請求
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} details - 請求詳情
 */
function handleCompletedRequest(voiceMessages, details) {
  try {
    const url = details.url;

    // 檢查是否可能是語音訊息請求
    const isPossibleAudio =
      url.includes(".mp4") ||
      url.includes(".mp3") ||
      url.includes(".aac") ||
      url.includes(".m4a") ||
      url.includes("/audioclip-") ||
      (url.includes("fbcdn.net") && url.includes("/v/t")) ||
      (url.includes("fbcdn.net") && url.includes("/o1/v/t2/f2/m69/"));

    if (isPossibleAudio) {
      console.log("[DEBUG-WEBREQUEST] 偵測到可能的語音訊息請求:", {
        url: details.url.substring(0, 150) + "...",
        type: details.type,
        statusCode: details.statusCode,
        method: details.method,
        tabId: details.tabId,
        frameId: details.frameId,
        timeStamp: details.timeStamp,
      });
    } else {
      // 如果不是可能的語音訊息，直接返回
      return;
    }

    // 只處理成功的 GET 請求
    if (details.method !== "GET" || details.statusCode !== 200) {
      return;
    }

    // 從 URL 和標頭中提取資訊
    let durationMs = null;
    let lastModified = null;
    let contentType = null;
    let contentLength = null;

    // 從回應標頭中提取資訊
    if (details.responseHeaders) {
      for (const header of details.responseHeaders) {
        const headerName = header.name.toLowerCase();
        if (headerName === "content-disposition") {
          durationMs = extractDurationFromContentDisposition(header.value);
          console.log(
            "[DEBUG-WEBREQUEST] 從 content-disposition 提取持續時間:",
            {
              header: header.value,
              durationMs,
            }
          );
        } else if (headerName === "last-modified") {
          lastModified = header.value;
        } else if (headerName === "content-type") {
          contentType = header.value;
        } else if (headerName === "content-length") {
          contentLength = header.value;
        }
      }
    }

    // 如果無法從標頭中提取持續時間，嘗試從 URL 提取
    if (!durationMs) {
      durationMs = extractDurationFromUrl(url);
      if (durationMs) {
        console.log("[DEBUG-WEBREQUEST] 從 URL 提取持續時間:", {
          url: url.substring(0, 100),
          durationMs,
        });
      }
    }

    // 如果找到持續時間，註冊下載 URL
    if (durationMs) {
      console.log("[DEBUG-WEBREQUEST] 找到語音訊息下載 URL:", {
        url: url.substring(0, 100) + "...",
        durationMs,
        lastModified,
        contentType,
        contentLength,
      });

      registerDownloadUrl(voiceMessages, durationMs, url, lastModified);
    } else if (contentLength && isPossibleAudio) {
      // 如果無法提取持續時間，但確定是音訊檔案，嘗試使用檔案大小估計
      const fileSizeBytes = parseInt(contentLength, 10);
      if (!isNaN(fileSizeBytes)) {
        // 根據檔案大小估計持續時間（毫秒）
        // 公式：持續時間 = 檔案大小（位元） / 比特率（每秒位元）
        // 假設平均比特率為 32 kbps
        const estimatedDurationMs = Math.round(
          ((fileSizeBytes * 8) / (32 * 1024)) * 1000
        );

        console.log("[DEBUG-WEBREQUEST] 根據檔案大小估計持續時間:", {
          url: url.substring(0, 100) + "...",
          fileSizeBytes,
          estimatedDurationMs,
          contentType,
        });

        // 使用估計的持續時間註冊 URL
        registerDownloadUrl(
          voiceMessages,
          estimatedDurationMs,
          url,
          lastModified
        );
      }
    }
  } catch (error) {
    console.error("[DEBUG-WEBREQUEST] 處理請求時發生錯誤:", error);
  }
}

/**
 * 處理接收到的標頭
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} details - 請求詳情
 */
function handleHeadersReceived(voiceMessages, details) {
  try {
    const url = details.url;
    // 檢查是否可能是音訊檔案
    const isPossibleAudio = AUDIO_KEYWORDS.some((keyword) =>
      url.includes(keyword)
    );

    // 從標頭中提取內容類型和內容長度
    let contentType = null;
    let contentLength = null;
    let contentDisposition = null;
    let allHeaders = [];

    if (details.responseHeaders) {
      // 收集所有標頭用於調試
      allHeaders = details.responseHeaders.map((h) => `${h.name}: ${h.value}`);

      for (const header of details.responseHeaders) {
        const headerName = header.name.toLowerCase();
        if (headerName === "content-type") {
          contentType = header.value;
        } else if (headerName === "content-length") {
          contentLength = header.value;
        } else if (headerName === "content-disposition") {
          contentDisposition = header.value;
        }
      }
    }

    // 記錄所有可能的音訊檔案的標頭
    if (
      isPossibleAudio ||
      (contentType &&
        (contentType.includes("audio") || contentType.includes("video")))
    ) {
      console.log("[DEBUG-WEBREQUEST-HEADERS] 收到回應標頭:", {
        url: url.substring(0, 100) + "...",
        contentType,
        contentLength,
        contentDisposition,
        allHeaders: allHeaders.join("\n"),
        timestamp: new Date().toISOString(),
      });
    }

    // 檢查是否為音訊檔案
    const isAudioFile =
      contentType &&
      (contentType.includes("audio/") ||
        contentType.includes("video/") ||
        contentType.includes("application/octet-stream"));

    // 檢查是否是媒體請求
    const isMedia = details.type === "media" || details.type === "object";

    // 檢查 URL 是否包含音訊相關關鍵字
    const hasAudioKeywords = AUDIO_KEYWORDS.some((keyword) =>
      details.url.includes(keyword)
    );

    if (isAudioFile || isMedia || hasAudioKeywords) {
      console.log("[DEBUG-WEBREQUEST] 偵測到可能的音訊檔案:", {
        url: details.url.substring(0, 100) + "...",
        contentType,
        contentLength,
        isAudioFile,
        isMedia,
        hasAudioKeywords,
        timestamp: new Date().toISOString(),
      });

      // 如果沒有從其他方法獲取到持續時間，可以嘗試從檔案大小估計
      if (contentLength) {
        const fileSizeBytes = parseInt(contentLength, 10);
        if (!isNaN(fileSizeBytes)) {
          // 根據檔案大小估計持續時間（毫秒）
          // 公式：持續時間 = 檔案大小（位元） / 比特率（每秒位元）
          // 假設平均比特率為 32 kbps
          const estimatedDurationMs = Math.round(
            ((fileSizeBytes * 8) / (32 * 1024)) * 1000
          );

          console.log("[DEBUG-WEBREQUEST] 根據檔案大小估計的持續時間:", {
            fileSizeBytes,
            estimatedDurationMs,
          });
        }
      }
    }
  } catch (error) {
    console.error("[DEBUG-WEBREQUEST] 處理標頭時發生錯誤:", error);
  }
}
