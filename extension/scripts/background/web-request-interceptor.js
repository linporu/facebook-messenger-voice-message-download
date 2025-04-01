/**
 * web-request-interceptor.js
 * 使用 Chrome 的 webRequest API 監控網路請求，用於攔截語音訊息的下載 URL
 */

// 添加調試資訊
console.log("[DEBUG-WEBREQUEST] 開始導入 extractDurationFunctions.js");

import {
  extractDurationFromContentDisposition,
  extractDurationFromUrl,
  isLikelyAudioFile,
} from "../voice-detector/extractDurationFunctions.js";

console.log("[DEBUG-WEBREQUEST] 導入 extractDurationFunctions.js 成功");
import { registerDownloadUrl } from "./data-store.js";

// 語音訊息 URL 的匹配模式
const VOICE_MESSAGE_URL_PATTERNS = [
  // 全域的匹配模式，捕捉所有請求
  "*://*.facebook.com/*",
  "*://*.fbcdn.net/*",
  "*://*.messenger.com/*",
  "*://*.cdninstagram.com/*", // Instagram CDN
  "*://*.fbsbx.com/*", // Facebook 安全瀏覽擴展域名
  "*://*.fna.fbcdn.net/*", // Facebook 內容傳送網路的另一個域名
  "*://*.fna.whatsapp.net/*", // WhatsApp 相關的域名，有時會用於 Facebook 訊息
];

// 高優先級的 URL 模式，用於更精確地匹配語音訊息
const HIGH_PRIORITY_URL_PATTERNS = [
  "*://*.facebook.com/*/audioclip-*",
  "*://*.fbcdn.net/*/audioclip-*",
  "*://*.messenger.com/*/audioclip-*",
  "*://*.fbcdn.net/*mp4*",
  "*://*.fbcdn.net/*/v/t*",
  "*://*.fbcdn.net/*/o1/v/t*",
  "*://*.fbcdn.net/*/o2/v/*",
  "*://*.fbsbx.com/*/audioclip-*",
  "*://*.fbsbx.com/*mp4*",
  "*://*.fna.fbcdn.net/*mp4*",
  "*://*.fna.fbcdn.net/*/v/t*",
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
  "fbid", // Facebook ID 參數，常出現在語音訊息 URL 中
  "bytestart", // 字節範圍參數，常用於分段下載
  "byteend", // 字節範圍參數
  "source", // 來源參數
  "oh", // Facebook 的一種參數
  "oe", // Facebook 的一種參數
];

