/**
 * main-module.js
 * 主要模組，負責初始化和協調其他模組
 * 這個檔案會以 ES6 模組的方式載入，可以使用 import/export 語法
 */

import { initDomDetector } from "./voice-detector/dom-detector.js";
import { initContextMenuHandler } from "./voice-detector/context-menu-handler.js";
import {
  setCurrentLanguage,
  normalizeLanguageCode,
} from "./utils/language-utils.js";

// 全局標記，用於識別擴充功能自己創建的 blob URL
// 使用 WeakMap 避免記憶體洩漏
// 將 blob 對象映射到布爾值，表示是否為擴充功能創建
// WeakMap 允許 blob 對象被垃圾回收時自動移除映射關係
// 這比使用普通的 Map 更安全，因為不會阻止 blob 垃圾回收
// 也不需要手動清理映射關係
const selfCreatedBlobs = new WeakMap();

// 節流控制變數
// 記錄最後一次處理 blob 的時間戳
// 用於限制短時間內處理 blob 的频率
let lastProcessedTime = 0;
// 最小處理間隔（毫秒）
// 即使有多個 blob 在短時間內創建，也只處理一個
const THROTTLE_INTERVAL = 500;

// 記錄已處理的 blob URL
// 避免重複處理相同的 URL
// 使用 Set 而非 WeakSet，因為需要存儲字符串 URL
const processedBlobUrls = new Set();

// 清理記錄的已處理 URL
// 定期執行，避免使用記憶體洩漏
setInterval(() => {
  // 清空已處理的 URL 集合
  processedBlobUrls.clear();
  console.log("[DEBUG-BLOB] 已清空處理過的 blob URL 記錄");
}, 300000); // 每 5 分鐘清空一次

/**
 * 從 Blob 中提取音訊持續時間
 * 使用 Web Audio API 提取持續時間，更穩定且資源消耗更少
 *
 * @param {Blob} blob - 音訊 Blob 對象
 * @returns {Promise<number>} - 返回音訊持續時間（毫秒）的 Promise
 */
async function getDurationFromBlob(blob) {
  // 直接使用 Web Audio API，不再嘗試 Audio 元素
  // 這可以減少資源消耗和錯誤機率
  try {
    console.log("[DEBUG-BLOB] 開始從 Blob 提取音訊持續時間");
    return await tryWebAudioAPI(blob);
  } catch (error) {
    console.error("[DEBUG-BLOB] 提取持續時間失敗:", error);
    throw error;
  }
}

/**
 * 使用 Web Audio API 從 Blob 中提取音訊持續時間
 *
 * @param {Blob} blob - 音訊 Blob 對象
 * @returns {Promise<number>} - 返回音訊持續時間（毫秒）的 Promise
 */
