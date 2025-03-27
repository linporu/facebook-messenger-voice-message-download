/**
 * context-menu-handler.js
 * 負責處理右鍵選單事件
 */

import { findVoiceMessageElement, getDurationFromSlider, getSliderFromPlayButton } from '../utils/dom-utils.js';
import { secondsToMilliseconds } from '../utils/time-utils.js';
import { getDownloadUrlForElement } from './data-store.js';

/**
 * 初始化右鍵選單處理器
 * 
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function initContextMenuHandler(voiceMessages) {
  console.log('初始化右鍵選單處理器');
  
  // 監聽 contextmenu 事件
  document.addEventListener('contextmenu', (event) => {
    handleContextMenu(event, voiceMessages);
  });
}

/**
 * 處理右鍵選單事件
 * 
 * @param {MouseEvent} event - 滑鼠事件
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
function handleContextMenu(event, voiceMessages) {
  // 記錄實際點擊的元素
  const clickedElement = event.target;
  
  // 尋找語音訊息元素
  const result = findVoiceMessageElement(clickedElement);
  
  if (!result) {
    // 如果找不到語音訊息元素，不做任何處理
    return;
  }
  
  const { element, type } = result;
  
  // 根據元素類型獲取滑桿元素
  const sliderElement = type === 'slider' ? element : getSliderFromPlayButton(element);
  
  if (!sliderElement) {
    return;
  }
  
  // 檢查元素是否有 data-voice-message-id 屬性
  const id = sliderElement.getAttribute('data-voice-message-id');
  
  if (id) {
    // 如果有 ID，獲取下載 URL
    const urlInfo = getDownloadUrlForElement(voiceMessages, sliderElement);
    
    if (urlInfo && urlInfo.downloadUrl) {
      // 發送訊息到背景腳本
      sendRightClickMessage(id, urlInfo.downloadUrl, urlInfo.lastModified);
    }
  } else {
    // 如果沒有 ID，從滑桿元素獲取持續時間
    const durationSec = getDurationFromSlider(sliderElement);
    
    if (durationSec !== null) {
      // 將秒轉換為毫秒
      const durationMs = secondsToMilliseconds(durationSec);
      
      // 在 voiceMessages 中查找匹配的項目
      for (const [itemId, item] of voiceMessages.items.entries()) {
        if (voiceMessages.isDurationMatch(item.durationMs, durationMs) && item.downloadUrl) {
          // 發送訊息到背景腳本
          sendRightClickMessage(itemId, item.downloadUrl, item.lastModified);
          break;
        }
      }
    }
  }
}

/**
 * 發送右鍵點擊訊息到背景腳本
 * 
 * @param {string} elementId - 元素 ID
 * @param {string} downloadUrl - 下載 URL
 * @param {string} [lastModified] - Last-Modified 標頭值
 */
function sendRightClickMessage(elementId, downloadUrl, lastModified) {
  // 準備訊息物件
  const message = {
    action: 'rightClickOnVoiceMessage',
    elementId,
    downloadUrl,
    lastModified
  };
  
  // 使用 window.sendToBackground 發送訊息
  if (window.sendToBackground) {
    window.sendToBackground(message);
  } else {
    // 如果沒有 sendToBackground 函數，則直接輸出訊息
    console.warn('無法發送訊息到背景腳本，sendToBackground 函數不存在');
  }
  
  console.log('發送右鍵點擊訊息', {
    elementId,
    downloadUrl,
    lastModified
  });
}
