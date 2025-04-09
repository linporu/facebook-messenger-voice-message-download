/**
 * constants.js
 * 定義整個擴充功能共用的常數
 */

// ===========================================
// Blob 監控相關常數
// ===========================================
export const BLOB_MONITOR_CONSTANTS = {
  THROTTLE_INTERVAL: 10, // 最小處理間隔（毫秒）
  PERIODIC_CLEANUP_INTERVAL: 300000, // 每 5 分鐘清空已處理的 URL
  MIN_VALID_DURATION: 500, // 最小有效持續時間（毫秒）
  MAX_VALID_DURATION: 1200000, // 最大有效持續時間（毫秒）
  MIN_VALID_AUDIO_SIZE: 20 * 1024, // 音訊的最小合理大小 (20KB)
  MAX_VALID_AUDIO_SIZE: 200 * 1024 * 1024, // 音訊的最大合理大小 (200MB)
  POSSIBLE_AUDIO_TYPES: ["audio", "video/mp4", "mp4", "mp3", "mpeg"], // 可能為音訊的檔案類型
};

// ===========================================
// 支援的網站相關常數
// ===========================================
export const SUPPORTED_SITES = {
  PATTERNS: ["*://*.facebook.com/*", "*://*.messenger.com/*"],
  DOMAINS: ["facebook.com", "messenger.com"],
  CDN_PATTERNS: [
    "*://*.fbcdn.net/*",
    "*://*.cdninstagram.com/*",
    "*://*.fbsbx.com/*",
  ],
};

// ===========================================
// 訊息處理相關常數
// ===========================================
export const MESSAGE_SOURCES = {
  CONTENT_SCRIPT: "CONTENT_SCRIPT",
  BACKGROUND_SCRIPT: "BACKGROUND_SCRIPT",
};

// 為了向後兼容，保留舊的常數但使用新的值
export const MESSAGE_TYPES = {
  FROM_CONTENT: MESSAGE_SOURCES.CONTENT_SCRIPT,
  FROM_BACKGROUND: MESSAGE_SOURCES.BACKGROUND_SCRIPT,
};

export const MESSAGE_ACTIONS = {
  RIGHT_CLICK: "rightClickOnVoiceMessage",
  REGISTER_ELEMENT: "registerVoiceMessageElement",
  DOWNLOAD_BLOB: "downloadBlobContent",
  REGISTER_BLOB_URL: "registerBlobUrl",
  BLOB_DETECTED: "blobUrlDetected",
  UPDATE_ELEMENT: "updateVoiceMessageElement",
};

// ===========================================
// 檔案處理相關常數
// ===========================================
export const FILE_EXTENSIONS = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".mp4",
  "video/mp4": ".mp4",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/aac": ".aac",
  default: ".bin",
};

// ===========================================
// 時間相關常數
// ===========================================
export const TIME_CONSTANTS = {
  CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 分鐘
  AUDIO_LOAD_TIMEOUT: 3000, // 3 秒
  ELEMENT_DETECTION_INTERVAL: 1000, // 1 秒
};

export const MATCHING_TOLERANCE = 5; // 毫秒

// ===========================================
// UI 相關常數
// ===========================================
export const UI_CONSTANTS = {
  BADGE_TEXT: "ON",
  BADGE_COLOR: "#4CAF50",
  CONTEXT_MENU_ID: "downloadVoiceMessage",
  CONTEXT_MENU_TITLE: "下載語音訊息",
};

// ===========================================
// DOM 相關常數 (從 dom-utils.js 移過來)
// ===========================================
export const DOM_CONSTANTS = {
  // 語音訊息滑桿的 aria-label
  VOICE_MESSAGE_SLIDER_ARIA_LABEL: "音訊滑桿",

  // 語音訊息元素的 data 屬性
  VOICE_MESSAGE_ELEMENT_DATA_ATTR: "data-voice-message-element",

  // 語音訊息 ID 的 data 屬性
  VOICE_MESSAGE_ID_DATA_ATTR: "data-voice-message-id",
};

// ===========================================
// ID 相關常數
// ===========================================
export const ID_CONSTANTS = {
  // 語音訊息 ID 前綴
  VOICE_MESSAGE_ID_PREFIX: "voice-msg-",
};

// ===========================================
// 日誌相關常數
// ===========================================
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// ===========================================
// 模組名稱常數
// ===========================================
export const MODULE_NAMES = {
  BACKGROUND: "background",
  CONTENT_SCRIPT: "content-script",
  MENU_MANAGER: "menu-manager",
  MESSAGE_HANDLER: "message-handler",
  DOWNLOAD_MANAGER: "download-manager",
  DATA_STORE: "data-store",
  WEB_REQUEST: "web-request-interceptor",
  DOM_DETECTOR: "dom-detector",
  CONTEXT_MENU: "context-menu-handler",
  AUDIO_ANALYZER: "audio-analyzer",
  BLOB_MONITOR: "blob-monitor",
};

// ===========================================
// 檔名相關常數
// ===========================================
export const FILENAME_CONSTANTS = {
  // 語音訊息檔名前綴
  VOICE_MESSAGE_FILENAME_PREFIX: "voice-message-",
};
