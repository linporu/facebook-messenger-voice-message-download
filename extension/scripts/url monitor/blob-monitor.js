/**
 * blob-monitor.js
 * 負責監控和處理 Blob URL，以檢測和處理可能的音訊檔案
 */

import { Logger } from "../utils/logger.js";
import {
  MESSAGE_ACTIONS,
  MODULE_NAMES,
  BLOB_MONITOR_CONSTANTS,
  DURATION_CATEGORIES,
} from "../utils/constants.js";
import {
  calculateAudioDuration,
  evaluateAudioLikelihood,
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
 * 日誌工具
 */
const LogUtils = {
  /**
   * 記錄 Blob 詳細診斷資訊
   */
  logBlobDetails(blob, blobUrl, evaluation) {
    const urlFeatures = blobUrl.substring(0, 50);
    const timestamp = new Date().toISOString();
    const stackTrace = new Error().stack;
    const pageUrl = window.location.href;

    logger.debug("Blob 詳細資訊", {
      blobUrl: urlFeatures,
      blobType: blob.type,
      blobSizeBytes: blob.size,
      blobSizeKB: evaluation.blobSizeKB,
      sizeCategory: evaluation.sizeCategory,
      isLikelyAudio: evaluation.isLikelyAudio,
      confidenceScore: evaluation.confidenceScore,
      confidenceReason: evaluation.confidenceReason,
      timestamp: timestamp,
      pageUrl: pageUrl,
      stackTraceHint: stackTrace ? stackTrace.split("\n")[2] : "無法獲取",
      creationContext: document.activeElement
        ? document.activeElement.tagName
        : "無法獲取",
    });
  },

  /**
   * 記錄 Blob 持續時間資訊
   */
  logDurationInfo(blobUrl, durationMs, durationCategory, blob) {
    const urlFeatures = blobUrl.substring(0, 50);
    const timestamp = new Date().toISOString();

    logger.info("Blob 持續時間資訊", {
      blobUrl: urlFeatures,
      durationMs: durationMs,
      durationCategory: durationCategory,
      blobType: blob.type,
      blobSizeKB: (blob.size / 1024).toFixed(2),
      timestamp: timestamp,
    });
  },

  /**
   * 記錄 Blob 錯誤詳情
   */
  logBlobError(blobUrl, blob, error) {
    const urlFeatures = blobUrl.substring(0, 50);
    const timestamp = new Date().toISOString();

    logger.debug("Blob 錯誤詳情", {
      blobUrl: urlFeatures,
      blobType: blob.type,
      blobSizeKB: (blob.size / 1024).toFixed(2),
      error: error.message,
      timestamp: timestamp,
    });
  },
};

/**
 * 檢查是否應該處理這個 blob
 */
function shouldProcessBlob(blob, blobUrl) {
  // 擴充功能自己創建的 blob
  if (BlobMonitorState.isSelfCreated(blob)) {
    return false;
  }

  // 節流控制
  if (BlobMonitorState.shouldThrottle()) {
    return false;
  }

  // 已處理檢查
  if (BlobMonitorState.isUrlProcessed(blobUrl)) {
    return false;
  }

  // 基本檢查 - blob 必須存在且有類型
  if (!blob || !blob.type) {
    return false;
  }

  return true;
}

/**
 * 計算持續時間分類
 */
function calculateDurationCategory(durationMs) {
  if (durationMs < DURATION_CATEGORIES.VERY_SHORT) {
    return "極短 (<3秒)";
  } else if (durationMs < DURATION_CATEGORIES.SHORT) {
    return "短 (3-10秒)";
  } else if (durationMs < DURATION_CATEGORIES.MEDIUM) {
    return "中 (10秒-1分鐘)";
  } else {
    return "長 (>1分鐘)";
  }
}

/**
 * 處理音訊 blob 的持續時間計算
 */
async function processAudioBlobDuration(blob, blobUrl, evaluation) {
  try {
    const durationMs = await calculateAudioDuration(blob);

    // 驗證持續時間是否合理
    if (
      durationMs < BLOB_MONITOR_CONSTANTS.MIN_VALID_DURATION ||
      durationMs > BLOB_MONITOR_CONSTANTS.MAX_VALID_DURATION
    ) {
      logger.debug("偵測到的持續時間不在合理範圍內，跳過", {
        durationMs: durationMs,
      });
      return;
    }

    // 計算持續時間分類
    const durationCategory = calculateDurationCategory(durationMs);

    // 記錄持續時間資訊
    LogUtils.logDurationInfo(blobUrl, durationMs, durationCategory, blob);

    // 將 Blob URL 與持續時間一起註冊到背景腳本
    registerBlobWithBackend(
      blobUrl,
      blob,
      durationMs,
      durationCategory,
      evaluation
    );

    logger.info("Blob URL 已註冊，等待用戶右鍵點擊下載", {
      durationMs: durationMs,
    });
  } catch (error) {
    handleDurationCalculationError(blobUrl, blob, error, evaluation);
  }
}

/**
 * 向背景腳本註冊 Blob
 */
function registerBlobWithBackend(
  blobUrl,
  blob,
  durationMs,
  durationCategory,
  evaluation
) {
  window.sendToBackground({
    action: MESSAGE_ACTIONS.REGISTER_BLOB_URL,
    blobUrl: blobUrl,
    blobType: blob.type,
    blobSize: blob.size,
    durationMs: durationMs,
    durationCategory: durationCategory,
    sizeCategory: evaluation.sizeCategory,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 處理計算持續時間時發生的錯誤
 */
function handleDurationCalculationError(blobUrl, blob, error, evaluation) {
  logger.warn("計算 Blob 持續時間失敗，可能不是音訊檔案");
  LogUtils.logBlobError(blobUrl, blob, error);

  // 只在高可能是音訊且大小合適的情況下才註冊
  if (
    blob.type.includes("audio/") &&
    blob.size > BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE &&
    blob.size < BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE
  ) {
    window.sendToBackground({
      action: MESSAGE_ACTIONS.BLOB_DETECTED,
      blobUrl: blobUrl,
      blobType: blob.type,
      blobSize: blob.size,
      sizeCategory: evaluation.sizeCategory,
      timestamp: new Date().toISOString(),
    });

    logger.info("雖無法計算持續時間，但仍註冊了可能的音訊 Blob URL");
  }
}

/**
 * 處理潛在的音訊 blob
 */
function processBlob(blob, blobUrl) {
  // 更新狀態
  BlobMonitorState.markUrlAsProcessed(blobUrl);

  // 評估 blob 是否可能是音訊
  const evaluation = evaluateAudioLikelihood(blob);

  // 記錄詳細資訊
  LogUtils.logBlobDetails(blob, blobUrl, evaluation);

  // 如果不可能是音訊，提前返回
  if (!evaluation.isLikelyAudio) {
    return;
  }

  // 計算音訊持續時間並處理
  processAudioBlobDuration(blob, blobUrl, evaluation);
}

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
      // 錯誤處理：確保即使發生錯誤也不影響原始功能
      logger.error("處理 blob URL 時發生錯誤，不影響原始功能", {
        error,
      });
    }

    // 返回原始的 blob URL
    return blobUrl;
  };

  logger.info("Blob URL 監控已設置，已優化資源使用和穩定性");
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
 * 從 Blob 中提取音訊持續時間
 * 使用音檔分析模組提取持續時間
 *
 * @param {Blob} blob - 音訊 Blob 對象
 * @returns {Promise<number>} - 返回音訊持續時間（毫秒）的 Promise
 */
async function getDurationFromBlob(blob) {
  try {
    logger.debug("開始從 Blob 提取音訊持續時間");
    return await calculateAudioDuration(blob);
  } catch (error) {
    logger.error("提取持續時間失敗", { error });
    throw error;
  }
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
 * 處理計算 blob 持續時間的請求
 *
 * @param {Object} message - 包含 blobUrl 的消息對象
 * @param {Function} sendResponse - 回應函數
 * @returns {boolean} - 標示是否保持連接開啟
 */
export async function handleCalculateDurationRequest(message, sendResponse) {
  logger.debug("收到計算 blob 持續時間要求", {
    blobUrl: message.blobUrl,
    blobType: message.blobType,
    requestId: message.requestId,
  });

  try {
    // 計算 blob 持續時間
    const durationMs = await calculateAudioDuration(
      message.blobUrl,
      message.blobType
    );
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
  } catch (error) {
    logger.error("計算 blob 持續時間失敗", { error });
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
  handleCalculateDurationRequest,
  // 導出供測試和偵錯使用的內部狀態
  BlobMonitorState,
};
