/**
 * background.js
 * 主要背景腳本，負責初始化和協調背景模組
 */

import { initMenuManager } from "./background/menu-manager.js";
import { initDownloadManager } from "./background/download-manager.js";
import { initMessageHandler } from "./background/message-handler.js";

/**
 * 主要初始化函數
 */
function initialize() {
  console.log("初始化背景腳本");

  // 初始化右鍵選單管理器
  initMenuManager();

  // 初始化下載管理器
  initDownloadManager();

  // 初始化訊息處理器
  initMessageHandler();

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
