/**
 * blob-monitor.js
 * 負責監控和處理 Blob URL，以檢測和處理可能的音訊檔案
 */

import { Logger } from "../utils/logger.js";
import {
  MESSAGE_ACTIONS,
  MODULE_NAMES,
  BLOB_MONITOR_CONSTANTS,
} from "../utils/constants.js";
import {
  calculateAudioDuration,
  isLikelyVoiceMessageBlob,
  extractBlobContent,
} from "../audio/audio-analyzer.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_MONITOR);

/**
 * Blob 監控狀態管理
 */
const BlobMonitorState = {
  // 全局標記，用於識別擴充功能自己創建的 blob URL
  // 使用 WeakMap 避免記憶體洩漏
  selfCreatedBlobs: new WeakMap(),

  // 記錄已處理的 blob URL，避免重複處理相同的 URL
  processedUrls: new Set(),

  // 節流控制 - 記錄最後一次處理 blob 的時間戳
  lastProcessedTime: 0,

  // 將 blob 標記為自己創建的
  markAsSelfCreated(blob) {
    this.selfCreatedBlobs.set(blob, true);
    return blob;
  },

  // 檢查 blob 是否是自己創建的
  isSelfCreated(blob) {
    return this.selfCreatedBlobs.has(blob);
  },

  // 檢查 URL 是否已處理
  isUrlProcessed(url) {
    return this.processedUrls.has(url);
  },

  // 標記 URL 為已處理
  markUrlAsProcessed(url) {
    this.processedUrls.add(url);
    this.lastProcessedTime = Date.now();
  },

  // 清理已處理的 URL
  clearProcessedUrls() {
    this.processedUrls.clear();
    logger.debug("已清空處理過的 blob URL 記錄");
  },

  // 檢查是否應該節流
  shouldThrottle() {
    return (
      Date.now() - this.lastProcessedTime <
      BLOB_MONITOR_CONSTANTS.THROTTLE_INTERVAL
    );
  },
};

/**
 * 設置 Blob URL 監控
 * 攔截 URL.createObjectURL 方法來捕獲 blob URL 的創建
 */
export function setupBlobUrlMonitor() {
  logger.info("設置 Blob URL 監控");

  // 保存原始的 URL.createObjectURL 方法
  const originalCreateObjectURL = URL.createObjectURL;

  // 攔截 URL.createObjectURL 方法
  URL.createObjectURL = function (blob) {
    // 檢查是否為擴充功能自己創建的 blob
    if (BlobMonitorState.isSelfCreated(blob)) {
      // 如果是擴充功能自己創建的 blob，直接調用原始方法並返回
      return originalCreateObjectURL.apply(this, arguments);
    }

    // 調用原始方法獲取 blob URL
    const blobUrl = originalCreateObjectURL.apply(this, arguments);

    try {
      // 檢查是否應該處理這個 blob
      if (shouldProcessBlob(blob, blobUrl)) {
        processBlob(blob, blobUrl);
      }
    } catch (error) {
      logger.error("處理 blob URL 時發生錯誤", { error });
    }
    // 返回原始的 blob URL
    return blobUrl;
  };
  logger.info("Blob URL 監控已設置");
}

/**
 * 檢查是否應該處理這個 blob
 */
function shouldProcessBlob(blob, blobUrl) {
  // 基本檢查 - blob 必須存在且有類型
  if (!blob || !blob.type) {
    return false;
  }
  // 已處理檢查
  if (BlobMonitorState.isUrlProcessed(blobUrl)) {
    return false;
  }
  // 擴充功能自己創建的 blob
  if (BlobMonitorState.isSelfCreated(blob)) {
    return false;
  }
  // 節流控制
  if (BlobMonitorState.shouldThrottle()) {
    return false;
  }
  return true;
}

/**
 * 處理潛在的音訊 blob
 */
async function processBlob(blob, blobUrl) {
  // 更新狀態
  BlobMonitorState.markUrlAsProcessed(blobUrl);

  // 評估 blob 是否可能是語音訊息
  const isLikelyVoiceMessage = isLikelyVoiceMessageBlob(blob);

  if (!isLikelyVoiceMessage) {
    // 如果不可能是語音訊息，提前返回
    return;
  }

  try {
    // 計算音訊持續時間 - 使用 await 等待 Promise 解析
    const durationMs = await calculateAudioDuration(blob);

    // 將 Blob URL 與持續時間一起註冊到背景腳本
    registerBlobWithBackend(blob, blobUrl, durationMs);
  } catch (error) {
    logger.error("處理音訊 blob 時發生錯誤", { error });
  }
}

/**
 * 向背景腳本註冊 Blob
 */
function registerBlobWithBackend(blob, blobUrl, durationMs) {
  window.sendToBackground({
    action: MESSAGE_ACTIONS.REGISTER_BLOB_URL,
    blobUrl: blobUrl,
    blobType: blob.type,
    blobSize: blob.size,
    durationMs: durationMs,
    timestamp: new Date().toISOString(),
  });

  // 記錄詳細資訊
  logger.info("向背景腳本發送 blob url 註冊資訊", {
    blobUrl: blobUrl.substring(0, 50),
    blobType: blob.type,
    blobSizeBytes: blob.size,
    durationMs: durationMs,
  });
}

/**
 * 設置定期清理
 * 定期清空已處理的 URL 集合，避免記憶體洩漏
 */
function setupPeriodicCleanup() {
  setInterval(() => {
    BlobMonitorState.clearProcessedUrls();
  }, BLOB_MONITOR_CONSTANTS.PERIODIC_CLEANUP_INTERVAL);
}

/**
 * 處理提取 blob 內容的請求
 *
 * @param {Object} message - 包含 blobUrl 的消息對象
 * @param {Function} sendResponse - 回應函數
 * @returns {boolean} - 標示是否保持連接開啟
 */
export async function handleExtractBlobRequest(message, sendResponse) {
  logger.debug("收到提取 blob 內容要求", {
    blobUrl: message.blobUrl,
    blobType: message.blobType,
    requestId: message.requestId,
  });

  try {
    // 提取 blob 內容
    const result = await extractBlobContent(message.blobUrl);
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
  } catch (error) {
    logger.error("提取 blob 內容失敗", { error });
    sendResponse({ success: false, error: error.message });
  }

  return true; // 保持連接開啟，以便異步回應
}

/**
 * 初始化 Blob 監控模組
 */
export function initBlobMonitor() {
  logger.info("初始化 Blob 監控模組");
  setupBlobUrlMonitor();
  setupPeriodicCleanup();
  logger.info("Blob 監控模組初始化完成");
}

// 導出需要的函數和常數
export default {
  initBlobMonitor,
  setupBlobUrlMonitor,
  handleExtractBlobRequest,
  // 導出供測試和偵錯使用的內部狀態
  BlobMonitorState,
};
