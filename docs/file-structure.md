# Facebook Messenger Voice Message Downloader - 檔案結構

以下是建議的檔案結構，將上傳到 Chrome Web Store 的檔案與開發/測試檔案分開：

```
facebook-messenger-voice-message-download/
├── extension/                  # 要上傳到 Chrome Web Store 的檔案
│   ├── manifest.json           # 擴充功能配置
│   ├── background.js           # 背景腳本
│   ├── scripts/
│   │   └── content.js   # 內容腳本
│   ├── popup/                  # 選擇性的彈出視窗
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── assets/
│       └── icons/              # 擴充功能圖示
│           ├── icon16.png
│           ├── icon48.png
│           ├── icon128.png
│           └── icon512.png     # Chrome Web Store 需要的大尺寸圖示
│
├── docs/                       # 文件
│   ├── prd.md                  # 產品需求文件
│   └── technical-implementation.md  # 技術實現文件
│
├── tests/                      # 測試檔案
│   ├── unit/                   # 單元測試
│   │   ├── voice-detector.test.js
│   │   └── background.test.js
│   ├── integration/            # 整合測試
│   │   └── extension.test.js
│   └── jest.config.js          # Jest 配置
│
├── scripts/                    # 開發和建置腳本
│   ├── build.js                # 建置腳本
│   ├── dev.js                  # 開發腳本
│   └── package.js              # 打包腳本
│
├── .gitignore                  # Git 忽略檔案
├── package.json                # npm 配置
├── README.md                   # 專案說明
└── LICENSE                     # 授權資訊
```

## 檔案結構說明

### extension/ 目錄

這個目錄包含所有需要上傳到 Chrome Web Store 的檔案。當你準備發布擴充功能時，只需壓縮這個目錄的內容即可。

### docs/ 目錄

包含所有文件，如產品需求文件、技術實現文件等。這些檔案不會上傳到 Chrome Web Store。

### tests/ 目錄

包含所有測試相關的檔案，包括單元測試和整合測試。使用 Jest 作為測試框架。

### scripts/ 目錄

包含開發、建置和打包腳本，用於自動化開發流程。

## 建置和發布流程

1. **開發流程**：

   ```bash
   npm run dev
   ```

   這將啟動開發模式，監視檔案變化並自動重新載入擴充功能。

2. **測試流程**：

   ```bash
   npm test
   ```

   運行所有測試，確保擴充功能正常運作。

3. **建置流程**：

   ```bash
   npm run build
   ```

   這將建置擴充功能，優化程式碼並產生最終版本。

4. **打包流程**：
   ```bash
   npm run package
   ```
   這將壓縮 `extension/` 目錄的內容，產生可上傳到 Chrome Web Store 的 zip 檔案。

## package.json 配置

```json
{
  "name": "facebook-messenger-voice-message-download",
  "version": "1.0.0",
  "description": "Download voice messages from Facebook Messenger with a simple right-click",
  "scripts": {
    "dev": "node scripts/dev.js",
    "build": "node scripts/build.js",
    "package": "node scripts/package.js",
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "archiver": "^5.3.1",
    "fs-extra": "^11.1.1"
  },
  "private": true
}
```

## 優點

1. **清晰分離**：開發檔案與發布檔案明確分開
2. **簡化上傳**：發布時只需壓縮 `extension/` 目錄
3. **易於維護**：文件和測試有各自的目錄，便於管理
4. **自動化流程**：透過腳本自動化開發、測試和發布流程
