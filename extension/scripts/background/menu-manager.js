/**
 * menu-manager.js
 * 負責管理右鍵選單
 */

/**
 * 初始化右鍵選單
 */
export function initMenuManager() {
  console.log('初始化右鍵選單管理器');
  
  // 創建右鍵選單項目
  chrome.contextMenus.create({
    id: 'downloadVoiceMessage',
    title: '下載語音訊息',
    contexts: ['all'],
    documentUrlPatterns: [
      '*://*.facebook.com/*',
      '*://*.messenger.com/*'
    ]
  });
  
  // 監聽右鍵選單點擊事件
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'downloadVoiceMessage') {
      handleMenuClick(info, tab);
    }
  });
}

/**
 * 處理右鍵選單點擊事件
 * 
 * @param {Object} info - 選單資訊
 * @param {chrome.tabs.Tab} tab - 標籤頁資訊
 */
function handleMenuClick(info, tab) {
  console.log('右鍵選單點擊', info, tab);
  
  // 這裡不需要做任何事情，因為我們已經在 lastRightClickedInfo 中保存了下載資訊
  // 實際的下載邏輯在 download-manager.js 中處理
}
