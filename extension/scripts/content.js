/**
 * content.js
 * 主要內容腳本，負責初始化和協調其他模組
 */

import { Logger } from "./utils/logger.js";
import {
  SUPPORTED_SITES,
  MESSAGE_SOURCES,
  MESSAGE_TYPES,
  MESSAGE_ACTIONS,
  TIME_CONSTANTS,
  MODULE_NAMES,
} from "./utils/constants.js";
import {
  calculateAudioDuration,
  extractBlobContent,
} from "./audio/audio-analyzer.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.CONTENT_SCRIPT);

// 檢查是否在支援的網站上
const isSupportedSite = SUPPORTED_SITES.DOMAINS.some((domain) =>
  window.location.hostname.includes(domain)
);

if (!isSupportedSite) {
  logger.info("不支援的網站，擴充功能不會啟動");
} else {
  // 創建主模組腳本標籤
  const script = document.createElement("script");
  script.type = "module";
  script.src = chrome.runtime.getURL("scripts/main-module.js");
  script.onload = function () {
    logger.info("Facebook Messenger 語音訊息下載器已載入主模組");
    this.remove(); // 載入後移除腳本標籤
  };

  // 添加到頁面
  (document.head || document.documentElement).appendChild(script);

  // 設置訊息監聽器，處理腳本與背景腳本的通訊
  window.addEventListener("message", function (event) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) return;

    // 處理來自主模組的訊息
    if (event.data.type && event.data.type === MESSAGE_SOURCES.CONTENT_SCRIPT) {
      logger.debug("收到主模組訊息，轉發到背景腳本", {
        message: event.data.message,
      });
      chrome.runtime.sendMessage(event.data.message, function (response) {
        logger.debug("背景腳本回應", { response });
      });
    }
  });

  // 將來自背景腳本的訊息轉發到主模組
  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    logger.debug("收到背景腳本訊息", { message });

    // 特別處理 extractBlobContent 訊息
    if (message.action === MESSAGE_ACTIONS.EXTRACT_BLOB) {
      logger.debug("收到提取 blob 內容要求", {
        blobUrl: message.blobUrl,
        blobType: message.blobType,
        requestId: message.requestId,
      });

      // 提取 blob 內容 - 使用新的音檔分析模組
      extractBlobContent(message.blobUrl)
        .then((result) => {
          logger.debug("提取 blob 內容成功，發送回背景腳本");

          // 構建結果並發送到背景腳本
          chrome.runtime.sendMessage(
            {
              action: MESSAGE_ACTIONS.DOWNLOAD_BLOB,
              blobType: result.blobType,
              base64data: result.base64data,
              requestId: message.requestId,
              timestamp: new Date().toISOString(),
            },
            (response) => {
              logger.debug("背景腳本回應下載要求", { response });
            }
          );

          sendResponse({
            success: true,
            message: "已發送 blob 內容到背景腳本進行下載",
          });
        })
        .catch((error) => {
          logger.error("提取 blob 內容失敗", { error });
          sendResponse({ success: false, error: error.message });
        });

      return true; // 保持連接開啟，以便異步回應
    }

    // 處理 calculateBlobDuration 訊息
    if (message.action === MESSAGE_ACTIONS.CALCULATE_DURATION) {
      logger.debug("收到計算 blob 持續時間要求", {
        blobUrl: message.blobUrl,
        blobType: message.blobType,
        requestId: message.requestId,
      });

      // 計算 blob 持續時間 - 使用新的音檔分析模組
      calculateAudioDuration(message.blobUrl, message.blobType)
        .then((durationMs) => {
          logger.debug("計算 blob 持續時間成功，發送回背景腳本");

          // 發送計算結果到背景腳本
          chrome.runtime.sendMessage(
            {
              action: MESSAGE_ACTIONS.REGISTER_BLOB_URL,
              blobUrl: message.blobUrl,
              blobType: message.blobType,
              blobSize: null, // 我們沒有 blob 大小資訊，後續可以改進
              durationMs: durationMs,
              timestamp: new Date().toISOString(),
              requestId: message.requestId,
            },
            (response) => {
              logger.debug("背景腳本回應註冊 Blob URL 要求", { response });
            }
          );

          sendResponse({
            success: true,
            message: "已計算 blob 持續時間並註冊到 voiceMessagesStore",
            durationMs: durationMs,
          });
        })
        .catch((error) => {
          logger.error("計算 blob 持續時間失敗", { error });
          sendResponse({ success: false, error: error.message });
        });

      return true; // 保持連接開啟，以便異步回應
    }

    // 其他訊息轉發到主模組
    window.postMessage(
      {
        type: MESSAGE_SOURCES.BACKGROUND_SCRIPT,
        message: message,
      },
      "*"
    );
    return true;
  });

  logger.info("Facebook Messenger 語音訊息下載器已初始化");
}
