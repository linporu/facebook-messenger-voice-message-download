# Facebook Messenger Voice Message Downloader - Technical Implementation

本文檔概述了 Facebook Messenger 語音訊息下載 Chrome 擴充功能的技術實現細節。

## 架構概覽

擴充功能遵循標準的 Chrome 擴充功能架構，符合 Manifest V3 規範：

```
facebook-messenger-voice-message-download/
├── extension/                  # 要上傳到 Chrome Web Store 的檔案
│   ├── manifest.json           # 擴充功能配置
│   ├── background.js           # 背景腳本
│   ├── content-scripts/
│   │   └── voice-detector.js   # 內容腳本
│   └── assets/
│       └── icons/              # 擴充功能圖示
├── docs/                       # 文件
├── tests/                      # 測試檔案
└── scripts/                    # 開發和建置腳本
```

### 1. 內容腳本部分

```
extension/scripts/
├── content.js                  # 主要內容腳本，負責初始化和協調
├── voice-detector/
│   ├── dom-detector.js         # DOM 元素偵測相關功能
│   ├── network-interceptor.js  # 網路請求攔截相關功能
│   ├── context-menu-handler.js # 右鍵選單處理相關功能
│   └── data-store.js           # 資料存儲和管理
└── utils/
    ├── dom-utils.js            # DOM 操作輔助函數
    ├── time-utils.js           # 時間處理輔助函數
    └── id-generator.js         # ID 生成輔助函數
```

### 2. 背景腳本部分

```
extension/
├── background.js               # 主要背景腳本，負責初始化和協調
└── background/
    ├── menu-manager.js         # 右鍵選單管理
    ├── download-manager.js     # 下載處理
    └── message-handler.js      # 訊息處理
```

## 核心組件

### 1. Manifest 配置

Manifest 配置包含：

- manifest_version: 3
- 基本資訊（名稱、版本、描述）
- 權限：
  - contextMenus：用於添加右鍵選單
  - downloads：用於下載檔案
  - activeTab：用於訪問當前頁面
- 主機權限：facebook.com 和 messenger.com
- 背景腳本：background.js
- 內容腳本：voice-detector.js（匹配 facebook.com 和 messenger.com）
- 圖示：多種尺寸

### 2. 語音訊息偵測 (content-scripts/voice-detector.js)

內容腳本負責：

1. 偵測 DOM 中的語音訊息元素
2. 監控 MP4 檔案的網路請求
3. 建立音訊持續時間與下載 URL 的對應關係
4. 處理語音訊息元素的右鍵點擊事件