/**
 * 初始化 webRequest 攔截器
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function initWebRequestInterceptor(voiceMessages) {
  try {
    console.log("[DEBUG-BACKGROUND] 初始化 webRequest 攔截器");
    console.log(
      "[DEBUG-WEBREQUEST] voiceMessages 參數:",
      voiceMessages ? "存在" : "不存在"
    );

    // 記錄初始化時間，用於調試
    const initTime = new Date().toISOString();
    console.log(`[DEBUG-WEBREQUEST] 攔截器初始化時間: ${initTime}`);

    if (!chrome || !chrome.webRequest) {
      console.error("[DEBUG-WEBREQUEST] chrome.webRequest API 不可用");
      return;
    }

    console.log("[DEBUG-WEBREQUEST] chrome.webRequest API 可用");

    // 監聽完成的請求，先設置高優先級的監聽器
    console.log("[DEBUG-WEBREQUEST] 設置高優先級 onCompleted 監聽器");
    chrome.webRequest.onCompleted.addListener(
      (details) => {
        console.log(
          "[DEBUG-WEBREQUEST] 收到高優先級請求:",
          details.url.substring(0, 100)
        );
        handleCompletedRequest(voiceMessages, details, true); // 指定為高優先級
      },
      { urls: HIGH_PRIORITY_URL_PATTERNS },
      ["responseHeaders"]
    );
    console.log("[DEBUG-WEBREQUEST] 高優先級 onCompleted 監聽器設置完成");

    // 設置一般優先級的監聽器
    console.log("[DEBUG-WEBREQUEST] 設置一般 onCompleted 監聽器");
    chrome.webRequest.onCompleted.addListener(
      (details) => {
        handleCompletedRequest(voiceMessages, details, false); // 指定為一般優先級
      },
      { urls: VOICE_MESSAGE_URL_PATTERNS },
      ["responseHeaders"]
    );
    console.log("[DEBUG-WEBREQUEST] 一般 onCompleted 監聽器設置完成");

    // 監聽請求頭，先設置高優先級的監聽器
    console.log("[DEBUG-WEBREQUEST] 設置高優先級 onHeadersReceived 監聽器");
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        console.log(
          "[DEBUG-WEBREQUEST] 收到高優先級標頭:",
          details.url.substring(0, 100)
        );
        handleHeadersReceived(voiceMessages, details, true); // 指定為高優先級
      },
      { urls: HIGH_PRIORITY_URL_PATTERNS },
      ["responseHeaders"]
    );
    console.log("[DEBUG-WEBREQUEST] 高優先級 onHeadersReceived 監聽器設置完成");

    // 設置一般優先級的監聽器
    console.log("[DEBUG-WEBREQUEST] 設置一般 onHeadersReceived 監聽器");
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        handleHeadersReceived(voiceMessages, details, false); // 指定為一般優先級
      },
      { urls: VOICE_MESSAGE_URL_PATTERNS },
      ["responseHeaders"]
    );
    console.log("[DEBUG-WEBREQUEST] 一般 onHeadersReceived 監聽器設置完成");

    // 監聽所有請求，用於調試和攔截
    console.log("[DEBUG-WEBREQUEST] 設置 onBeforeRequest 監聽器");
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        // 只處理 GET 請求
        if (details.method === "GET") {
          const url = details.url;

          // 放寬過濾條件，記錄所有可能的語音訊息檔案
          if (
            url.includes(".mp4") ||
            url.includes("audio") ||
            url.includes("voice") ||
            url.includes("fbsbx.com")
          ) {
            console.log("[DEBUG-WEBREQUEST] 提前偵測到可能的語音訊息請求:", {
              url: url.substring(0, 150) + "...",
              type: details.type,
              method: details.method,
            });
          }
        }
        return { cancel: false };
      },
      {
        urls: VOICE_MESSAGE_URL_PATTERNS,
      }
    );
    console.log("[DEBUG-WEBREQUEST] onBeforeRequest 監聽器設置完成");

    // 監聽請求頭發送
    chrome.webRequest.onSendHeaders.addListener(
      (details) => {
        // 不輸出日誌，只處理請求
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
      } else if (message.action === "blobUrlDetected") {
        console.log("[DEBUG-WEBREQUEST] 收到 blob URL 偵測訊息:", {
          blobUrl: message.blobUrl,
          blobType: message.blobType,
          blobSize: message.blobSize,
          timestamp: message.timestamp,
          tabId: sender.tab?.id,
        });

        // 處理 blob URL
        setupBlobUrlMessageListener(voiceMessages, message, sender);
        sendResponse({ success: true, message: "Blob URL 已接收" });
      }
      return true;
    });

    console.log(
      "[DEBUG-BACKGROUND] webRequest 攔截器已初始化，監聽以下 URL 模式:",
      VOICE_MESSAGE_URL_PATTERNS
    );
  } catch (error) {
    console.error(
      "[DEBUG-WEBREQUEST] 初始化 webRequest 攔截器時發生錯誤:",
      error
    );
  }
}

/**
 * 處理 blob URL 訊息
 * 不再自動下載，而是將 blob URL 和 blobType 存儲到 voiceMessagesStore 中
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 */
export function setupBlobUrlMessageListener(voiceMessages, message, sender) {
  try {
    console.log("[DEBUG-WEBREQUEST] 設置 Blob URL 訊息監聽器");

    const { blobUrl, blobType, blobSize, timestamp, durationMs } = message;

    // 如果是音訊相關的 blob
    if (
      blobType &&
      (blobType.includes("audio") ||
        blobType.includes("video") ||
        blobType.includes("mp4"))
    ) {
      console.log("[DEBUG-WEBREQUEST] 偵測到音訊相關的 blob URL:", {
        blobUrl,
        blobType,
        blobSize,
        tabId: sender.tab?.id,
      });

      // 如果已有持續時間資訊，直接註冊到 voiceMessages
      if (durationMs) {
        console.log(
          `[DEBUG-WEBREQUEST] Blob URL 已有持續時間資訊: ${durationMs}ms，註冊到 voiceMessages`
        );

        // 使用 registerDownloadUrl 函數將 Blob URL 註冊到 voiceMessages
        const id = voiceMessages.registerDownloadUrl(
          voiceMessages,
          durationMs,
          blobUrl,
          null // 沒有 lastModified 資訊
        );

        console.log(
          `[DEBUG-WEBREQUEST] 成功註冊 Blob URL，ID: ${id}，持續時間: ${durationMs}ms`
        );
      } else {
        // 沒有持續時間資訊，需要計算
        console.log("[DEBUG-WEBREQUEST] Blob URL 沒有持續時間資訊，需要計算");

        // 發送訊息到內容腳本，要求計算持續時間
        chrome.tabs.sendMessage(
          sender.tab.id,
          {
            action: "calculateBlobDuration",
            blobUrl: blobUrl,
            blobType: blobType,
            requestId: Date.now().toString(),
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[DEBUG-WEBREQUEST] 發送計算 blob 持續時間要求時發生錯誤:",
                chrome.runtime.lastError
              );
              return;
            }

            console.log("[DEBUG-WEBREQUEST] 已發送計算 blob 持續時間要求");
          }
        );
      }

      console.log(
        "[DEBUG-WEBREQUEST] 注意：Blob URL 已存儲，但不會自動下載。用戶需要右鍵點擊才會下載。"
      );
    }
  } catch (error) {
    console.error("[DEBUG-WEBREQUEST] 處理 blob URL 訊息時發生錯誤:", error);
  }
}

