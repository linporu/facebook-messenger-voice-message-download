/**
 * main-module.js
 * 主要模組，負責初始化和協調其他模組
 * 這個檔案會以 ES6 模組的方式載入，可以使用 import/export 語法
 */

import { createDataStore, cleanupOldItems } from './voice-detector/data-store.js';
import { initDomDetector } from './voice-detector/dom-detector.js';
import { initNetworkInterceptor } from './voice-detector/network-interceptor.js';
import { initContextMenuHandler } from './voice-detector/context-menu-handler.js';

/**
 * 主要初始化函數
 */
function initialize() {
  console.log('初始化 Facebook Messenger 語音訊息下載器模組');
  
  // 檢查是否在支援的網站上
  const isSupportedSite = (
    window.location.hostname.includes('facebook.com') || 
    window.location.hostname.includes('messenger.com')
  );
  
  if (!isSupportedSite) {
    console.log('不支援的網站，擴充功能不會啟動');
    return;
  }
  
  // 創建語音訊息資料存儲
  const voiceMessages = createDataStore();
  
  // 初始化 DOM 偵測器
  initDomDetector(voiceMessages);
  
  // 初始化網路攔截器
  initNetworkInterceptor(voiceMessages);
  
  // 初始化右鍵選單處理器
  initContextMenuHandler(voiceMessages);
  
  // 設置定期清理過期項目
  setInterval(() => {
    cleanupOldItems(voiceMessages);
  }, 30 * 60 * 1000); // 每 30 分鐘清理一次
  
  // 設置訊息監聽器，處理與內容腳本的通訊
  window.addEventListener('message', function(event) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) return;
    
    // 處理來自內容腳本的訊息
    if (event.data.type && event.data.type === 'FROM_VOICE_MESSAGE_DOWNLOADER_BACKGROUND') {
      // 處理來自背景腳本的訊息
      const message = event.data.message;
      
      // 根據訊息類型處理
      if (message.action === 'someAction') {
        // 處理特定動作
      }
    }
  });
  
  // 向內容腳本發送訊息的輔助函數
  window.sendToBackground = function(message) {
    try {
      console.log('[DEBUG-MAIN] 準備發送訊息到背景腳本:', message);
      
      // 使用 postMessage 發送訊息
      window.postMessage({
        type: 'FROM_VOICE_MESSAGE_DOWNLOADER',
        message: message
      }, '*');
      
      console.log('[DEBUG-MAIN] 訊息已發送到背景腳本');
      return true;
    } catch (error) {
      console.error('[DEBUG-MAIN] 發送訊息到背景腳本時發生錯誤:', error);
      return false;
    }
  };
  
  console.log('Facebook Messenger 語音訊息下載器模組已啟動');
}

// 當 DOM 完全載入後初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