```
偽代碼：

1. 初始化 (content.js)：
   - 導入所需模組：
     * import { initDomDetector, detectVoiceMessages } from './voice-detector/dom-detector.js';
     * import { initNetworkInterceptor } from './voice-detector/network-interceptor.js';
     * import { initContextMenuHandler } from './voice-detector/context-menu-handler.js';
     * import { createDataStore } from './voice-detector/data-store.js';
   - 建立單一資料結構 voiceMessages = createDataStore()：
     * items: 以元素 ID 為鍵的 Map，儲存完整語音訊息資料
     * isDurationMatch: 判斷兩個持續時間是否在容忍度範圍內匹配的輔助函數

2. 偵測語音訊息元素 (dom-detector.js)：
   - 導出函數：
     * export function initDomDetector(voiceMessages)
     * export function detectVoiceMessages(voiceMessages)
   - 主要方法：尋找具有 role="slider" 和 aria-label="音訊滑桿" 的元素
   - 次要方法：尋找具有 role="button" 和 aria-label="播放" 的元素
   - 對每個找到的元素：
     * 標記為語音訊息元素（data-voice-message-element="true"）
     * 從 aria-valuemax 屬性提取持續時間（秒）
     * 如果持續時間是有效數字：
       - 將秒轉換為毫秒
       - 檢查元素是否已經有 data-voice-message-id 屬性
       - 如果沒有 ID：
         * 先檢查 voiceMessages 中是否有待處理的項目匹配此持續時間（使用 isDurationMatch 函數）
         * 如果有待處理項目：
           - 取得待處理項目的 ID 和下載 URL
           - 將待處理項目的 ID 設置為元素的 data-voice-message-id 屬性
           - 更新待處理項目，將 element 設置為當前元素，移除 isPending 標記
         * 如果沒有待處理項目：
           - 為元素生成唯一 ID：voice-msg-{timestamp}-{隨機字串}
           - 將 ID 設置為元素的 data-voice-message-id 屬性
           - 呼叫 registerVoiceMessageElement 函數：
             * 在 voiceMessages.items 中建立新項目，包含：
               - element: DOM 元素參考
               - durationMs: 持續時間（毫秒，從秒轉換而來）
               - downloadUrl: null（尚未知道）
               - timestamp: 當前時間戳

3. 設置 MutationObserver 偵測動態載入的內容 (dom-detector.js)：
   - 在 initDomDetector 函數中實現
   - 監聽 document.body 的變化
   - 當有新節點添加時，執行 detectVoiceMessages 函數
   - 設置監聽選項：childList=true, subtree=true

4. 攔截網路請求以獲取音訊 URL (network-interceptor.js)：
   - 導出函數：
     * export function initNetworkInterceptor(voiceMessages)
   - 代理 window.fetch 函數
   - 檢查請求 URL 是否包含 ".mp4" 和 "audioclip"
   - 從回應標頭中提取重要資訊：
     * content-disposition：提取持續時間
     * 格式範例：attachment; filename=audioclip-1742393117000-30999.mp4
     * 上述正確的持續時間為 .mp4 前面的 30999（毫秒）
     * last-modified：提取語音訊息的建立時間
     * 格式範例：Wed, 19 Mar 2025 14:04:40 GMT
   - 呼叫 registerDownloadUrl 函數：
     * 使用 isDurationMatch 函數檢查 voiceMessages.items 中是否有匹配此持續時間的元素
     * 如果有匹配元素：
       - 更新匹配元素的 downloadUrl 和 lastModified 屬性
     * 如果沒有匹配元素：
       - 生成唯一 ID：voice-msg-{timestamp}-{隨機字串}
       - 建立一個待處理項目，包含：
         * element: null
         * durationMs: 持續時間（毫秒）
         * downloadUrl: 下載 URL
         * timestamp: 當前時間戳
         * lastModified: 語音訊息的建立時間（從 last-modified 標頭提取）
         * isPending: true  // 使用屬性標記狀態
       - 將待處理項目加入 items 索引中

5. 處理右鍵點擊事件 (context-menu-handler.js)：
   - 導出函數：
     * export function initContextMenuHandler(voiceMessages)
   - 監聽 document 的 contextmenu 事件
   - 當事件觸發時：
     * 記錄實際點擊的元素（event.target）
     * 使用自上而下的查找策略尋找語音訊息元素：
       - 檢查點擊元素自身是否為語音訊息元素（已標記或有特定屬性）
       - 在點擊元素內部查找語音訊息相關元素：
         * 查找 div[role="slider"][aria-label="音訊滑桿"]
         * 查找 div[role="button"][aria-label="播放"] 包含特定 SVG 路徑
       - 如果在內部找不到，再向上遍歷 DOM 樹尋找可能的容器元素
       - 對每個潛在容器元素，向下查找語音訊息相關元素
       - 如果以上方法都失敗，嘗試基於位置的查找（尋找頁面上最接近點擊位置的語音訊息元素）
     * 如果找到語音訊息元素：
       - 檢查元素是否有 data-voice-message-id 屬性
       - 如果有 ID，直接從 voiceMessages.byId 獲取資料
       - 如果沒有 ID：
         * 從 aria-valuemax 屬性提取持續時間（秒）
         * 轉換為毫秒
         * 使用 isDurationMatch 函數在 voiceMessages.items 中查找匹配的元素
         * 如果有多個匹配，選擇時間戳最近的
       - 取得下載 URL 和 lastModified 資訊
       - 發送訊息到背景腳本，包含：
         - action: 'rightClickOnVoiceMessage'
         - elementId: 元素 ID
         - downloadUrl: 下載 URL
         - lastModified: 語音訊息的建立時間（如果有）

6. 輔助函數：
   - findVoiceMessageElement(clickedElement) (context-menu-handler.js)：
     * 使用多種方法尋找語音訊息元素
     * 先在點擊元素內部向下查找
     * 如果失敗，再向上遍歷 DOM 樹
     * 最後嘗試基於位置的查找
     * 返回找到的語音訊息元素或 null

   - isPotentialVoiceMessageContainer(element) (context-menu-handler.js)：
     * 檢查元素是否為潛在的語音訊息容器
     * 檢查特定的類別組合和元素特徵
     * 返回布林值表示是否為潛在容器

   - getSliderElement(element) (context-menu-handler.js)：
     * 從元素獲取滑桿元素
     * 如果元素自身是滑桿，直接返回
     * 如果是播放按鈕，查找相關的滑桿
     * 在元素內部查找滑桿

   - isDurationMatch(duration1Ms, duration2Ms, toleranceMs = 5) (data-store.js)：
     * 判斷兩個持續時間是否在容忍度範圍內匹配
     * 計算兩個持續時間的差值，檢查是否小於等於容忍度
     * 返回布林值表示是否匹配
   - registerVoiceMessageElement(element, durationSec) (data-store.js)：
     * 註冊語音訊息元素
     * 將秒轉換為毫秒
     * 建立元素資料並更新索引
   - registerDownloadUrl(durationMs, url, lastModified) (data-store.js)：
     * 註冊下載 URL
     * 使用 isDurationMatch 函數尋找匹配元素
     * 如果有匹配元素，直接更新元素的 downloadUrl 和 lastModified
     * 如果沒有匹配元素，建立待處理項目並標記為 isPending
   - findItemByDuration(durationMs, toleranceMs = 5) (data-store.js)：
     * 遍歷 items 中的所有項目，使用 isDurationMatch 函數尋找匹配項
     * 返回匹配項或 null
   - findPendingItemByDuration(durationMs, toleranceMs = 5) (data-store.js)：
     * 遍歷 items 中的所有項目，使用 isDurationMatch 函數尋找匹配的待處理項目
     * 返回待處理項目或 null
   - getDownloadInfoForElement(element) (data-store.js)：
     * 根據元素的 data-voice-message-id 屬性查找對應的項目
     * 返回下載 URL 和 lastModified 資訊

7. 初始化腳本 (content.js)：
   - 建立 voiceMessages 資料結構：const voiceMessages = createDataStore();
   - 執行語音訊息偵測：initDomDetector(voiceMessages);
   - 設置網路請求攔截：initNetworkInterceptor(voiceMessages);
   - 設置右鍵選單處理：initContextMenuHandler(voiceMessages);
   - 在 DOM 完全載入時啟動：document.addEventListener('DOMContentLoaded', ...);
```

