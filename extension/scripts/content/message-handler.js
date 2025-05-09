/**
 * message-handler.js
 * 負責處理來自背景腳本的訊息並路由到正確的處理器
 */

import { Logger } from "../utils/logger.js";
import {
  MESSAGE_SOURCES,
  MESSAGE_ACTIONS,
  MODULE_NAMES,
} from "../utils/constants.js";
import { handleGetAudioDurationRequest } from "../url monitor/audio-analyzer.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.CONTENT_MESSAGE_HANDLER);

/**
 * 初始化訊息處理器
 * 設置訊息監聽器，處理來自背景腳本的訊息
 */
export function initMessageHandler() {
  logger.debug("初始化內容腳本訊息處理器");

  // 設置訊息監聽器，處理與內容腳本的通訊
  window.addEventListener("message", async function (event) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) return;

    // 處理來自內容腳本的訊息
    if (
      event.data.type &&
      event.data.type === MESSAGE_SOURCES.BACKGROUND_SCRIPT
    ) {
      const message = event.data.message;
      logger.debug("收到背景腳本訊息", { message });

      // 根據訊息動作路由到對應的處理器
      handleMessage(message);
    }
  });

  logger.info("內容腳本訊息處理器已初始化");
}

/**
 * 根據訊息類型路由到對應的處理器
 * @param {Object} message - 接收到的訊息
 */
async function handleMessage(message) {
  logger.debug("開始處理訊息", { action: message.action });

  switch (message.action) {
    case MESSAGE_ACTIONS.GET_AUDIO_DURATION:
      logger.debug("處理獲取音訊時長請求");
      const durationMs = await handleGetAudioDurationRequest(message);

      // 只有在成功獲得持續時間後才註冊
      if (durationMs !== undefined && durationMs !== null) {
        registerAudioUrlWithBackend(message.url, durationMs);
      } else {
        logger.debug("獲取的音訊持續時間無效", { url: message.url });
      }
      break;

    // 可以添加更多訊息類型的處理...

    default:
      logger.warn("未處理的訊息類型", {
        action: message.action || "無動作",
      });
      break;
  }
}

/**
 * 向背景腳本註冊 Audio URL
 * @param {string} url - 音訊 URL
 * @param {number} durationMs - 音訊持續時間（毫秒）
 */
function registerAudioUrlWithBackend(url, durationMs) {
  // 建立要發送的訊息
  const message = {
    action: MESSAGE_ACTIONS.REGISTER_AUDIO_URL,
    audioUrl: url,
    durationMs: durationMs,
    timestamp: new Date().toISOString(),
  };

  // 使用 chrome.runtime.sendMessage 直接發送給背景腳本
  chrome.runtime.sendMessage(message, function (response) {
    logger.debug("註冊 Audio URL 回應", { response });
  });

  // 記錄詳細資訊
  logger.debug("向背景腳本發送 Audio URL 註冊資訊", {
    audioUrl: url.substring(0, 50),
    durationMs: durationMs,
  });
}