async function tryWebAudioAPI(blob) {
  console.log("[DEBUG-BLOB] 使用 Web Audio API 提取持續時間");

  return new Promise((resolve, reject) => {
    // 設置超時處理，確保即使解碼失敗也能正確釋放資源
    const timeoutId = setTimeout(() => {
      console.error("[DEBUG-BLOB] Web Audio API 解碼超時");
      // 如果已創建 audioContext，確保關閉
      if (
        typeof audioContext !== "undefined" &&
        audioContext.state !== "closed"
      ) {
        try {
          audioContext.close();
        } catch (err) {
          console.error("[DEBUG-BLOB] 關閉 AudioContext 時發生錯誤:", err);
        }
      }
      reject(new Error("Web Audio API 解碼超時"));
    }, 5000); // 5秒超時

    try {
      // 創建 AudioContext
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();

      // 設置清理函數，確保資源釋放
      const cleanup = () => {
        clearTimeout(timeoutId);
        if (audioContext && audioContext.state !== "closed") {
          try {
            audioContext.close();
          } catch (err) {
            console.error("[DEBUG-BLOB] 關閉 AudioContext 時發生錯誤:", err);
          }
        }
      };

      // 將 Blob 轉換為 ArrayBuffer
      const fileReader = new FileReader();

      fileReader.onload = function () {
        try {
          // 解碼音訊數據
          audioContext.decodeAudioData(
            fileReader.result,
            (audioBuffer) => {
              // 獲取持續時間（秒）並轉換為毫秒
              const durationMs = Math.round(audioBuffer.duration * 1000);
              console.log(
                `[DEBUG-BLOB] 使用 Web Audio API 獲取到持續時間: ${durationMs}ms`
              );

              // 清理資源
              cleanup();
              resolve(durationMs);
            },
            (decodeError) => {
              console.error(
                "[DEBUG-BLOB] 解碼音訊數據時發生錯誤:",
                decodeError
              );

              // 清理資源
              cleanup();
              reject(decodeError);
            }
          );
        } catch (decodeError) {
          console.error("[DEBUG-BLOB] 處理音訊數據時發生錯誤:", decodeError);

          // 清理資源
          cleanup();
          reject(decodeError);
        }
      };

      fileReader.onerror = function (readError) {
        console.error("[DEBUG-BLOB] 讀取 Blob 時發生錯誤:", readError);

        // 清理資源
        cleanup();
        reject(readError);
      };

      // 開始讀取 Blob
      fileReader.readAsArrayBuffer(blob);
    } catch (error) {
      console.error("[DEBUG-BLOB] 使用 Web Audio API 提取持續時間失敗:", error);
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * 設置 Blob URL 監控
 * 攔截 URL.createObjectURL 方法來捕獲 blob URL 的創建
 * 計算音訊檔案的持續時間並存儲到 voiceMessagesStore
 * 已優化：增加安全標記、節流控制、更精確的音訊偵測
 */
function setupBlobUrlMonitor() {
  console.log("[DEBUG-BLOB] 設置 Blob URL 監控");

  // 保存原始的 URL.createObjectURL 方法
  const originalCreateObjectURL = URL.createObjectURL;

  // 攔截 URL.createObjectURL 方法
  URL.createObjectURL = function (blob) {
    // 檢查是否為擴充功能自己創建的 blob
    if (selfCreatedBlobs.has(blob)) {
      // 如果是擴充功能自己創建的 blob，直接調用原始方法並返回，不進行處理
      return originalCreateObjectURL.apply(this, arguments);
    }

    // 調用原始方法獲取 blob URL
    const blobUrl = originalCreateObjectURL.apply(this, arguments);

    try {
      // 節流控制：檢查是否超過最小處理間隔
      const now = Date.now();
      if (now - lastProcessedTime < THROTTLE_INTERVAL) {
        // 如果超過限制頻率，則跳過處理
        return blobUrl;
      }

      // 檢查是否已處理過這個 URL
      if (processedBlobUrls.has(blobUrl)) {
        // 如果已處理過，則跳過
        return blobUrl;
      }

      // 更嚴格的過濾條件：只處理可能是音訊的 blob
      if (!blob || !blob.type) {
        return blobUrl; // 如果沒有 blob 或 blob.type，直接返回
      }

      // 獲取 blob 的詳細資訊用於診斷
      const blobSizeKB = (blob.size / 1024).toFixed(2);
      const urlFeatures = blobUrl.substring(0, 50);
      const timestamp = new Date().toISOString();
      const stackTrace = new Error().stack;
      const pageUrl = window.location.href;

      // 判斷 blob 大小範圍
      let sizeCategory = "未知";
      if (blob.size < 10 * 1024) {
        sizeCategory = "極小 (<10KB)";
      } else if (blob.size < 100 * 1024) {
        sizeCategory = "小 (10KB-100KB)";
      } else if (blob.size < 1024 * 1024) {
        sizeCategory = "中 (100KB-1MB)";
      } else if (blob.size < 10 * 1024 * 1024) {
        sizeCategory = "大 (1MB-10MB)";
      } else {
        sizeCategory = "極大 (>10MB)";
      }

      // 更精確的音訊偵測：檢查 MIME 類型和大小
      const isLikelyAudio =
        // 檢查 MIME 類型
        (blob.type.includes("audio/") ||
          blob.type.includes("video/mp4") ||
          blob.type.includes("video/mpeg")) &&
        // 檢查大小：語音訊息通常在 10KB 到 10MB 之間
        blob.size > 10 * 1024 &&
        blob.size < 10 * 1024 * 1024;

      // 輸出詳細診斷資訊
      console.log(
        JSON.stringify({
          prefix: "[DEBUG-BLOB-DETAILED]",
          blobUrl: urlFeatures,
          blobType: blob.type,
          blobSizeBytes: blob.size,
          blobSizeKB: blobSizeKB,
          sizeCategory: sizeCategory,
          isLikelyAudio: isLikelyAudio,
          timestamp: timestamp,
          pageUrl: pageUrl,
          stackTraceHint: stackTrace ? stackTrace.split("\n")[2] : "無法獲取",
          creationContext: document.activeElement
            ? document.activeElement.tagName
            : "無法獲取",
        })
      );

      if (!isLikelyAudio) {
        return blobUrl; // 如果不可能是音訊，直接返回
      }

      // 更新最後處理時間
      lastProcessedTime = now;

      // 標記為已處理
      processedBlobUrls.add(blobUrl);

      // 計算音訊持續時間
      getDurationFromBlob(blob)
        .then((durationMs) => {
          // 驗證持續時間是否合理（大於 0.5 秒且小於 10 分鐘）
          if (durationMs < 500 || durationMs > 600000) {
            console.log(
              `[DEBUG-BLOB] 偵測到的持續時間 ${durationMs}ms 不在合理範圍內，跳過`
            );
            return;
          }

          // 判斷持續時間範圍
          let durationCategory = "未知";
          if (durationMs < 3000) {
            durationCategory = "極短 (<3秒)";
          } else if (durationMs < 10000) {
            durationCategory = "短 (3-10秒)";
          } else if (durationMs < 60000) {
            durationCategory = "中 (10秒-1分鐘)";
          } else {
            durationCategory = "長 (>1分鐘)";
          }

          console.log(
            JSON.stringify({
              prefix: "[DEBUG-BLOB-DURATION]",
              blobUrl: urlFeatures,
              durationMs: durationMs,
              durationCategory: durationCategory,
              blobType: blob.type,
              blobSizeKB: blobSizeKB,
              timestamp: timestamp,
            })
          );

          // 將 Blob URL 與持續時間一起存儲到 voiceMessagesStore，但不自動下載
          window.sendToBackground({
            action: "registerBlobUrl",
            blobUrl: blobUrl,
            blobType: blob.type,
            blobSize: blob.size,
            durationMs: durationMs,
            durationCategory: durationCategory,
            sizeCategory: sizeCategory,
            timestamp: timestamp,
          });

          console.log(
            `[DEBUG-BLOB] Blob URL 已註冊，持續時間: ${durationMs}ms。等待用戶右鍵點擊下載。`
          );
        })
        .catch((error) => {
          // 錯誤處理：只在偵測到可能的音訊檔案但無法計算持續時間時記錄
          // 減少輸出錯誤日誌的頻率
          console.error(
            "[DEBUG-BLOB] 計算 Blob 持續時間失敗，可能不是音訊檔案"
          );

          console.log(
            JSON.stringify({
              prefix: "[DEBUG-BLOB-ERROR]",
              blobUrl: urlFeatures,
              blobType: blob.type,
              blobSizeKB: blobSizeKB,
              error: error.message,
              timestamp: timestamp,
            })
          );

          // 不再發送失敗的 blob 到背景腳本，減少資源消耗
          // 只在高可能是音訊且大小合適的情況下才註冊
          if (
            blob.type.includes("audio/") &&
            blob.size > 50 * 1024 &&
            blob.size < 5 * 1024 * 1024
          ) {
            window.sendToBackground({
              action: "blobUrlDetected",
              blobUrl: blobUrl,
              blobType: blob.type,
              blobSize: blob.size,
              sizeCategory: sizeCategory,
              timestamp: timestamp,
            });

            console.log(
              "[DEBUG-BLOB] 雖無法計算持續時間，但仍註冊了可能的音訊 Blob URL。"
            );
          }
        });
    } catch (error) {
      // 錯誤處理：確保即使發生錯誤也不影響原始功能
      console.error(
        "[DEBUG-BLOB] 處理 blob URL 時發生錯誤，不影響原始功能:",
        error
      );
    }

    // 返回原始的 blob URL
    return blobUrl;
  };

  console.log("[DEBUG-BLOB] Blob URL 監控已設置，已優化資源使用和穩定性");
}

/**
 * 偵測頁面語言
 * 簡化後只在初始化時偵測一次語言，不持續監控
 */
function setupLanguageDetection() {
  console.log("[DEBUG-LANGUAGE] 執行單次語言偵測，不再持續監控");

  // 立即偵測並設置語言
  detectAndNotifyLanguage();

  // 只在頁面跳轉時重新偵測（避免SPA應用中的問題）
  window.addEventListener("popstate", () => {
    console.log("[DEBUG-LANGUAGE] 頁面跳轉，重新偵測語言");
    detectAndNotifyLanguage();
  });

  // 同樣監聽頁面的 hashchange 事件，處理基於錨點的路由變化
  window.addEventListener("hashchange", () => {
    console.log("[DEBUG-LANGUAGE] URL 錨點變更，重新偵測語言");
    detectAndNotifyLanguage();
  });

  console.log("[DEBUG-LANGUAGE] 語言偵測已設置，只在頁面跳轉時重新偵測");
}

/**
 * 偵測頁面語言並通知背景腳本
 */
function detectAndNotifyLanguage() {
  // 從 HTML 標籤獲取語言代碼
  const htmlElement = document.documentElement;
  const langAttribute = htmlElement.getAttribute("lang");

  if (langAttribute) {
    console.log(`[DEBUG-LANGUAGE] 偵測到頁面語言: ${langAttribute}`);

    // 標準化語言代碼
    const normalizedLangCode = normalizeLanguageCode(langAttribute);

    // 設置當前語言
    const hasChanged = setCurrentLanguage(normalizedLangCode);

    // 如果語言已變更，通知背景腳本
    if (hasChanged) {
      console.log(
        `[DEBUG-LANGUAGE] 語言已變更為: ${normalizedLangCode}，通知背景腳本`
      );

      // 使用 window.sendToBackground 發送訊息
      if (window.sendToBackground) {
        window.sendToBackground({
          action: "languageChanged",
          language: normalizedLangCode,
          originalLanguage: langAttribute,
        });
      }
    }
  } else {
    console.log("[DEBUG-LANGUAGE] 無法從 HTML 標籤獲取語言代碼");
  }
}

/**
 * 主要初始化函數
 */
function initialize() {
  console.log("初始化 Facebook Messenger 語音訊息下載器模組");

  // 檢查是否在支援的網站上
  const isSupportedSite =
    window.location.hostname.includes("facebook.com") ||
    window.location.hostname.includes("messenger.com");

  if (!isSupportedSite) {
    console.log("不支援的網站，擴充功能不會啟動");
    return;
  }

  // 先設置語言偵測
  setupLanguageDetection();

  // 等待短暫延遲，確保語言設置已完成
  setTimeout(() => {
    // 設置 Blob URL 監控
    setupBlobUrlMonitor();

    // 初始化 DOM 偵測器和右鍵選單處理器
    initDomDetector();
    initContextMenuHandler();

    console.log("[DEBUG-MAIN] DOM 偵測器和右鍵選單處理器已在語言偵測後初始化");

    // 通知背景腳本內容腳本已初始化
    window.postMessage(
      {
        type: "FROM_VOICE_MESSAGE_DOWNLOADER",
        message: {
          action: "contentScriptInitialized",
          url: window.location.href,
          hostname: window.location.hostname,
        },
      },
      "*"
    );
  }, 500); // 延遲 500ms 確保語言設置已完成

  console.log("[DEBUG-MAIN] 使用 webRequest API 模式，不再使用 fetch 代理攝截");

  // 通知背景腳本已由上面的setTimeout處理

  // 不再需要定期清理過期項目，這將由背景腳本處理

  // 設置訊息監聽器，處理與內容腳本的通訊
  window.addEventListener("message", function (event) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) return;

    // 處理來自內容腳本的訊息
    if (
      event.data.type &&
      event.data.type === "FROM_VOICE_MESSAGE_DOWNLOADER_BACKGROUND"
    ) {
      // 處理來自背景腳本的訊息
      const message = event.data.message;

      // 根據訊息類型處理
      if (message.action === "someAction") {
        // 處理特定動作
      }
    }
  });

  // 向內容腳本發送訊息的輔助函數
  window.sendToBackground = function (message) {
    try {
      console.log("[DEBUG-MAIN] 準備發送訊息到背景腳本:", message);

      // 使用 postMessage 發送訊息
      window.postMessage(
        {
          type: "FROM_VOICE_MESSAGE_DOWNLOADER",
          message: message,
        },
        "*"
      );

      console.log("[DEBUG-MAIN] 訊息已發送到背景腳本");
      return true;
    } catch (error) {
      console.error("[DEBUG-MAIN] 發送訊息到背景腳本時發生錯誤:", error);
      return false;
    }
  };

  console.log("Facebook Messenger 語音訊息下載器模組已啟動");
}

// 當 DOM 完全載入後初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
