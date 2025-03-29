/**
 * main-module.js
 * 主要模組，負責初始化和協調其他模組
 * 這個檔案會以 ES6 模組的方式載入，可以使用 import/export 語法
 */

import { initDomDetector } from "./voice-detector/dom-detector.js";
import { initContextMenuHandler } from "./voice-detector/context-menu-handler.js";

/**
 * 從 Blob 中提取音訊持續時間
 * 使用 Web Audio API 或 HTML5 Audio 元素計算持續時間
 *
 * @param {Blob} blob - 音訊 Blob 對象
 * @returns {Promise<number>} - 返回音訊持續時間（毫秒）的 Promise
 */
async function getDurationFromBlob(blob) {
  console.log("[DEBUG-BLOB] 開始從 Blob 提取音訊持續時間");

  return new Promise((resolve, reject) => {
    try {
      // 方法 1: 使用 HTML5 Audio 元素
      const audioElement = new Audio();
      const blobUrl = URL.createObjectURL(blob);

      // 設置事件監聽器
      audioElement.addEventListener("loadedmetadata", () => {
        try {
          // 獲取持續時間（秒）並轉換為毫秒
          const durationMs = Math.round(audioElement.duration * 1000);
          console.log(
            `[DEBUG-BLOB] 使用 Audio 元素獲取到持續時間: ${durationMs}ms`
          );

          // 釋放 Blob URL
          URL.revokeObjectURL(blobUrl);

          resolve(durationMs);
        } catch (innerError) {
          console.error("[DEBUG-BLOB] 處理音訊元數據時發生錯誤:", innerError);
          URL.revokeObjectURL(blobUrl);
          reject(innerError);
        }
      });

      // 設置錯誤處理
      audioElement.addEventListener("error", (e) => {
        console.error("[DEBUG-BLOB] 載入音訊時發生錯誤:", e);
        URL.revokeObjectURL(blobUrl);

        // 嘗試方法 2: 使用 Web Audio API
        tryWebAudioAPI(blob).then(resolve).catch(reject);
      });

      // 設置音訊來源
      audioElement.src = blobUrl;
      audioElement.load();

      // 設置超時處理
      setTimeout(() => {
        if (!audioElement.duration) {
          console.log("[DEBUG-BLOB] Audio 元素方法超時，嘗試 Web Audio API");
          URL.revokeObjectURL(blobUrl);

          // 嘗試方法 2: 使用 Web Audio API
          tryWebAudioAPI(blob).then(resolve).catch(reject);
        }
      }, 3000); // 3秒超時
    } catch (error) {
      console.error("[DEBUG-BLOB] 使用 Audio 元素提取持續時間失敗:", error);

      // 嘗試方法 2: 使用 Web Audio API
      tryWebAudioAPI(blob).then(resolve).catch(reject);
    }
  });
}

/**
 * 使用 Web Audio API 從 Blob 中提取音訊持續時間
 *
 * @param {Blob} blob - 音訊 Blob 對象
 * @returns {Promise<number>} - 返回音訊持續時間（毫秒）的 Promise
 */
async function tryWebAudioAPI(blob) {
  console.log("[DEBUG-BLOB] 嘗試使用 Web Audio API 提取持續時間");

  return new Promise((resolve, reject) => {
    try {
      // 創建 AudioContext
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();

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

              resolve(durationMs);

              // 關閉 AudioContext
              if (audioContext.state !== "closed") {
                audioContext.close();
              }
            },
            (decodeError) => {
              console.error(
                "[DEBUG-BLOB] 解碼音訊數據時發生錯誤:",
                decodeError
              );
              reject(decodeError);

              // 關閉 AudioContext
              if (audioContext.state !== "closed") {
                audioContext.close();
              }
            }
          );
        } catch (decodeError) {
          console.error("[DEBUG-BLOB] 處理音訊數據時發生錯誤:", decodeError);
          reject(decodeError);

          // 關閉 AudioContext
          if (audioContext.state !== "closed") {
            audioContext.close();
          }
        }
      };

      fileReader.onerror = function (readError) {
        console.error("[DEBUG-BLOB] 讀取 Blob 時發生錯誤:", readError);
        reject(readError);
      };

      // 開始讀取 Blob
      fileReader.readAsArrayBuffer(blob);
    } catch (error) {
      console.error("[DEBUG-BLOB] 使用 Web Audio API 提取持續時間失敗:", error);
      reject(error);
    }
  });
}

/**
 * 設置 Blob URL 監控
 * 攔截 URL.createObjectURL 方法來捕獲 blob URL 的創建
 * 計算音訊檔案的持續時間並存儲到 voiceMessagesStore
 */
function setupBlobUrlMonitor() {
  console.log("[DEBUG-BLOB] 設置 Blob URL 監控");

  // 保存原始的 URL.createObjectURL 方法
  const originalCreateObjectURL = URL.createObjectURL;

  // 攔截 URL.createObjectURL 方法
  URL.createObjectURL = function (blob) {
    // 調用原始方法獲取 blob URL
    const blobUrl = originalCreateObjectURL.apply(this, arguments);

    try {
      // 檢查 blob 類型
      if (blob && blob.type) {
        console.log(`[DEBUG-BLOB] 攔截到 URL.createObjectURL 調用:`, {
          blobUrl,
          blobType: blob.type,
          blobSize: blob.size,
        });

        // 特別關注音訊相關的 blob
        if (
          blob.type.includes("audio") ||
          blob.type.includes("video") ||
          blob.type.includes("mp4")
        ) {
          console.log(`[DEBUG-BLOB] 偵測到音訊/視訊 Blob URL 創建:`, {
            blobUrl,
            blobType: blob.type,
            blobSize: blob.size,
            timestamp: new Date().toISOString(),
          });

          // 計算音訊持續時間
          getDurationFromBlob(blob)
            .then((durationMs) => {
              console.log(
                `[DEBUG-BLOB] 成功計算 Blob 持續時間: ${durationMs}ms`
              );

              // 將 Blob URL 與持續時間一起存儲到 voiceMessagesStore
              window.sendToBackground({
                action: "registerBlobUrl",
                blobUrl: blobUrl,
                blobType: blob.type,
                blobSize: blob.size,
                durationMs: durationMs,
                timestamp: new Date().toISOString(),
              });
            })
            .catch((error) => {
              console.error("[DEBUG-BLOB] 計算 Blob 持續時間失敗:", error);

              // 即使無法計算持續時間，仍然發送 Blob URL 資訊到背景腳本
              window.sendToBackground({
                action: "blobUrlDetected",
                blobUrl: blobUrl,
                blobType: blob.type,
                blobSize: blob.size,
                timestamp: new Date().toISOString(),
                error: error.message,
              });
            });
        }
      }
    } catch (error) {
      console.error("[DEBUG-BLOB] 處理 blob URL 時發生錯誤:", error);
    }

    // 返回原始的 blob URL
    return blobUrl;
  };

  console.log("[DEBUG-BLOB] Blob URL 監控已設置");
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

  // 設置 Blob URL 監控
  setupBlobUrlMonitor();

  // 初始化 DOM 偵測器 - 不再傳遞 voiceMessages 參數
  initDomDetector();

  // 初始化右鍵選單處理器 - 不再傳遞 voiceMessages 參數
  initContextMenuHandler();

  console.log("[DEBUG-MAIN] 使用 webRequest API 模式，不再使用 fetch 代理攝截");

  // 通知背景腳本內容腳本已初始化
  // 注意：在頁面上下文中不能直接使用 chrome API，改用 window.postMessage
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