### 3. 背景腳本 (background.js)

背景腳本負責：

1. 建立和管理右鍵選單
2. 當選單項被點擊時啟動下載

```
偽代碼：

1. 初始化右鍵選單 (menu-manager.js)：
   - 導出函數：
     * export function initContextMenu()
     * export function updateContextMenuVisibility(visible)
   - 在擴充功能安裝時建立右鍵選單項
   - 設置選單項屬性：
     * id: 'downloadVoiceMessage'
     * title: 'Download Voice Message'
     * contexts: ['all']
     * documentUrlPatterns: ['*://*.facebook.com/*', '*://*.messenger.com/*']
     * visible: false  // 初始不可見

2. 儲存右鍵點擊資訊 (background.js)：
   - 建立 lastRightClickedInfo 變數儲存右鍵點擊的語音訊息資訊

3. 監聽來自內容腳本的訊息 (message-handler.js)：
   - 導出函數：
     * export function initMessageHandler()
   - 當收到 action='rightClickOnVoiceMessage' 訊息時：
     * 儲存訊息中的資訊（tabId, elementId, downloadUrl, lastModified）
     * 如果有有效的 downloadUrl，將右鍵選單項設為可見 (使用 menu-manager.js 的 updateContextMenuVisibility)
     * 否則記錄找不到下載 URL 的訊息

4. 處理右鍵選單關閉事件 (menu-manager.js)：
   - 當右鍵選單關閉時，將選單項再次設為不可見 (使用 updateContextMenuVisibility(false))
   - 清除儲存的右鍵點擊資訊

5. 處理右鍵選單點擊事件 (download-manager.js)：
   - 導出函數：
     * export function initDownloadManager()
     * export function downloadVoiceMessage(url, lastModified)
   - 當選單項 'downloadVoiceMessage' 被點擊且有有效的 lastRightClickedInfo 時：
     * 呼叫 downloadVoiceMessage 函數，傳入 URL 和 lastModified
     * 生成有意義的檔案名稱，優先使用 lastModified 時間（如果有）：
       - 如果有 lastModified：
         * 解析 lastModified 字串為日期物件
         * 格式化為 YYYY-MM-DD-HH-mm-ss 格式
         * 生成檔名：voice-message-{YYYY-MM-DD-HH-mm-ss}.mp4
       - 如果沒有 lastModified：
         * 使用當前時間戳
         * 格式化為 YYYY-MM-DD-HH-mm-ss 格式
         * 生成檔名：voice-message-{YYYY-MM-DD-HH-mm-ss}.mp4
     * 使用 chrome.downloads.download API 下載檔案
     * 設置下載參數：
       - url: 下載 URL
       - filename: 生成的檔案名稱
       - saveAs: false
     * 記錄下載訊息或錯誤訊息
```

