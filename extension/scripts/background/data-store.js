/**
 * data-store.js
 * 提供統一的資料結構來管理語音訊息元素和下載 URL 的對應關係
 * 使用單例模式確保整個擴充功能中只有一個 voiceMessages 實例
 */

import { generateVoiceMessageId } from "../utils/id-generator.js";
import { secondsToMilliseconds } from "../utils/time-utils.js";
import { Logger } from "../utils/logger.js";
import { MODULE_NAMES } from "../utils/constants.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.DATA_STORE);

// 全域單例實例
let voiceMessagesInstance = null;

/**
 * 創建語音訊息資料存儲（單例模式）
 * 提供單一資料結構來管理語音訊息元素和下載 URL 的對應關係
 *
 * @returns {Object} 語音訊息資料存儲
 */
export function createDataStore() {
  // 如果實例已存在，直接返回
  if (voiceMessagesInstance) {
    logger.debug("返回現有的 voiceMessages 實例");
    return voiceMessagesInstance;
  }

  logger.info("創建新的 voiceMessages 實例");

  // 主要資料結構
  voiceMessagesInstance = {
    // 以 ID 為鍵的 Map，儲存完整語音訊息資料
    items: new Map(),

    // 輔助函數
    isDurationMatch,
    registerDownloadUrl,
    findPendingItemByDuration,
    findItemByDuration,
    getDownloadUrlForElement,
  };

  return voiceMessagesInstance;
}

/**
 * 判斷兩個持續時間是否在容忍度範圍內匹配
 *
 * @param {number} duration1Ms - 第一個持續時間（毫秒）
 * @param {number} duration2Ms - 第二個持續時間（毫秒）
 * @param {number} [toleranceMs=5] - 容忍度（毫秒）
 * @returns {boolean} - 如果兩個持續時間匹配則返回 true
 */
export function isDurationMatch(duration1Ms, duration2Ms, toleranceMs = 5) {
  if (typeof duration1Ms !== "number" || typeof duration2Ms !== "number") {
    return false;
  }

  return Math.abs(duration1Ms - duration2Ms) <= toleranceMs;
}

/**
 * 註冊下載 URL
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {number} durationMs - 持續時間（毫秒）
 * @param {string} downloadUrl - 下載 URL
 * @param {string} [lastModified] - Last-Modified 標頭值
 * @param {string} [blobType] - Blob 的 MIME 類型
 * @param {number} [blobSize] - Blob 的大小（位元）
 * @returns {string} - 語音訊息 ID
 */
export function registerDownloadUrl(
  voiceMessages,
  durationMs,
  downloadUrl,
  lastModified = null,
  blobType = null,
  blobSize = null
) {
  const blobSizeKB = blobSize ? (blobSize / 1024).toFixed(2) : "N/A";

  logger.debug("註冊下載 URL", {
    durationMs,
    downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
    lastModified,
    blobType,
    blobSizeKB,
    mapSize: voiceMessages.items.size,
  });

  // 記錄詳細診斷資訊
  const registerData = {
    durationMs,
    blobType,
    blobSizeBytes: blobSize,
    blobSizeKB,
    downloadUrlHint: downloadUrl ? downloadUrl.substring(0, 30) + "..." : null,
    lastModified,
    timestamp: new Date().toISOString(),
  };

  logger.debug("DATASTORE-REGISTER", registerData);

  // 檢查是否有匹配此持續時間的元素
  for (const [id, item] of voiceMessages.items.entries()) {
    if (isDurationMatch(item.durationMs, durationMs)) {
      // 如果有匹配元素，更新它的屬性
      logger.debug("找到匹配項目，更新資訊", {
        id,
        oldUrl: item.downloadUrl
          ? item.downloadUrl.substring(0, 30) + "..."
          : null,
        newUrl: downloadUrl ? downloadUrl.substring(0, 30) + "..." : null,
      });

      // 更新屬性
      item.downloadUrl = downloadUrl;

      // 更新其他屬性（如果提供了）
      if (lastModified) {
        item.lastModified = lastModified;
      }
      if (blobType) {
        item.blobType = blobType;
      }
      if (blobSize) {
        item.blobSize = blobSize;
      }

      // 記錄更新診斷資訊
      const updateData = {
        itemId: id,
        durationMs: item.durationMs,
        blobType: item.blobType,
        blobSize: item.blobSize,
        timestamp: new Date().toISOString(),
      };

      logger.debug("DATASTORE-UPDATE", updateData);

      return id;
    }
  }

  // 如果沒有匹配元素，創建一個待處理項目
  const id = generateVoiceMessageId();
  logger.debug("未找到匹配項目，創建新項目", {
    id,
    durationMs,
    isPending: true,
  });

  // 在 voiceMessages.items 中建立新項目
  const newItem = {
    id,
    element: null,
    durationMs,
    downloadUrl,
    lastModified,
    blobType,
    blobSize,
    timestamp: Date.now(),
    isPending: true, // 使用屬性標記狀態
  };

  voiceMessages.items.set(id, newItem);

  logger.debug("新項目已添加", { mapSize: voiceMessages.items.size });
  logger.debug("新項目詳情", {
    id,
    durationMs,
    hasDownloadUrl: !!downloadUrl,
    blobType,
    blobSizeKB,
    hasElement: !!newItem.element,
    isPending: newItem.isPending,
  });

  // 記錄新項目診斷資訊
  const newItemData = {
    itemId: id,
    durationMs,
    blobType,
    blobSizeBytes: blobSize,
    blobSizeKB,
    isPending: true,
    timestamp: new Date().toISOString(),
  };

  logger.debug("DATASTORE-NEW", newItemData);

  return id;
}

