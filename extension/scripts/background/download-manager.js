/**
 * download-manager.js
 * 負責處理下載功能
 */

import { generateVoiceMessageFilename } from '../utils/time-utils.js';

// 儲存最後一次右鍵點擊的資訊
let lastRightClickedInfo = null;

/**
 * 初始化下載管理器
 */
export function initDownloadManager() {
  console.log('初始化下載管理器');
  
  // 監聽右鍵選單點擊事件
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'downloadVoiceMessage' && lastRightClickedInfo) {
      downloadVoiceMessage(
        lastRightClickedInfo.downloadUrl,
        lastRightClickedInfo.lastModified
      );
    }
  });
}

/**
 * 設置最後一次右鍵點擊的資訊
 * 
 * @param {Object} info - 右鍵點擊資訊
 */
export function setLastRightClickedInfo(info) {
  lastRightClickedInfo = info;
  
  console.log('設置最後一次右鍵點擊的資訊', lastRightClickedInfo);
}

/**
 * 下載語音訊息
 * 
 * @param {string} url - 下載 URL
 * @param {string} [lastModified] - Last-Modified 標頭值
 */
export function downloadVoiceMessage(url, lastModified) {
  if (!url) {
    console.error('下載 URL 無效');
    return;
  }
  
  // 生成檔案名稱
  const filename = `${generateVoiceMessageFilename(lastModified)}.mp4`;
  
  // 使用 Chrome 下載 API 下載檔案
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('下載失敗', chrome.runtime.lastError);
    } else {
      console.log('下載成功', downloadId);
    }
  });
  
  console.log('開始下載語音訊息', {
    url,
    filename
  });
}
