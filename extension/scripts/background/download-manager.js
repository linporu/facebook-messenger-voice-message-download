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
  console.log('[DEBUG-BACKGROUND] 初始化下載管理器');
  
  // 監聽右鍵選單點擊事件
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('[DEBUG-BACKGROUND] 右鍵選單點擊:', {
      menuItemId: info.menuItemId,
      hasLastRightClickedInfo: !!lastRightClickedInfo
    });
    
    if (info.menuItemId === 'downloadVoiceMessage') {
      if (lastRightClickedInfo) {
        console.log('[DEBUG-BACKGROUND] 開始下載語音訊息:', {
          url: lastRightClickedInfo.downloadUrl ? lastRightClickedInfo.downloadUrl.substring(0, 50) + '...' : null,
          lastModified: lastRightClickedInfo.lastModified
        });
        downloadVoiceMessage(
          lastRightClickedInfo.downloadUrl,
          lastRightClickedInfo.lastModified
        );
      } else {
        console.error('[DEBUG-BACKGROUND] 無法下載，沒有右鍵點擊資訊');
      }
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
  
  console.log('[DEBUG-BACKGROUND] 設置最後一次右鍵點擊的資訊:', {
    elementId: info.elementId,
    downloadUrl: info.downloadUrl ? info.downloadUrl.substring(0, 50) + '...' : null,
    lastModified: info.lastModified,
    tabId: info.tabId
  });
}

/**
 * 下載語音訊息
 * 
 * @param {string} url - 下載 URL
 * @param {string} [lastModified] - Last-Modified 標頭值
 */
export function downloadVoiceMessage(url, lastModified) {
  console.log('[DEBUG-BACKGROUND] 下載語音訊息函數被調用');
  
  if (!url) {
    console.error('[DEBUG-BACKGROUND] 下載 URL 無效');
    return;
  }
  
  // 生成檔案名稱
  const filename = `${generateVoiceMessageFilename(lastModified)}.mp4`;
  console.log('[DEBUG-BACKGROUND] 生成的檔案名稱:', filename);
  
  // 使用 Chrome 下載 API 下載檔案
  console.log('[DEBUG-BACKGROUND] 準備調用 chrome.downloads.download API');
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[DEBUG-BACKGROUND] 下載失敗:', chrome.runtime.lastError);
    } else {
      console.log('[DEBUG-BACKGROUND] 下載成功, 下載 ID:', downloadId);
    }
  });
  
  console.log('[DEBUG-BACKGROUND] 開始下載語音訊息:', {
    url: url.substring(0, 50) + '...',
    filename
  });
}