/**
 * 尋找指定持續時間的待處理項目
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {number} durationMs - 持續時間（毫秒）
 * @returns {Object|null} - 待處理項目，如果找不到則返回 null
 */
export function findPendingItemByDuration(voiceMessages, durationMs) {
  for (const item of voiceMessages.items.values()) {
    if (item.isPending && isDurationMatch(item.durationMs, durationMs)) {
      return item;
    }
  }

  return null;
}

/**
 * 根據元素查找對應的下載 URL
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Element} element - 語音訊息元素
 * @returns {Object|null} - 包含 downloadUrl 和 lastModified 的物件，如果找不到則返回 null
 */
export function getDownloadUrlForElement(voiceMessages, element) {
  if (!element) {
    logger.debug("getDownloadUrlForElement: 元素為 null");
    return null;
  }

  logger.debug("查找元素對應的下載 URL");
  logger.debug("voiceMessages Map 大小", { size: voiceMessages.items.size });

  // 檢查元素是否有 data-voice-message-id 屬性
  const id = element.getAttribute("data-voice-message-id");
  logger.debug("元素 ID", { id });

  if (id && voiceMessages.items.has(id)) {
    // 如果有 ID 且在 items 中存在，直接返回
    const item = voiceMessages.items.get(id);
    logger.debug("找到匹配項目", {
      id,
      hasDownloadUrl: !!item.downloadUrl,
      hasElement: !!item.element,
      isPending: !!item.isPending,
    });

    return {
      downloadUrl: item.downloadUrl,
      lastModified: item.lastModified,
    };
  }

  // 如果沒有 ID 或 ID 不存在，嘗試通過持續時間查找
  if (element.hasAttribute("aria-valuemax")) {
    const durationSec = parseFloat(element.getAttribute("aria-valuemax"));
    if (!isNaN(durationSec)) {
      const durationMs = secondsToMilliseconds(durationSec);
      logger.debug("嘗試通過持續時間查找", { durationMs });

      // 輸出所有項目的持續時間，用於調試
      logger.debug("所有項目的持續時間");

      // 將所有項目的持續時間收集到一個數組中
      const itemsInfo = Array.from(voiceMessages.items.entries()).map(
        ([itemId, item]) => ({
          id: itemId,
          durationMs: item.durationMs,
          hasUrl: !!item.downloadUrl,
        })
      );

      logger.debug("項目持續時間詳情", { items: itemsInfo });

      const item = findItemByDuration(voiceMessages, durationMs);
      if (item && item.downloadUrl) {
        logger.debug("通過持續時間找到匹配項目", {
          id: item.id,
          durationMs: item.durationMs,
          hasDownloadUrl: !!item.downloadUrl,
        });

        return {
          downloadUrl: item.downloadUrl,
          lastModified: item.lastModified,
        };
      }
    }
  }

  // 如果沒有 ID 或 ID 不存在，返回 null
  logger.debug("未找到匹配的下載 URL");
  return null;
}

/**
 * 根據持續時間查找項目（包括已處理和待處理的項目）
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {number} durationMs - 持續時間（毫秒）
 * @returns {Object|null} - 找到的項目，如果找不到則返回 null
 */
export function findItemByDuration(voiceMessages, durationMs) {
  for (const item of voiceMessages.items.values()) {
    if (isDurationMatch(item.durationMs, durationMs)) {
      return item;
    }
  }

  return null;
}

/**
 * 清理過期的語音訊息項目
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {number} [maxAgeMs=3600000] - 最大存活時間（毫秒），默認為 1 小時
 */
export function cleanupOldItems(voiceMessages, maxAgeMs = 3600000) {
  const now = Date.now();

  for (const [id, item] of voiceMessages.items.entries()) {
    // 檢查項目是否過期
    if (now - item.timestamp > maxAgeMs) {
      voiceMessages.items.delete(id);
    }
  }
}
