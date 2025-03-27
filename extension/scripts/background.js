/**
 * background.js
 * 主要背景腳本，負責初始化和協調背景模組
 */

// 使用 import 語句
import { initMenuManager } from "./background/menu-manager.js";
import { initDownloadManager } from "./background/download-manager.js";
import { initMessageHandler } from "./background/message-handler.js";
import { initWebRequestInterceptor } from "./background/web-request-interceptor.js";
import { createDataStore, cleanupOldItems } from "./background/data-store.js";

// 添加調試資訊
console.log("[DEBUG-BACKGROUND] 背景腳本開始加載");
console.log("[DEBUG-BACKGROUND] 模組導入成功");

// 檢查 chrome API 是否可用
console.log("[DEBUG-BACKGROUND] chrome API 可用性:", {
  chrome: typeof chrome !== "undefined",
  webRequest:
    typeof chrome !== "undefined" && typeof chrome.webRequest !== "undefined",
  contextMenus:
    typeof chrome !== "undefined" && typeof chrome.contextMenus !== "undefined",
  downloads:
    typeof chrome !== "undefined" && typeof chrome.downloads !== "undefined",
});

/**
 * 主要初始化函數
 */
function initialize() {
  console.log("[DEBUG-BACKGROUND] 初始化背景腳本");

  try {
    // 創建語音訊息資料存儲
    const voiceMessages = createDataStore();
    console.log("[DEBUG-BACKGROUND] 語音訊息資料存儲已創建");

    // 初始化右鍵選單管理器
    initMenuManager();
    console.log("[DEBUG-BACKGROUND] 右鍵選單管理器已初始化");

    // 初始化下載管理器
    initDownloadManager();
    console.log("[DEBUG-BACKGROUND] 下載管理器已初始化");

    // 初始化訊息處理器
    initMessageHandler(voiceMessages);
    console.log("[DEBUG-BACKGROUND] 訊息處理器已初始化");

    // 初始化 webRequest 攔截器
    console.log("[DEBUG-BACKGROUND] 準備初始化 webRequest 攔截器");
    initWebRequestInterceptor(voiceMessages);
    console.log("[DEBUG-BACKGROUND] webRequest 攔截器已初始化");

    // 設置定期清理過期項目
    setInterval(() => {
      cleanupOldItems(voiceMessages);
    }, 30 * 60 * 1000); // 每 30 分鐘清理一次

    console.log("[DEBUG-BACKGROUND] 背景腳本初始化完成");
    return voiceMessages; // 返回語音訊息資料存儲，以便其他函數使用
  } catch (error) {
    console.error("[DEBUG-BACKGROUND] 初始化過程中發生錯誤:", error);
    throw error; // 重新拋出錯誤，以便上層函數可以捕捉
  }
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
try {
  console.log("[DEBUG-BACKGROUND] 準備執行初始化函數");
  initialize();
  console.log("[DEBUG-BACKGROUND] 初始化函數已執行完成");
} catch (error) {
  console.error(
    "[DEBUG-BACKGROUND] 執行初始化函數時發生錯誤:",
    error.message,
    error.stack
  );
}
