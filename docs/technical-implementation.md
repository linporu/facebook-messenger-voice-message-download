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

1. 初始化：
   - 建立 audioMap 用於儲存持續時間和 URL 的對應關係
   - 建立 voiceMessageRegistry 使用 Map 數據結構追蹤所有語音訊息元素

2. 偵測語音訊息元素：
   - 主要方法：尋找具有 role="slider" 和 aria-label="音訊滑桿" 的元素
   - 次要方法：尋找具有 role="button" 和 aria-label="播放" 的元素
   - 對每個找到的元素：
     * 標記為語音訊息元素（data-voice-message-element="true"）
     * 從 aria-valuemax 屬性提取持續時間（秒）
     * 如果持續時間是有效數字：
       - 將秒轉換為毫秒
       - 為元素生成唯一 ID（如果尚未有）：voice-msg-{timestamp}-{隨機字串}
       - 將元素註冊到 voiceMessageRegistry 中

3. 設置 MutationObserver 偵測動態載入的內容：
   - 監聽 document.body 的變化
   - 當有新節點添加時，執行語音訊息偵測函數
   - 設置監聽選項：childList=true, subtree=true

4. 攔截網路請求以獲取音訊 URL：
   - 代理 window.fetch 函數
   - 檢查請求 URL 是否包含 ".mp4" 和 "audioclip"
   - 從 content-disposition 標頭中提取持續時間
   - 格式範例：attachment; filename=audioclip-1742393117000-30999.mp4
   - 上述正確的持續時間為 .mp4 前面的 30999（毫秒）
   - 將持續時間（毫秒）和 URL 存入 audioMap

5. 處理右鍵點擊事件：
   - 監聽 document 的 contextmenu 事件
   - 當事件觸發時：
     * 記錄實際點擊的元素（event.target）
     * 從事件目標開始向上遍歷 DOM 樹：
       - 檢查當前元素是否有 data-voice-message-element="true" 屬性
       - 檢查元素是否匹配 div[role="slider"][aria-label="音訊滑桿"]
       - 檢查元素是否在語音訊息容器內（使用 closest 方法）
       - 如果找到匹配元素，記錄並停止遍歷
       - 否則移動到父元素繼續檢查
     * 如果找到語音訊息元素：
       - 從 aria-valuemax 屬性提取持續時間（秒）
       - 轉換為毫秒以用於查找對應的 URL
       - 從 audioMap 中查找對應的下載 URL
       - 發送訊息到背景腳本，包含：
         - action: 'rightClickOnVoiceMessage'
         - durationMs: 持續時間（毫秒）
         - elementId: 元素 ID
         - downloadUrl: 下載 URL

6. 初始化腳本：
   - 執行語音訊息偵測
   - 設置 MutationObserver
   - 設置網路請求攔截
   - 在 DOM 完全載入時啟動
```

### 3. 背景腳本 (background.js)

背景腳本負責：

1. 建立和管理右鍵選單
2. 當選單項被點擊時啟動下載

```
偽代碼：

1. 初始化右鍵選單：
   - 在擴充功能安裝時建立右鍵選單項
   - 設置選單項屬性：
     * id: 'downloadVoiceMessage'
     * title: 'Download Voice Message'
     * contexts: ['all']
     * documentUrlPatterns: ['*://*.facebook.com/*', '*://*.messenger.com/*']
     * visible: false  // 初始不可見

2. 儲存右鍵點擊資訊：
   - 建立 lastRightClickedInfo 變數儲存右鍵點擊的語音訊息資訊

3. 監聽來自內容腳本的訊息：
   - 當收到 action='rightClickOnVoiceMessage' 訊息時：
     * 儲存訊息中的資訊（tabId, durationMs, elementId, downloadUrl）
     * 如果有有效的 downloadUrl，將右鍵選單項設為可見
     * 否則記錄找不到下載 URL 的訊息

4. 處理右鍵選單關閉事件：
   - 當右鍵選單關閉時，將選單項再次設為不可見
   - 清除儲存的右鍵點擊資訊

5. 處理右鍵選單點擊事件：
   - 當選單項 'downloadVoiceMessage' 被點擊且有有效的 lastRightClickedInfo 時：
     * 生成包含時間戳和持續時間的檔案名稱
     * 格式：voice-message-{timestamp}-{durationMs}ms.mp4
     * 使用 chrome.downloads.download API 下載檔案
     * 設置下載參數：
       - url: 下載 URL
       - filename: 生成的檔案名稱
       - saveAs: false（可設為 true 讓用戶選擇儲存位置）
     * 記錄下載訊息或錯誤訊息
```

## Implementation Challenges and Solutions

### 1. Network Request Interception

**Challenge**: Capturing MP4 URLs from network requests without using webRequest API (which has limitations in Manifest V3).

**Solution**: Use a fetch proxy in the content script to intercept requests and extract audio file URLs and durations.

### 2. Mapping Voice Message UI to Download URLs

**Challenge**: Reliably connecting the UI element (with duration in seconds) to the correct download URL (with duration in milliseconds).

**Solution**: Create a mapping system that:

1. Extracts duration from the filename in the content-disposition header
2. Stores the URL with the duration as key
3. When a user right-clicks, converts the aria-valuemax (seconds) to milliseconds and looks up the URL

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
