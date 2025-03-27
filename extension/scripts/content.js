/**
 * content.js
 * 主要內容腳本，負責初始化和協調其他模組
 */

// 檢查是否在支援的網站上
const isSupportedSite = (
  window.location.hostname.includes('facebook.com') || 
  window.location.hostname.includes('messenger.com')
);

if (!isSupportedSite) {
  console.log('不支援的網站，擴充功能不會啟動');
} else {
  // 創建主模組腳本標籤
  const script = document.createElement('script');
  script.type = 'module';
  script.src = chrome.runtime.getURL('scripts/main-module.js');
  script.onload = function() {
    console.log('Facebook Messenger 語音訊息下載器已載入主模組');
    this.remove(); // 載入後移除腳本標籤
  };
  
  // 添加到頁面
  (document.head || document.documentElement).appendChild(script);
  
  // 設置訊息監聽器，處理腳本與背景腳本的通訊
  window.addEventListener('message', function(event) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) return;
    
    // 處理來自主模組的訊息
    if (event.data.type && event.data.type === 'FROM_VOICE_MESSAGE_DOWNLOADER') {
      chrome.runtime.sendMessage(event.data.message);
    }
  });
  
  // 將來自背景腳本的訊息轉發到主模組
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    window.postMessage({
      type: 'FROM_VOICE_MESSAGE_DOWNLOADER_BACKGROUND',
      message: message
    }, '*');
    return true;
  });
  
  console.log('Facebook Messenger 語音訊息下載器已初始化');
}