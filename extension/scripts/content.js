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
      console.log('[DEBUG-CONTENT] 收到主模組訊息，轉發到背景腳本:', event.data.message);
      chrome.runtime.sendMessage(event.data.message, function(response) {
        console.log('[DEBUG-CONTENT] 背景腳本回應:', response);
      });
    }
  });
  
  // 將來自背景腳本的訊息轉發到主模組
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('[DEBUG-CONTENT] 收到背景腳本訊息，轉發到主模組:', message);
    window.postMessage({
      type: 'FROM_VOICE_MESSAGE_DOWNLOADER_BACKGROUND',
      message: message
    }, '*');
    return true;
  });
  
  console.log('Facebook Messenger 語音訊息下載器已初始化');
}