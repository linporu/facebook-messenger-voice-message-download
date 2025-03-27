/**
 * message-handler.js
 * 負責處理來自內容腳本的訊息
 */

import {
  setLastRightClickedInfo,
  downloadVoiceMessage,
} from "./download-manager.js";

import { createDataStore } from "./data-store.js";

// 使用單例模式獲取語音訊息資料存儲
let voiceMessagesStore = null;

/**
 * 初始化訊息處理器
 *
 * @param {Object} [voiceMessages] - 語音訊息資料存儲（可選，如果未提供則使用單例）
 */
export function initMessageHandler(voiceMessages) {
  console.log("[DEBUG-MESSAGEHANDLER] 初始化訊息處理器");

  // 如果提供了 voiceMessages 參數，使用它；否則使用單例
  if (voiceMessages) {
    console.log("[DEBUG-MESSAGEHANDLER] 使用提供的 voiceMessages 實例");
    voiceMessagesStore = voiceMessages;
  } else {
    console.log("[DEBUG-MESSAGEHANDLER] 使用單例 voiceMessages 實例");
    voiceMessagesStore = createDataStore();
  }
  
  console.log("[DEBUG-MESSAGEHANDLER] voiceMessagesStore 初始化完成，Map 大小:", voiceMessagesStore.items.size);

  // 監聽來自內容腳本的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[DEBUG-BACKGROUND] 收到訊息:", message);
    console.log("[DEBUG-BACKGROUND] 發送者資訊:", sender);

    if (message.action === "rightClickOnVoiceMessage") {
      console.log("[DEBUG-BACKGROUND] 處理右鍵點擊訊息");
      handleRightClickMessage(message, sender, sendResponse);
      return true; // 保持連接開啟，以便異步回應
    } else if (message.action === "registerVoiceMessageElement") {
      console.log("[DEBUG-BACKGROUND] 處理語音訊息元素註冊訊息");
      handleRegisterElementMessage(message, sender, sendResponse);
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
  console.log("[DEBUG-MESSAGEHANDLER] 處理右鍵點擊訊息詳細資訊:", {
    elementId,
    downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
    lastModified,
    durationMs,
  });

  // 確保我們有 voiceMessagesStore
  if (!voiceMessagesStore) {
    console.log("[DEBUG-MESSAGEHANDLER] voiceMessagesStore 不存在，創建單例");
    voiceMessagesStore = createDataStore();
  }

  console.log("[DEBUG-MESSAGEHANDLER] voiceMessagesStore Map 大小:", voiceMessagesStore.items.size);
  
  // 輸出所有項目的持續時間和下載 URL 狀態，用於調試
  console.log("[DEBUG-MESSAGEHANDLER] 所有項目的持續時間和下載 URL 狀態:");
  for (const [id, item] of voiceMessagesStore.items.entries()) {
    console.log(`- ID: ${id}, 持續時間: ${item.durationMs}ms, 有URL: ${!!item.downloadUrl}, 待處理: ${!!item.isPending}`);
  }

  // 如果沒有提供下載 URL，但有持續時間，嘗試從 voiceMessagesStore 中查找
  if (!downloadUrl && durationMs) {
    console.log(
      "[DEBUG-MESSAGEHANDLER] 嘗試從資料存儲中查找下載 URL，持續時間:",
      durationMs
    );

    // 方法 1: 使用 findItemByDuration 函數
    let matchingItem = null;
    if (typeof voiceMessagesStore.findItemByDuration === "function") {
      console.log("[DEBUG-MESSAGEHANDLER] 使用 findItemByDuration 函數查找");
      matchingItem = voiceMessagesStore.findItemByDuration(voiceMessagesStore, durationMs);
      console.log("[DEBUG-MESSAGEHANDLER] findItemByDuration 結果:", matchingItem ? "找到項目" : "未找到項目");
    }

    // 方法 2: 直接遍歷 items 集合
    if (!matchingItem) {
      console.log("[DEBUG-MESSAGEHANDLER] 直接遍歷 items 集合查找");
      const tolerance = 5; // 容差值（毫秒）

      for (const [id, item] of voiceMessagesStore.items.entries()) {
        console.log(`[DEBUG-MESSAGEHANDLER] 檢查項目 ID: ${id}, 持續時間: ${item.durationMs}ms, 差值: ${Math.abs(item.durationMs - durationMs)}ms`);
        
        if (
          item.durationMs &&
          Math.abs(item.durationMs - durationMs) <= tolerance
        ) {
          console.log(
            "[DEBUG-MESSAGEHANDLER] 找到匹配項目，持續時間:",
            item.durationMs,
            ", 有下載 URL:",
            !!item.downloadUrl
          );
          matchingItem = item;
          break;
        }
      }
    }

    if (matchingItem && matchingItem.downloadUrl) {
      console.log("[DEBUG-MESSAGEHANDLER] 在資料存儲中找到匹配的下載 URL:", {
        id: matchingItem.id,
        durationMs: matchingItem.durationMs,
        downloadUrl: matchingItem.downloadUrl ? matchingItem.downloadUrl.substring(0, 30) + "..." : null
      });
      message.downloadUrl = matchingItem.downloadUrl;
      message.lastModified = matchingItem.lastModified || lastModified;
    } else {
      console.log("[DEBUG-MESSAGEHANDLER] 在資料存儲中未找到匹配的下載 URL");
      // 輸出資料存儲的狀態以協助調試
      console.log(
        "[DEBUG-MESSAGEHANDLER] 資料存儲中的項目數量:",
        voiceMessagesStore.items.size
      );

      // 輸出所有項目的持續時間以進行比較
      const allDurations = [];
      for (const [id, item] of voiceMessagesStore.items.entries()) {
        if (item.durationMs) {
          allDurations.push(item.durationMs);
        }
      }
      console.log(
        "[DEBUG-MESSAGEHANDLER] 資料存儲中的所有持續時間:",
        allDurations
      );
    }
  }

  // 重新取得更新後的資訊
  const finalDownloadUrl = message.downloadUrl;
  const finalLastModified = message.lastModified;

  if (!finalDownloadUrl) {
    console.log("[DEBUG-MESSAGEHANDLER] 下載 URL 無效，但仍然記錄右鍵點擊資訊");
    // 即使沒有下載 URL，也記錄右鍵點擊的資訊，以便後續捕獲到 URL 時可以使用
    setLastRightClickedInfo({
      elementId,
      downloadUrl: null,
      lastModified: null,
      tabId: sender.tab?.id,
      durationMs: durationMs,
    });

    sendResponse({
      success: true,
      message: "已記錄右鍵點擊資訊，但無法找到下載 URL",
    });
    return;
  }

  // 設置最後一次右鍵點擊的資訊
  console.log("[DEBUG-MESSAGEHANDLER] 設置最後一次右鍵點擊的資訊:", {
    elementId,
    downloadUrl: finalDownloadUrl ? finalDownloadUrl.substring(0, 30) + "..." : null,
    hasLastModified: !!finalLastModified,
    tabId: sender.tab?.id,
    durationMs
  });
  
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
  console.log("[DEBUG-MESSAGEHANDLER] 回應內容腳本:", response);
  sendResponse(response);

  console.log("[DEBUG-MESSAGEHANDLER] 右鍵點擊訊息處理完成");
}

/**
 * 處理語音訊息元素註冊訊息
 *
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 */
function handleRegisterElementMessage(message, sender, sendResponse) {
  const { elementId, durationMs } = message;
  console.log("[DEBUG-BACKGROUND] 處理語音訊息元素註冊訊息:", {
    elementId,
    durationMs,
    tabId: sender.tab?.id,
  });

  if (!elementId || !durationMs || !voiceMessagesStore) {
    console.error(
      "[DEBUG-BACKGROUND] 缺少必要資訊或 voiceMessagesStore 不存在"
    );
    sendResponse({ success: false, error: "缺少必要資訊" });
    return;
  }

  try {
    // 在 voiceMessages 中建立新項目
    voiceMessagesStore.items.set(elementId, {
      id: elementId,
      durationMs,
      downloadUrl: null,
      lastModified: null,
      timestamp: Date.now(),
      tabId: sender.tab?.id,
    });

    // 檢查是否有待處理的下載 URL 可以匹配
    let matchingItem = null;

    // 使用容差值尋找匹配的項目
    const tolerance = 5; // 容差值（毫秒）

    for (const [id, item] of voiceMessagesStore.items) {
      if (
        id !== elementId && // 不是自己
        item.downloadUrl && // 有下載 URL
        item.durationMs && // 有持續時間
        Math.abs(item.durationMs - durationMs) <= tolerance
      ) {
        // 持續時間匹配
        console.log("[DEBUG-BACKGROUND] 找到匹配的待處理項目:", item);
        matchingItem = item;
        break;
      }
    }

    if (matchingItem) {
      // 如果找到匹配項目，更新元素的下載 URL
      const currentItem = voiceMessagesStore.items.get(elementId);
      currentItem.downloadUrl = matchingItem.downloadUrl;
      currentItem.lastModified = matchingItem.lastModified;

      console.log("[DEBUG-BACKGROUND] 已更新元素的下載 URL:", {
        elementId,
        downloadUrl: matchingItem.downloadUrl.substring(0, 50) + "...",
      });

      // 通知內容腳本更新 UI
      if (sender.tab?.id) {
        try {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: "updateVoiceMessageElement",
            elementId: elementId,
            downloadUrl: matchingItem.downloadUrl,
          });
        } catch (error) {
          console.error(
            "[DEBUG-BACKGROUND] 發送更新訊息到內容腳本時發生錯誤:",
            error
          );
        }
      }

      sendResponse({
        success: true,
        downloadUrl: matchingItem.downloadUrl,
        lastModified: matchingItem.lastModified,
      });
    } else {
      console.log("[DEBUG-BACKGROUND] 未找到匹配的待處理項目");
      sendResponse({
        success: true,
        message: "元素已註冊，但無匹配的下載 URL",
      });
    }
  } catch (error) {
    console.error(
      "[DEBUG-BACKGROUND] 處理語音訊息元素註冊訊息時發生錯誤:",
      error
    );
    sendResponse({ success: false, error: error.message });
  }
}
