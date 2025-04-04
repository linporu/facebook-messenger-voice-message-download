/**
 * content.js
 * 主要內容腳本，負責初始化和協調其他模組
 */

import { Logger } from "./utils/logger.js";
import {
  SUPPORTED_SITES,
  MESSAGE_SOURCES,
  MESSAGE_TYPES,
  MESSAGE_ACTIONS,
  TIME_CONSTANTS,
  MODULE_NAMES,
} from "./utils/constants.js";
import {
  handleExtractBlobRequest,
} from "./url monitor/blob-monitor.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.CONTENT_SCRIPT);

// 檢查是否在支援的網站上
const isSupportedSite = SUPPORTED_SITES.DOMAINS.some((domain) =>
  window.location.hostname.includes(domain)
);

if (!isSupportedSite) {
  logger.info("不支援的網站，擴充功能不會啟動");
} else {
  // 創建主模組腳本標籤
  const script = document.createElement("script");
  script.type = "module";
  script.src = chrome.runtime.getURL("scripts/main-module.js");
  script.onload = function () {
    logger.info("Facebook Messenger 語音訊息下載器已載入主模組");
    this.remove(); // 載入後移除腳本標籤
  };

  // 添加到頁面
  (document.head || document.documentElement).appendChild(script);

  // 設置訊息監聽器，處理腳本與背景腳本的通訊
  window.addEventListener("message", function (event) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) return;

    // 處理來自主模組的訊息
    if (event.data.type && event.data.type === MESSAGE_SOURCES.CONTENT_SCRIPT) {
      logger.debug("收到主模組訊息，轉發到背景腳本", {
        message: event.data.message,
      });
      chrome.runtime.sendMessage(event.data.message, function (response) {
        logger.debug("背景腳本回應", { response });
      });
    }
  });

  // 將來自背景腳本的訊息轉發到主模組
  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    logger.debug("收到背景腳本訊息", { message });

    // 特別處理 extractBlobContent 訊息
    if (message.action === MESSAGE_ACTIONS.EXTRACT_BLOB) {
      return handleExtractBlobRequest(message, sendResponse);
    }

    // 其他訊息轉發到主模組
    window.postMessage(
      {
        type: MESSAGE_SOURCES.BACKGROUND_SCRIPT,
        message: message,
      },
      "*"
    );
    return true;
  });

  logger.info("Facebook Messenger 語音訊息下載器已初始化");
}