/**
 * 處理已完成的請求
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} details - 請求詳情
 * @param {boolean} [isHighPriority=false] - 是否為高優先級請求
 */
function handleCompletedRequest(
  voiceMessages,
  details,
  isHighPriority = false
) {
  try {
    const url = details.url;

    // 如果是高優先級請求，直接處理，不需要額外的過濾
    if (isHighPriority) {
      console.log("[DEBUG-WEBREQUEST] 處理高優先級語音訊息請求:", {
        url: details.url.substring(0, 150) + "...",
        type: details.type,
        statusCode: details.statusCode,
        method: details.method,
        isHighPriority: true,
      });
    }
    // 否則，放寬過濾條件，處理所有可能的語音訊息請求
    else if (
      url.includes(".mp4") ||
      url.includes("audio") ||
      url.includes("voice") ||
      url.includes("fbsbx.com") ||
      url.includes("/v/t") ||
      url.includes("/o1/v/") ||
      url.includes("/o2/v/")
    ) {
      console.log("[DEBUG-WEBREQUEST] 偵測到語音訊息請求:", {
        url: details.url.substring(0, 150) + "...",
        type: details.type,
        statusCode: details.statusCode,
        method: details.method,
      });
    } else {
      // 如果不是可能的語音訊息，直接返回
      return;
    }

    // 只處理成功的 GET 請求 (200 OK 或 206 Partial Content)
    if (
      details.method !== "GET" ||
      (details.statusCode !== 200 && details.statusCode !== 206)
    ) {
      console.log(
        `[DEBUG-WEBREQUEST] 跳過非 GET 或非成功狀態的請求: ${details.method} ${details.statusCode}`
      );
      return;
    }

    console.log(
      `[DEBUG-WEBREQUEST] 處理成功的 GET 請求: ${
        details.statusCode
      } ${details.url.substring(0, 100)}...`
    );

    // 從 URL 和標頭中提取資訊
    let durationMs = null;
    let lastModified = null;
    let contentType = null;
    let contentLength = null;

    // 高優先級請求的額外處理
    if (isHighPriority) {
      console.log("[DEBUG-WEBREQUEST] 高優先級請求詳細資訊:", {
        url: details.url.substring(0, 100),
        tabId: details.tabId,
        timeStamp: details.timeStamp,
      });
    }

    // 從回應標頭中提取資訊
    if (details.responseHeaders) {
      for (const header of details.responseHeaders) {
        const headerName = header.name.toLowerCase();
        if (headerName === "content-disposition") {
          durationMs = extractDurationFromContentDisposition(header.value);
          if (durationMs) {
            console.log(
              "[DEBUG-WEBREQUEST] 從 content-disposition 提取持續時間:",
              {
                header: header.value,
                durationMs,
              }
            );
          }
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
      // 高優先級請求的額外日誌
      if (isHighPriority) {
        console.log("[DEBUG-WEBREQUEST] 找到高優先級語音訊息下載 URL:", {
          url: url.substring(0, 100) + "...",
          durationMs,
          lastModified,
          contentType,
          contentLength,
          isHighPriority: true
        });
      } else {
        console.log("[DEBUG-WEBREQUEST] 找到語音訊息下載 URL:", {
          url: url.substring(0, 100) + "...",
          durationMs,
          lastModified,
          contentType,
          contentLength,
        });
      }

      // 輸出 voiceMessages 的狀態
      console.log("[DEBUG-WEBREQUEST] 註冊前 voiceMessages 狀態:", {
        exists: !!voiceMessages,
        mapSize: voiceMessages ? voiceMessages.items.size : 0,
      });

      // 註冊下載 URL
      const id = registerDownloadUrl(
        voiceMessages,
        durationMs,
        url,
        lastModified
      );
      console.log("[DEBUG-WEBREQUEST] 註冊下載 URL 完成，返回 ID:", id);

      // 輸出註冊後的狀態
      console.log("[DEBUG-WEBREQUEST] 註冊後 voiceMessages 狀態:", {
        mapSize: voiceMessages.items.size,
        hasItem: voiceMessages.items.has(id),
        item: voiceMessages.items.get(id)
          ? {
              id: voiceMessages.items.get(id).id,
              durationMs: voiceMessages.items.get(id).durationMs,
              hasDownloadUrl: !!voiceMessages.items.get(id).downloadUrl,
              isPending: !!voiceMessages.items.get(id).isPending,
            }
          : null,
      });
    } else if (contentLength && isLikelyAudioFile(contentType, url)) {
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
          isLikelyAudio: isLikelyAudioFile(contentType, url),
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
 * @param {boolean} [isHighPriority=false] - 是否為高優先級請求
 */
function handleHeadersReceived(voiceMessages, details, isHighPriority = false) {
  try {
    const url = details.url;
    
    // 如果是高優先級請求，直接處理，不需要額外的過濾
    if (isHighPriority) {
      console.log("[DEBUG-WEBREQUEST] 處理高優先級標頭請求:", {
        url: details.url.substring(0, 150) + "...",
        type: details.type,
        method: details.method,
        isHighPriority: true
      });
    }
    // 否則，放寬過濾條件，處理所有可能的語音訊息請求
    else if (
      !url.includes(".mp4") &&
      !url.includes("audio") &&
      !url.includes("voice") &&
      !url.includes("fbsbx.com") &&
      !url.includes("/v/t") &&
      !url.includes("/o1/v/") &&
      !url.includes("/o2/v/")
    ) {
      return;
    }

    // 從標頭中提取內容類型和內容長度
    let contentType = null;
    let contentLength = null;
    
    // 高優先級請求的額外處理
    if (isHighPriority) {
      console.log("[DEBUG-WEBREQUEST] 高優先級標頭請求詳細資訊:", {
        url: details.url.substring(0, 100),
        tabId: details.tabId,
        timeStamp: details.timeStamp
      });
    }
    let contentDisposition = null;

    if (details.responseHeaders) {
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

    // 只輸出確定是語音訊息的日誌
    if (contentDisposition && contentDisposition.includes("audioclip")) {
      // 從 content-disposition 提取持續時間
      let durationMs = null;
      if (contentDisposition) {
        durationMs = extractDurationFromContentDisposition(contentDisposition);
      }

      // 如果無法從 content-disposition 提取，嘗試從 URL 提取
      if (!durationMs) {
        durationMs = extractDurationFromUrl(url);
      }

      console.log("[DEBUG-WEBREQUEST] 偵測到語音訊息檔案:", {
        url: details.url.substring(0, 100) + "...",
        contentType,
        contentLength,
        contentDisposition,
        durationMs,
      });

      // 如果沒有從其他方法獲取到持續時間，可以嘗試從檔案大小估計
      if (!durationMs && contentLength) {
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
