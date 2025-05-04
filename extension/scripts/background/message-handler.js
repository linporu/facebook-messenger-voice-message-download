/**
 * message-handler.js
 * 負責處理來自內容腳本的訊息
 */

import {
  setLastRightClickedInfo,
  downloadVoiceMessage,
} from "./download-manager.js";

import { createDataStore } from "./data-store.js";
import Logger from "../utils/logger.js";
import { MESSAGE_ACTIONS, MESSAGE_SOURCES } from "../utils/constants.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("MESSAGE-HANDLER");

// 使用單例模式獲取語音訊息資料存儲
let voiceMessagesStore = null;

/**
 * 初始化訊息處理器
 *
 * @param {Object} [voiceMessages] - 語音訊息資料存儲（可選，如果未提供則使用單例）
 */
export function initMessageHandler(voiceMessages) {
  logger.debug("初始化訊息處理器");

  // 如果提供了 voiceMessages 參數，使用它；否則使用單例
  if (voiceMessages) {
    logger.debug("使用提供的 voiceMessages 實例");
    voiceMessagesStore = voiceMessages;
  } else {
    logger.debug("使用單例 voiceMessages 實例");
    voiceMessagesStore = createDataStore();
  }

  logger.debug("voiceMessagesStore 初始化完成", {
    mapSize: voiceMessagesStore.items.size,
  });

  // 監聽來自內容腳本的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug("收到訊息", { message });
    logger.debug("發送者資訊", { sender });

    if (message.action === MESSAGE_ACTIONS.RIGHT_CLICK) {
      logger.debug("處理右鍵點擊訊息");
      handleRightClickMessage(message, sender, sendResponse);
      return true; // 保持連接開啟，以便異步回應
    } else if (message.action === MESSAGE_ACTIONS.REGISTER_ELEMENT) {
      logger.debug("處理語音訊息元素註冊訊息");
      handleRegisterElementMessage(message, sender, sendResponse);
      return true; // 保持連接開啟，以便異步回應
    } else if (message.action === MESSAGE_ACTIONS.DOWNLOAD_BLOB) {
      logger.debug("處理 blob 內容下載訊息");
      handleDownloadBlobContent(message, sender, sendResponse);
      return true; // 保持連接開啟，以便異步回應
    } else if (message.action === MESSAGE_ACTIONS.REGISTER_BLOB_URL) {
      logger.debug("處理 Blob URL 註冊訊息");
      handleRegisterBlobUrl(message, sender, sendResponse);
      return true; // 保持連接開啟，以便異步回應

    } else {
      logger.warn("未處理的訊息類型", {
        action: message.action || "無動作",
      });
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
  logger.debug("處理右鍵點擊訊息詳細資訊", {
    elementId,
    downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
    lastModified,
    durationMs,
  });

  // 確保我們有 voiceMessagesStore
  if (!voiceMessagesStore) {
    logger.debug("voiceMessagesStore 不存在，創建單例");
    voiceMessagesStore = createDataStore();
  }

  logger.debug("voiceMessagesStore Map 大小", {
    mapSize: voiceMessagesStore.items.size,
  });

  // 輸出所有項目的持續時間和下載 URL 狀態，用於調試
  logger.debug("所有項目的持續時間和下載 URL 狀態");
  for (const [id, item] of voiceMessagesStore.items.entries()) {
    logger.debug(`項目狀態`, {
      id,
      durationMs: item.durationMs,
      hasUrl: !!item.downloadUrl,
      isPending: !!item.isPending,
    });
  }

  // 如果沒有提供下載 URL，但有持續時間，嘗試從 voiceMessagesStore 中查找
  if (!downloadUrl && durationMs) {
    logger.debug("嘗試從資料存儲中查找下載 URL", {
      durationMs,
    });

    // 記錄匹配開始時間和目標持續時間
    const matchStartTime = Date.now();
    const targetDuration = durationMs;

    logger.debug("開始匹配過程", {
      phase: "start",
      targetDuration,
      timestamp: new Date().toISOString(),
      itemsCount: voiceMessagesStore.items.size,
    });

    // 方法 1: 使用 findItemByDuration 函數
    let matchingItem = null;
    if (typeof voiceMessagesStore.findItemByDuration === "function") {
      logger.debug("使用 findItemByDuration 函數查找");
      matchingItem = voiceMessagesStore.findItemByDuration(
        voiceMessagesStore,
        durationMs
      );
      logger.debug("findItemByDuration 結果", {
        found: !!matchingItem,
      });

      if (matchingItem) {
        logger.debug("匹配成功", {
          phase: "findItemByDuration",
          result: "success",
          itemId: matchingItem.id,
          itemDuration: matchingItem.durationMs,
          targetDuration: targetDuration,
          difference: Math.abs(matchingItem.durationMs - targetDuration),
          hasUrl: !!matchingItem.downloadUrl,
          isPending: !!matchingItem.isPending,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.debug("匹配失敗", {
          phase: "findItemByDuration",
          result: "failure",
          targetDuration: targetDuration,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 方法 2: 直接遍歷 items 集合
    if (!matchingItem) {
      logger.debug("直接遍歷 items 集合查找");
      const tolerance = 5; // 容差值（毫秒）
      let attemptCount = 0;

      for (const [id, item] of voiceMessagesStore.items.entries()) {
        attemptCount++;
        const difference = Math.abs(item.durationMs - durationMs);

        // 記錄每次匹配嘗試
        logger.debug("匹配嘗試詳細", {
          phase: "iteration",
          attemptNumber: attemptCount,
          itemId: id,
          itemDuration: item.durationMs,
          targetDuration: targetDuration,
          difference: difference,
          withinTolerance: difference <= tolerance,
          hasUrl: !!item.downloadUrl,
          isPending: !!item.isPending,
          timestamp: new Date().toISOString(),
        });

        if (item.durationMs && difference <= tolerance) {
          logger.debug("找到匹配項目", {
            durationMs: item.durationMs,
            hasDownloadUrl: !!item.downloadUrl,
          });
          matchingItem = item;
          break;
        }
      }

      // 記錄遍歷結果
      logger.debug("遍歷完成", {
        phase: "iterationComplete",
        result: matchingItem ? "success" : "failure",
        attemptCount: attemptCount,
        elapsedMs: Date.now() - matchStartTime,
        timestamp: new Date().toISOString(),
      });
    }

    if (matchingItem && matchingItem.downloadUrl) {
      logger.debug("在資料存儲中找到匹配的下載 URL", {
        id: matchingItem.id,
        durationMs: matchingItem.durationMs,
        downloadUrl: matchingItem.downloadUrl
          ? matchingItem.downloadUrl.substring(0, 30) + "..."
          : null,
      });
      message.downloadUrl = matchingItem.downloadUrl;
      message.lastModified = matchingItem.lastModified || lastModified;
    } else {
      logger.warn("在資料存儲中未找到匹配的下載 URL");
      // 輸出資料存儲的狀態以協助調試
      logger.debug("資料存儲中的項目數量", {
        itemsCount: voiceMessagesStore.items.size,
      });

      // 輸出所有項目的持續時間以進行比較
      const allDurations = [];
      for (const [id, item] of voiceMessagesStore.items.entries()) {
        if (item.durationMs) {
          allDurations.push(item.durationMs);
        }
      }
      logger.debug("資料存儲中的所有持續時間", {
        durations: allDurations,
      });
    }
  }

  // 重新取得更新後的資訊
  const finalDownloadUrl = message.downloadUrl;
  const finalLastModified = message.lastModified;

  if (!finalDownloadUrl) {
    logger.warn("下載 URL 無效，但仍然記錄右鍵點擊資訊");
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
  logger.debug("設置最後一次右鍵點擊的資訊", {
    elementId,
    downloadUrl: finalDownloadUrl
      ? finalDownloadUrl.substring(0, 30) + "..."
      : null,
    hasLastModified: !!finalLastModified,
    tabId: sender.tab?.id,
    durationMs,
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
  logger.debug("回應內容腳本", { response });
  sendResponse(response);

  logger.debug("右鍵點擊訊息處理完成");
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
  logger.debug("處理語音訊息元素註冊訊息", {
    elementId,
    durationMs,
    tabId: sender.tab?.id,
  });

  if (!elementId || !durationMs || !voiceMessagesStore) {
    logger.error("缺少必要資訊或 voiceMessagesStore 不存在");
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
        logger.debug("找到匹配的待處理項目", { item });
        matchingItem = item;
        break;
      }
    }

    if (matchingItem) {
      // 如果找到匹配項目，更新元素的下載 URL
      const currentItem = voiceMessagesStore.items.get(elementId);
      currentItem.downloadUrl = matchingItem.downloadUrl;
      currentItem.lastModified = matchingItem.lastModified;

      logger.debug("已更新元素的下載 URL:", {
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
          logger.error("發送更新訊息到內容腳本時發生錯誤:", error);
        }
      }

      sendResponse({
        success: true,
        downloadUrl: matchingItem.downloadUrl,
        lastModified: matchingItem.lastModified,
      });
    } else {
      logger.debug("未找到匹配的待處理項目");
      sendResponse({
        success: true,
        message: "元素已註冊，但無匹配的下載 URL",
      });
    }
  } catch (error) {
    logger.error("處理語音訊息元素註冊訊息時發生錯誤:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 處理 Blob URL 註冊訊息
 * 將 Blob URL 與其持續時間一起存儲到 voiceMessagesStore 中
 *
 * @param {Object} message - 訊息物件，包含 blobUrl, durationMs 等資訊
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 */
function handleRegisterBlobUrl(message, sender, sendResponse) {
  // 取得基本資訊
  const { blobUrl, blobType, blobSize, durationMs, timestamp } = message;
  const urlFeatures = blobUrl ? blobUrl.substring(0, 30) + "..." : null;

  logger.debug("處理 Blob URL 註冊訊息", {
    blobUrl: urlFeatures,
    durationMs,
    blobType,
    blobSize,
    timestamp,
  });

  // 確保我們有 voiceMessagesStore
  if (!voiceMessagesStore) {
    logger.debug("voiceMessagesStore 不存在，創建單例");
    voiceMessagesStore = createDataStore();
  }

  // 確保有必要的資訊
  if (!blobUrl || !durationMs) {
    logger.error("缺少必要的 Blob URL 或持續時間資訊");
    sendResponse({
      success: false,
      message: "缺少必要的 Blob URL 或持續時間資訊",
    });
    return;
  }

  try {
    // 使用 registerDownloadUrl 函數將 Blob URL 註冊到 voiceMessagesStore
    const id = voiceMessagesStore.registerDownloadUrl(
      voiceMessagesStore,
      durationMs,
      blobUrl,
      null, // 沒有 lastModified 資訊
      blobType,
      blobSize
    );

    logger.info(`成功註冊 Blob URL，ID: ${id}，持續時間: ${durationMs}ms`);

    // 輸出當前 voiceMessagesStore 的狀態
    logger.debug("voiceMessagesStore 當前項目數量", {
      itemsCount: voiceMessagesStore.items.size,
    });

    sendResponse({
      success: true,
      message: "成功註冊 Blob URL",
      id: id,
    });
  } catch (error) {
    logger.error("註冊 Blob URL 時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
    sendResponse({
      success: false,
      message: `註冊 Blob URL 時發生錯誤: ${error.message}`,
    });
  }
}



/**
 * 處理 blob 內容下載訊息
 *
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 */
function handleDownloadBlobContent(message, sender, sendResponse) {
  try {
    logger.debug("處理 blob 內容下載訊息", {
      blobType: message.blobType,
      base64Length: message.base64data ? message.base64data.length : 0,
      requestId: message.requestId,
      timestamp: message.timestamp,
    });

    // 檢查必要的參數
    if (!message.base64data || !message.blobType) {
      logger.error("缺少必要的參數");
      sendResponse({ success: false, error: "缺少必要的參數" });
      return;
    }

    // 注意：在背景腳本（Service Worker）中不能使用 URL.createObjectURL

    // 直接使用 base64 資料，不需要轉換為 blob
    logger.debug("使用 base64 資料直接下載:", {
      blobType: message.blobType,
      base64Length: message.base64data.length,
    });

    // 根據 MIME 類型決定副檔名
    let fileExtension = ".bin";
    if (
      message.blobType.includes("audio/mpeg") ||
      message.blobType.includes("audio/mp3")
    ) {
      fileExtension = ".mp3";
    } else if (
      message.blobType.includes("audio/mp4") ||
      message.blobType.includes("video/mp4")
    ) {
      fileExtension = ".mp4";
    } else if (message.blobType.includes("audio/wav")) {
      fileExtension = ".wav";
    } else if (message.blobType.includes("audio/ogg")) {
      fileExtension = ".ogg";
    } else if (message.blobType.includes("audio/aac")) {
      fileExtension = ".aac";
    }

    // 生成檔案名稱
    const timestamp = message.timestamp
      ? new Date(message.timestamp)
      : new Date();
    const formattedDate = timestamp
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `voice-message-${formattedDate}${fileExtension}`;

    // 創建 Data URL
    const dataUrl = `data:${message.blobType};base64,${message.base64data}`;

    // 下載檔案
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: filename,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          logger.error("下載檔案時發生錯誤", {
            error: chrome.runtime.lastError,
          });
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        logger.info("已開始下載檔案", {
          downloadId,
          filename,
          blobType: message.blobType,
        });

        sendResponse({
          success: true,
          message: "已開始下載檔案",
          downloadId,
          filename,
        });
      }
    );
  } catch (error) {
    logger.error("處理 blob 內容下載時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
    sendResponse({ success: false, error: error.message });
  }
}
