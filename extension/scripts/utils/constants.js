/**
 * constants.js
 * 定義整個擴充功能共用的常數
 */

// 支援的網站
export const SUPPORTED_SITES = {
  PATTERNS: ["*://*.facebook.com/*", "*://*.messenger.com/*"],
  DOMAINS: ["facebook.com", "messenger.com"],
  CDN_PATTERNS: [
    "*://*.fbcdn.net/*",
    "*://*.cdninstagram.com/*",
    "*://*.fbsbx.com/*"
  ]
};

// 訊息類型
export const MESSAGE_TYPES = {
  FROM_CONTENT: "FROM_VOICE_MESSAGE_DOWNLOADER",
  FROM_BACKGROUND: "FROM_VOICE_MESSAGE_DOWNLOADER_BACKGROUND"
};

// 訊息動作
export const MESSAGE_ACTIONS = {
  RIGHT_CLICK: "rightClickOnVoiceMessage",
  REGISTER_ELEMENT: "registerVoiceMessageElement",
  DOWNLOAD_BLOB: "downloadBlobContent",
  REGISTER_BLOB_URL: "registerBlobUrl",
  BLOB_DETECTED: "blobUrlDetected",
  UPDATE_ELEMENT: "updateVoiceMessageElement",
  EXTRACT_BLOB: "extractBlobContent",
  CALCULATE_DURATION: "calculateBlobDuration"
};

// 檔案類型對應
export const FILE_EXTENSIONS = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".mp4",
  "video/mp4": ".mp4",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
  "default": ".bin"
};

// 時間常數 (毫秒)
export const TIME_CONSTANTS = {
  CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 分鐘
  AUDIO_LOAD_TIMEOUT: 3000, // 3 秒
  ELEMENT_DETECTION_INTERVAL: 1000 // 1 秒
};

// 匹配容差值
export const MATCHING_TOLERANCE = 5; // 毫秒

// 分類閾值
export const DURATION_CATEGORIES = {
  VERY_SHORT: 3000, // 3 秒
  SHORT: 10000, // 10 秒
  MEDIUM: 60000, // 1 分鐘
  LONG: Infinity
};

export const SIZE_CATEGORIES = {
  VERY_SMALL: 10 * 1024, // 10 KB
  SMALL: 100 * 1024, // 100 KB
  MEDIUM: 1024 * 1024, // 1 MB
  LARGE: 10 * 1024 * 1024, // 10 MB
  VERY_LARGE: Infinity
};

// 語音訊息信心度分數閾值
export const CONFIDENCE_THRESHOLDS = {
  MINIMUM: 50,
  MIME_TYPE_AUDIO: 30,
  MIME_TYPE_VIDEO: 20,
  DURATION_MATCH: 30,
  SIZE_MATCH: 20,
  DURATION_TOO_LONG: -10,
  SIZE_TOO_SMALL: -15,
  SIZE_TOO_LARGE: -15
};

// UI 常數
export const UI_CONSTANTS = {
  BADGE_TEXT: "ON",
  BADGE_COLOR: "#4CAF50",
  CONTEXT_MENU_ID: "downloadVoiceMessage",
  CONTEXT_MENU_TITLE: "下載語音訊息"
};

// 模組名稱
export const MODULE_NAMES = {
  BACKGROUND: "background",
  CONTENT_SCRIPT: "content-script",
  MENU_MANAGER: "menu-manager",
  MESSAGE_HANDLER: "MESSAGE-HANDLER",
  DOWNLOAD_MANAGER: "download-manager",
  DATA_STORE: "data-store",
  WEB_REQUEST: "web-request-interceptor",
  DOM_DETECTOR: "dom-detector",
  CONTEXT_MENU: "context-menu-handler"
};
