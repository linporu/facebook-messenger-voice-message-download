/**
 * background.js
 * 主要背景腳本，負責初始化和協調背景模組
 */

import { initMenuManager } from "./background/menu-manager.js";
import { initDownloadManager } from "./background/download-manager.js";
import { initMessageHandler } from "./background/message-handler.js";
import { initWebRequestInterceptor } from "./background/web-request-interceptor.js";
import {
  createDataStore,
  cleanupOldItems,
} from "./voice-detector/data-store.js";

/**
 * 主要初始化函數
 */
function initialize() {
  console.log("初始化背景腳本");

  // 創建語音訊息資料存儲
  const voiceMessages = createDataStore();

  // 初始化右鍵選單管理器
  initMenuManager();

  // 初始化下載管理器
  initDownloadManager();

  // 初始化訊息處理器
  initMessageHandler(voiceMessages);

  // 初始化 webRequest 攔截器
  initWebRequestInterceptor(voiceMessages);

  // 設置定期清理過期項目
  setInterval(() => {
    cleanupOldItems(voiceMessages);
  }, 30 * 60 * 1000); // 每 30 分鐘清理一次

  console.log("背景腳本初始化完成");
}

// 當擴充功能安裝或更新時執行
chrome.runtime.onInstalled.addListener(() => {
  console.log("Facebook Messenger 語音訊息下載器已安裝或更新");

  // 初始化擴充功能狀態
  chrome.action.setBadgeText({
    text: "ON",
  });

  chrome.action.setBadgeBackgroundColor({
    color: "#4CAF50",
  });
});

// 執行初始化
initialize();
