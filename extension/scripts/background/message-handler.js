/**
 * message-handler.js
 * 負責處理來自內容腳本的訊息
 */

import {
  setLastRightClickedInfo,
  downloadVoiceMessage,
} from "./download-manager.js";

// 共享的語音訊息資料存儲
let voiceMessagesStore = null;

/**
 * 初始化訊息處理器
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function initMessageHandler(voiceMessages) {
  console.log("初始化訊息處理器");

  // 儲存語音訊息資料存儲的引用
  voiceMessagesStore = voiceMessages;

  // 監聽來自內容腳本的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[DEBUG-BACKGROUND] 收到訊息:", message);
    console.log("[DEBUG-BACKGROUND] 發送者資訊:", sender);

    if (message.action === "rightClickOnVoiceMessage") {
      console.log("[DEBUG-BACKGROUND] 處理右鍵點擊訊息");
      handleRightClickMessage(message, sender, sendResponse);
      return true; // 保持連接開啟，以便異步回應
    } else {
      console.log(
        "[DEBUG-BACKGROUND] 未處理的訊息類型:",
        message.action || "無動作"
      );
    }

    return false;
  });
}

/**
 * 處理右鍵點擊訊息
 *
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 */
function handleRightClickMessage(message, sender, sendResponse) {
  const { elementId, downloadUrl, lastModified, durationMs } = message;
  console.log("[DEBUG-BACKGROUND] 處理右鍵點擊訊息詳細資訊:", {
    elementId,
    downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
    lastModified,
    durationMs,
  });

  // 如果沒有提供下載 URL，但有持續時間，嘗試從 voiceMessagesStore 中查找
  if (!downloadUrl && durationMs && voiceMessagesStore) {
    console.log(
      "[DEBUG-BACKGROUND] 嘗試從資料存儲中查找下載 URL，持續時間:",
      durationMs
    );

    // 從資料存儲中查找匹配的下載 URL
    const matchingItem = voiceMessagesStore.findItemByDuration(durationMs);

    if (matchingItem && matchingItem.downloadUrl) {
      console.log("[DEBUG-BACKGROUND] 在資料存儲中找到匹配的下載 URL");
      message.downloadUrl = matchingItem.downloadUrl;
      message.lastModified = matchingItem.lastModified || lastModified;
    }
  }

  // 重新取得更新後的資訊
  const finalDownloadUrl = message.downloadUrl;
  const finalLastModified = message.lastModified;

  if (!finalDownloadUrl) {
    console.error("[DEBUG-BACKGROUND] 下載 URL 無效");
    sendResponse({ success: false, error: "下載 URL 無效" });
    return;
  }

  // 設置最後一次右鍵點擊的資訊
  console.log("[DEBUG-BACKGROUND] 設置最後一次右鍵點擊的資訊");
  setLastRightClickedInfo({
    elementId,
    downloadUrl: finalDownloadUrl,
    lastModified: finalLastModified,
    tabId: sender.tab?.id,
    durationMs: durationMs,
  });

  // 回應內容腳本
  const response = {
    success: true,
    message: "已準備好下載語音訊息",
  };
  console.log("[DEBUG-BACKGROUND] 回應內容腳本:", response);
  sendResponse(response);

  console.log("[DEBUG-BACKGROUND] 右鍵點擊訊息處理完成");
}
