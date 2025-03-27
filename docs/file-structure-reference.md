### 3. 主要模組功能

#### 3.1 內容腳本 (content.js)

```javascript
// content.js - 主要入口點，負責初始化和協調
import {
  initDomDetector,
  detectVoiceMessages,
} from "./voice-detector/dom-detector.js";
import { initNetworkInterceptor } from "./voice-detector/network-interceptor.js";
import { initContextMenuHandler } from "./voice-detector/context-menu-handler.js";
import { createDataStore } from "./voice-detector/data-store.js";

// 初始化資料存儲
const voiceMessages = createDataStore();

// 初始化各模組
document.addEventListener("DOMContentLoaded", () => {
  // 初始化 DOM 偵測器
  initDomDetector(voiceMessages);

  // 初始化網路請求攔截
  initNetworkInterceptor(voiceMessages);

  // 初始化右鍵選單處理
  initContextMenuHandler(voiceMessages);

  // 執行初始偵測
  detectVoiceMessages();

  console.log("Facebook Messenger 語音訊息下載器已啟動");
});
```

#### 3.2 資料存儲 (data-store.js)

```javascript
// data-store.js - 負責管理語音訊息資料
import { generateVoiceMessageId } from "../utils/id-generator.js";

export function createDataStore() {
  return {
    byId: new Map(),
    byDuration: new Map(),

    // 註冊語音訊息元素
    registerVoiceMessageElement(element, durationSec) {
      // 實作...
    },

    // 註冊下載 URL
    registerDownloadUrl(durationMs, url, lastModified) {
      // 實作...
    },

    // 尋找待處理項目
    findPendingItemByDuration(durationMs) {
      // 實作...
    },

    // 根據元素獲取下載 URL
    getDownloadInfoForElement(element) {
      // 實作...返回 {downloadUrl, lastModified}
    },
  };
}
```

#### 3.3 DOM 偵測器 (dom-detector.js)

```javascript
// dom-detector.js - 負責偵測 DOM 中的語音訊息元素
import { extractDurationFromElement } from "../utils/dom-utils.js";

let voiceMessages;

export function initDomDetector(dataStore) {
  voiceMessages = dataStore;
  setupMutationObserver();
}

export function detectVoiceMessages() {
  // 實作語音訊息偵測邏輯...
}

function setupMutationObserver() {
  // 實作 MutationObserver 設置...
}

function processVoiceMessageElement(element) {
  // 處理單個語音訊息元素...
}
```

#### 3.4 網路攔截器 (network-interceptor.js)

```javascript
// network-interceptor.js - 負責攔截網路請求
import { parseLastModified } from "../utils/time-utils.js";

let voiceMessages;

export function initNetworkInterceptor(dataStore) {
  voiceMessages = dataStore;
  setupFetchProxy();
}

function setupFetchProxy() {
  // 代理 fetch 函數...
}

function extractDurationFromContentDisposition(header) {
  // 從 content-disposition 提取持續時間...
}

function processAudioResponse(url, response) {
  // 處理音訊回應...
}
```

#### 3.5 右鍵選單處理 (context-menu-handler.js)

```javascript
// context-menu-handler.js - 負責處理右鍵選單事件
import { findVoiceMessageElement } from "../utils/dom-utils.js";

let voiceMessages;

export function initContextMenuHandler(dataStore) {
  voiceMessages = dataStore;
  setupContextMenuListener();
}

function setupContextMenuListener() {
  // 設置右鍵選單監聽器...
}

function handleContextMenu(event) {
  // 處理右鍵選單事件...
}

function sendRightClickInfo(element, downloadInfo) {
  // 發送右鍵點擊資訊到背景腳本...
}
```

#### 3.6 背景腳本 (background.js)

```javascript
// background.js - 主要背景腳本
import { initMenuManager } from "./background/menu-manager.js";
import { initDownloadManager } from "./background/download-manager.js";
import { initMessageHandler } from "./background/message-handler.js";

// 初始化右鍵選單管理
const menuManager = initMenuManager();

// 初始化下載管理
const downloadManager = initDownloadManager();

// 初始化訊息處理
initMessageHandler(menuManager, downloadManager);

console.log("Facebook Messenger 語音訊息下載器背景腳本已啟動");
```

### 4. 輔助函數模組

#### 4.1 DOM 輔助函數 (dom-utils.js)

```javascript
// dom-utils.js - DOM 操作輔助函數
export function extractDurationFromElement(element) {
  // 從元素提取持續時間...
}

export function findVoiceMessageElement(targetElement) {
  // 尋找語音訊息元素...
}

export function isVoiceMessageElement(element) {
  // 檢查元素是否為語音訊息元素...
}
```

#### 4.2 時間輔助函數 (time-utils.js)

```javascript
// time-utils.js - 時間處理輔助函數
export function parseLastModified(lastModifiedHeader) {
  // 解析 last-modified 標頭...
}

export function formatDateForFilename(date) {
  // 格式化日期為檔案名稱...
}
```

#### 4.3 ID 生成輔助函數 (id-generator.js)

```javascript
// id-generator.js - ID 生成輔助函數
export function generateVoiceMessageId() {
  // 生成語音訊息 ID...
}
```
