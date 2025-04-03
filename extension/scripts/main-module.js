/**
 * main-module.js
 * 主要模組，負責初始化和協調其他模組
 * 這個檔案會以 ES6 模組的方式載入，可以使用 import/export 語法
 */

import { initDomDetector } from "./dom monitor/dom-detector.js";
import { initContextMenuHandler } from "./content/context-menu-handler.js";
import { Logger } from "./utils/logger.js";
import {
  MESSAGE_SOURCES,
  MESSAGE_TYPES,
  TIME_CONSTANTS,
} from "./utils/constants.js";
import { initBlobMonitor } from "./url monitor/blob-monitor.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("main-module");

/**
 * 主要初始化函數
 */
function initialize() {
  logger.info("初始化 Facebook Messenger 語音訊息下載器模組");

  // 檢查是否在支援的網站上
  const isSupportedSite =
    window.location.hostname.includes("facebook.com") ||
    window.location.hostname.includes("messenger.com");

  if (!isSupportedSite) {
    logger.info("不支援的網站，擴充功能不會啟動");
    return;
  }

  // 初始化 Blob 監控模組
  initBlobMonitor();

  // 初始化 DOM 偵測器 - 不再傳遞 voiceMessages 參數
  initDomDetector();

  // 初始化右鍵選單處理器 - 不再傳遞 voiceMessages 參數
  initContextMenuHandler();

  logger.debug("使用 webRequest API 模式，不再使用 fetch 代理攝截");

  // 通知背景腳本內容腳本已初始化
  // 注意：在頁面上下文中不能直接使用 chrome API，改用 window.postMessage
  window.postMessage(
    {
      type: MESSAGE_SOURCES.CONTENT_SCRIPT,
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
      event.data.type === MESSAGE_SOURCES.BACKGROUND_SCRIPT
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
      logger.debug("準備發送訊息到背景腳本", { message });

      // 使用 postMessage 發送訊息
      window.postMessage(
        {
          type: MESSAGE_SOURCES.CONTENT_SCRIPT,
          message: message,
        },
        "*"
      );

      logger.debug("訊息已發送到背景腳本");
      return true;
    } catch (error) {
      logger.error("發送訊息到背景腳本時發生錯誤", { error });
      return false;
    }
  };

  logger.info("Facebook Messenger 語音訊息下載器模組已啟動");
}

// 當 DOM 完全載入後初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