## Implementation Challenges and Solutions

### 1. Network Request Interception

**Challenge**: Capturing MP4 URLs from network requests without using webRequest API (which has limitations in Manifest V3).

**Solution**: Use a fetch proxy in the content script to intercept requests and extract audio file URLs and durations.

### 2. Mapping Voice Message UI to Download URLs

**Challenge**: Reliably connecting the UI element (with duration in seconds) to the correct download URL (with duration in milliseconds).

**Solution**: 使用單一資料結構設計：

1. 建立 voiceMessages 資料結構，包含兩個索引：
   - byId：以元素 ID 為鍵，儲存完整語音訊息資料
   - byDuration：以持續時間為鍵，儲存元素 ID 集合
2. 當偵測到語音訊息元素時，註冊到資料結構並檢查是否有待處理的 URL
3. 當攔截到網路請求時，註冊 URL 並檢查是否有匹配的元素
4. 處理時序獨立性，不論元素或 URL 先被發現都能正確匹配

### 3. Dynamic Content Loading

**Challenge**: Facebook loads content dynamically as users scroll through conversations.

**Solution**: Use MutationObserver to detect when new voice messages are added to the DOM.

### 4. UI Changes Resilience

**Challenge**: Facebook may change their UI structure, breaking the detection mechanism.

**Solution**: Implement multiple detection methods:

1. Primary: Find elements with role="slider" and aria-label="音訊滑桿"
2. Secondary: Find elements with role="button" and aria-label="播放" with specific SVG path

### 5. Precise UI Element Recognition and Multiple Voice Messages Handling

**Challenge**:

- Accurately identifying which specific voice message UI element the user is right-clicking on
- Distinguishing between multiple voice messages on the page, especially if they have similar durations

**Solution**:

- Implement a sophisticated DOM traversal approach that starts from the clicked element and moves up the DOM tree
- Create a registry system (voiceMessageRegistry) to track all voice message elements with unique IDs
- Store duration information for accurate mapping between UI elements and download URLs
- Dynamically control context menu visibility to show the download option only when right-clicking on valid voice messages

## Testing Strategy

### Unit Tests

Use Jest for unit testing:

```
偽代碼：

// 持續時間提取測試
測試案例：從 content-disposition 標頭提取持續時間
  輸入：'attachment; filename=audioclip-1742393117000-30999.mp4'
  執行：extractDurationFromHeader(輸入)
  期望結果：30999
```

### Integration Tests

Test the extension on both facebook.com and messenger.com:

1. Verify voice message detection
2. Confirm context menu appears when right-clicking on voice messages
3. Validate download functionality

### Manual Testing Checklist

- [ ] Extension loads correctly on Facebook and Messenger
- [ ] Voice messages are detected in various conversation layouts
- [ ] Context menu appears only when right-clicking on voice messages
- [ ] Downloaded files play correctly
- [ ] Extension works with different voice message durations
- [ ] Performance impact is minimal

## Security Considerations

1. **Permissions**: The extension uses minimal permissions required for functionality
2. **Data Handling**: All processing happens locally, no data is sent to external servers
3. **URL Validation**: Ensure downloaded URLs are legitimate Facebook audio files
4. **Content Security Policy**: Implement appropriate CSP in manifest.json

## Performance Optimization

1. **Efficient DOM Traversal**: Use specific selectors to minimize DOM searching
2. **Throttled Observers**: Implement throttling for MutationObserver to reduce CPU usage
3. **Memory Management**: Clear audioMap entries for old conversations to prevent memory leaks

## Browser Compatibility

The extension is designed for Chrome but could be adapted for:

- Firefox (with minimal changes to manifest.json)
- Edge (fully compatible with Chrome extensions)
- Opera (based on Chromium, should be compatible)

## Future Technical Enhancements

1. **IndexedDB Storage**: Store URL mappings in IndexedDB for persistence across page reloads
2. **Web Audio API Integration**: Add audio processing capabilities for format conversion
3. **Network Request Batching**: Optimize network request handling for multiple voice messages
4. **Service Worker Improvements**: Enhance background script capabilities within Manifest V3 constraints
5. **模組化重構**: 將程式碼重構為更小、更專注的模組，提高可維護性和可測試性