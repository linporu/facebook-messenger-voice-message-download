/**
 * main-module.js
 * 主要模組，負責初始化和協調其他模組
 * 這個檔案會以 ES6 模組的方式載入，可以使用 import/export 語法
 */

import { initDomDetector } from "./voice-detector/dom-detector.js";
import { initContextMenuHandler } from "./voice-detector/context-menu-handler.js";

/**
 * 設置 Blob URL 監控
 * 攔截 URL.createObjectURL 方法來捕獲 blob URL 的創建
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

          // 將 blob URL 資訊發送到背景腳本
          window.sendToBackground({
            action: "blobUrlDetected",
            blobUrl: blobUrl,
            blobType: blob.type,
            blobSize: blob.size,
            timestamp: new Date().toISOString(),
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
