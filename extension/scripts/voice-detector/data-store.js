/**
 * data-store.js
 * 提供統一的資料結構來管理語音訊息元素和下載 URL 的對應關係
 */

import { generateVoiceMessageId, isVoiceMessageId } from '../utils/id-generator.js';
import { markAsVoiceMessageElement } from '../utils/dom-utils.js';
import { secondsToMilliseconds } from '../utils/time-utils.js';

/**
 * 創建語音訊息資料存儲
 * 提供單一資料結構來管理語音訊息元素和下載 URL 的對應關係
 * 
 * @returns {Object} 語音訊息資料存儲
 */
export function createDataStore() {
  // 主要資料結構
  const voiceMessages = {
    // 以 ID 為鍵的 Map，儲存完整語音訊息資料
    items: new Map(),
    
    // 輔助函數
    isDurationMatch,
    registerVoiceMessageElement,
    registerDownloadUrl,
    findPendingItemByDuration,
    getDownloadUrlForElement
  };
  
  return voiceMessages;
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
  if (typeof duration1Ms !== 'number' || typeof duration2Ms !== 'number') {
    return false;
  }
  
  return Math.abs(duration1Ms - duration2Ms) <= toleranceMs;
}

/**
 * 註冊語音訊息元素
 * 
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Element} element - 語音訊息元素
 * @param {number} durationSec - 持續時間（秒）
 * @returns {string} - 語音訊息 ID
 */
export function registerVoiceMessageElement(voiceMessages, element, durationSec) {
  // 將秒轉換為毫秒
  const durationMs = secondsToMilliseconds(durationSec);
  
  // 檢查是否有待處理的項目匹配此持續時間
  const pendingItem = findPendingItemByDuration(voiceMessages, durationMs);
  
  if (pendingItem) {
    // 如果有待處理項目，更新它
    const id = pendingItem.id;
    
    // 更新待處理項目
    pendingItem.element = element;
    pendingItem.isPending = false;
    
    // 標記元素
    markAsVoiceMessageElement(element, id);
    
    return id;
  } else {
    // 如果沒有待處理項目，創建新項目
    const id = generateVoiceMessageId();
    
    // 將 ID 設置為元素的 data-voice-message-id 屬性
    markAsVoiceMessageElement(element, id);
    
    // 在 voiceMessages.items 中建立新項目
    voiceMessages.items.set(id, {
      id,
      element,
      durationMs,
      downloadUrl: null,
      lastModified: null,
      timestamp: Date.now()
    });
    
    return id;
  }
}

/**
 * 註冊下載 URL
 * 
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {number} durationMs - 持續時間（毫秒）
 * @param {string} downloadUrl - 下載 URL
 * @param {string} [lastModified] - Last-Modified 標頭值
 * @returns {string} - 語音訊息 ID
 */
export function registerDownloadUrl(voiceMessages, durationMs, downloadUrl, lastModified = null) {
  // 檢查是否有匹配此持續時間的元素
  for (const [id, item] of voiceMessages.items.entries()) {
    if (isDurationMatch(item.durationMs, durationMs)) {
      // 如果有匹配元素，更新它的 downloadUrl 和 lastModified
      item.downloadUrl = downloadUrl;
      if (lastModified) {
        item.lastModified = lastModified;
      }
      return id;
    }
  }
  
  // 如果沒有匹配元素，創建一個待處理項目
  const id = generateVoiceMessageId();
  
  // 在 voiceMessages.items 中建立新項目
  voiceMessages.items.set(id, {
    id,
    element: null,
    durationMs,
    downloadUrl,
    lastModified,
    timestamp: Date.now(),
    isPending: true  // 使用屬性標記狀態
  });
  
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
  if (!element) return null;
  
  // 檢查元素是否有 data-voice-message-id 屬性
  const id = element.getAttribute('data-voice-message-id');
  
  if (id && voiceMessages.items.has(id)) {
    // 如果有 ID 且在 items 中存在，直接返回
    const item = voiceMessages.items.get(id);
    return {
      downloadUrl: item.downloadUrl,
      lastModified: item.lastModified
    };
  }
  
  // 如果沒有 ID 或 ID 不存在，返回 null
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
