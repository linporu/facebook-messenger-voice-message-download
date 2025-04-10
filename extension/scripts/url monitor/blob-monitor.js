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

  // 處理隊列和狀態
  processingQueue: [],
  isProcessing: false,

  // 已分析過的 blob 追蹤
  analyzedBlobs: new WeakMap(),

  // 將 blob 標記為自己創建的
  markAsSelfCreated(blob) {
    this.selfCreatedBlobs.set(blob, true);
    return blob;
  },

  // 檢查 blob 是否是自己創建的
  isSelfCreated(blob) {
    return this.selfCreatedBlobs.has(blob);
  },

  // 將 blob 加入處理隊列
  enqueueBlob(blob, blobUrl) {
    this.processingQueue.push({ blob, blobUrl });
    logger.debug("將 blob URL 加入處理隊列", {
      queueLength: this.processingQueue.length,
    });
    this.processNextInQueue();
  },

  // 處理隊列中的下一個項目
  async processNextInQueue() {
    // 如果已經在處理或隊列為空，則直接返回
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const { blob, blobUrl } = this.processingQueue.shift();

    try {
      // 檢查是否已分析過此 blob
      if (this.analyzedBlobs.has(blob)) {
        logger.debug("跳過已分析過的 blob", {
          blobUrl: blobUrl.substring(0, 50),
        });
      } else {
        // 標記為已分析
        this.analyzedBlobs.set(blob, true);

        // 評估 blob 是否可能是語音訊息
        const isLikelyVoiceMessage = isLikelyVoiceMessageBlob(blob);

        if (isLikelyVoiceMessage) {
          logger.debug("處理可能是語音訊息的 blob", {
            blobUrl: blobUrl.substring(0, 50),
          });
          // 計算音訊持續時間
          const durationMs = await calculateAudioDuration(blob);

          // 驗證持續時間是否合理
          if (
            durationMs >= BLOB_MONITOR_CONSTANTS.MIN_VALID_DURATION &&
            durationMs <= BLOB_MONITOR_CONSTANTS.MAX_VALID_DURATION
          ) {
            // 註冊到背景腳本
            registerBlobWithBackend(blob, blobUrl, durationMs);
          } else {
            logger.debug("音訊持續時間超出有效範圍，不註冊", { durationMs });
          }
        } else {
          logger.debug("blob 不是語音訊息，略過處理", { blobType: blob.type });
        }
      }
    } catch (error) {
      logger.error("處理隊列中的 blob 時發生錯誤", { error });
    } finally {
      this.isProcessing = false;
      // 繼續處理下一個
      this.processNextInQueue();
    }
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

  // 擴充功能自己創建的 blob
  if (BlobMonitorState.isSelfCreated(blob)) {
    return false;
  }
  return true;
}

/**
 * 處理潛在的音訊 blob
 */
function processBlob(blob, blobUrl) {
  // 將 blob 加入處理隊列
  BlobMonitorState.enqueueBlob(blob, blobUrl);
}

/**
 * 向背景腳本註冊 Blob
 */
function registerBlobWithBackend(blob, blobUrl, durationMs) {
  // 生成 blob 識別碼
  const currentTimestamp = new Date().toISOString();
  const urlPart = blobUrl.substring(0, 50);
  const blobIdentifier = `${urlPart}-${blob.size}-${durationMs}`;

  // 發送註冊訊息到背景腳本
  window.sendToBackground({
    action: MESSAGE_ACTIONS.REGISTER_BLOB_URL,
    blobUrl: blobUrl,
    blobType: blob.type,
    blobSize: blob.size,
    durationMs: durationMs,
    timestamp: currentTimestamp,
    blobIdentifier: blobIdentifier, // 加入識別碼供背景腳本進一步過濾
  });

  // 記錄詳細資訊
  logger.info("向背景腳本發送 blob url 註冊資訊", {
    blobUrl: urlPart,
    blobType: blob.type,
    blobSizeBytes: blob.size,
    durationMs: durationMs,
    blobIdentifier: blobIdentifier,
  });
}

/**
 * 設置定期清理
 * 定期清空已處理的 URL 集合和已註冊的識別碼，避免記憶體洩漏
 */
function setupPeriodicCleanup() {
  setInterval(() => {}, BLOB_MONITOR_CONSTANTS.PERIODIC_CLEANUP_INTERVAL);
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
