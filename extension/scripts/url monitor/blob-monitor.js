/**
 * blob-monitor.js
 * 負責監控和處理 Blob URL，以檢測和處理可能的音訊檔案
 */

import { Logger } from "../utils/logger.js";
import {
  MESSAGE_SOURCES,
  MESSAGE_TYPES,
  MESSAGE_ACTIONS,
  TIME_CONSTANTS,
  MODULE_NAMES,
} from "../utils/constants.js";
import {
  calculateAudioDuration,
  evaluateAudioLikelihood,
  extractBlobContent,
} from "../audio/audio-analyzer.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("blob-monitor");

// 全局標記，用於識別擴充功能自己創建的 blob URL
// 使用 WeakMap 避免記憶體洩漏
// 將 blob 對象映射到布爾值，表示是否為擴充功能創建
// WeakMap 允許 blob 對象被垃圾回收時自動移除映射關係
// 這比使用普通的 Map 更安全，因為不會阻止 blob 垃圾回收
// 也不需要手動清理映射關係
const selfCreatedBlobs = new WeakMap();

// 節流控制變數
// 記錄最後一次處理 blob 的時間戳
// 用於限制短時間內處理 blob 的频率
let lastProcessedTime = 0;
// 最小處理間隔（毫秒）
// 即使有多個 blob 在短時間內創建，也只處理一個
const THROTTLE_INTERVAL = 500;

// 記錄已處理的 blob URL
// 避免重複處理相同的 URL
// 使用 Set 而非 WeakSet，因為需要存儲字符串 URL
const processedBlobUrls = new Set();

// 清理記錄的已處理 URL
// 定期執行，避免使用記憶體洩漏
function setupPeriodicCleanup() {
  setInterval(() => {
    // 清空已處理的 URL 集合
    processedBlobUrls.clear();
    logger.debug("已清空處理過的 blob URL 記錄");
  }, 300000); // 每 5 分鐘清空一次
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
 * 設置 Blob URL 監控
 * 攔截 URL.createObjectURL 方法來捕獲 blob URL 的創建
 * 計算音訊檔案的持續時間並存儲到 voiceMessagesStore
 * 已優化：增加安全標記、節流控制、更精確的音訊偵測
 */
export function setupBlobUrlMonitor() {
  logger.info("設置 Blob URL 監控");

  // 保存原始的 URL.createObjectURL 方法
  const originalCreateObjectURL = URL.createObjectURL;

  // 攔截 URL.createObjectURL 方法
  URL.createObjectURL = function (blob) {
    // 檢查是否為擴充功能自己創建的 blob
    if (selfCreatedBlobs.has(blob)) {
      // 如果是擴充功能自己創建的 blob，直接調用原始方法並返回，不進行處理
      return originalCreateObjectURL.apply(this, arguments);
    }

    // 調用原始方法獲取 blob URL
    const blobUrl = originalCreateObjectURL.apply(this, arguments);

    try {
      // 節流控制：檢查是否超過最小處理間隔
      const now = Date.now();
      if (now - lastProcessedTime < THROTTLE_INTERVAL) {
        // 如果超過限制頻率，則跳過處理
        return blobUrl;
      }

      // 檢查是否已處理過這個 URL
      if (processedBlobUrls.has(blobUrl)) {
        // 如果已處理過，則跳過
        return blobUrl;
      }

      // 更嚴格的過濾條件：只處理可能是音訊的 blob
      if (!blob || !blob.type) {
        return blobUrl; // 如果沒有 blob 或 blob.type，直接返回
      }

      // 獲取基本診斷資訊
      const urlFeatures = blobUrl.substring(0, 50);
      const timestamp = new Date().toISOString();
      const stackTrace = new Error().stack;
      const pageUrl = window.location.href;

      // 使用音檔評估函數進行評估
      const evaluation = evaluateAudioLikelihood(blob);
      const isLikelyAudio = evaluation.isLikelyAudio;
      const sizeCategory = evaluation.sizeCategory;
      const blobSizeKB = evaluation.blobSizeKB;

      // 輸出詳細診斷資訊
      logger.debug("Blob 詳細資訊", {
        blobUrl: urlFeatures,
        blobType: blob.type,
        blobSizeBytes: blob.size,
        blobSizeKB: blobSizeKB,
        sizeCategory: sizeCategory,
        isLikelyAudio: isLikelyAudio,
        confidenceScore: evaluation.confidenceScore,
        confidenceReason: evaluation.confidenceReason,
        timestamp: timestamp,
        pageUrl: pageUrl,
        stackTraceHint: stackTrace ? stackTrace.split("\n")[2] : "無法獲取",
        creationContext: document.activeElement
          ? document.activeElement.tagName
          : "無法獲取",
      });

      if (!isLikelyAudio) {
        return blobUrl; // 如果不可能是音訊，直接返回
      }

      // 更新最後處理時間
      lastProcessedTime = now;

      // 標記為已處理
      processedBlobUrls.add(blobUrl);

      // 計算音訊持續時間
      getDurationFromBlob(blob)
        .then((durationMs) => {
          // 驗證持續時間是否合理（大於 0.5 秒且小於 10 分鐘）
          if (durationMs < 500 || durationMs > 600000) {
            logger.debug("偵測到的持續時間不在合理範圍內，跳過", {
              durationMs: durationMs,
            });
            return;
          }

          // 判斷持續時間範圍
          let durationCategory = "未知";
          if (durationMs < 3000) {
            durationCategory = "極短 (<3秒)";
          } else if (durationMs < 10000) {
            durationCategory = "短 (3-10秒)";
          } else if (durationMs < 60000) {
            durationCategory = "中 (10秒-1分鐘)";
          } else {
            durationCategory = "長 (>1分鐘)";
          }

          logger.info("Blob 持續時間資訊", {
            blobUrl: urlFeatures,
            durationMs: durationMs,
            durationCategory: durationCategory,
            blobType: blob.type,
            blobSizeKB: blobSizeKB,
            timestamp: timestamp,
          });

          // 將 Blob URL 與持續時間一起存儲到 voiceMessagesStore，但不自動下載
          window.sendToBackground({
            action: "registerBlobUrl",
            blobUrl: blobUrl,
            blobType: blob.type,
            blobSize: blob.size,
            durationMs: durationMs,
            durationCategory: durationCategory,
            sizeCategory: sizeCategory,
            timestamp: timestamp,
          });

          logger.info("Blob URL 已註冊，等待用戶右鍵點擊下載", {
            durationMs: durationMs,
          });
        })
        .catch((error) => {
          // 錯誤處理：只在偵測到可能的音訊檔案但無法計算持續時間時記錄
          // 減少輸出錯誤日誌的頻率
          logger.warn("計算 Blob 持續時間失敗，可能不是音訊檔案");

          logger.debug("Blob 錯誤詳情", {
            blobUrl: urlFeatures,
            blobType: blob.type,
            blobSizeKB: blobSizeKB,
            error: error.message,
            timestamp: timestamp,
          });

          // 不再發送失敗的 blob 到背景腳本，減少資源消耗
          // 只在高可能是音訊且大小合適的情況下才註冊
          if (
            blob.type.includes("audio/") &&
            blob.size > 50 * 1024 &&
            blob.size < 5 * 1024 * 1024
          ) {
            window.sendToBackground({
              action: "blobUrlDetected",
              blobUrl: blobUrl,
              blobType: blob.type,
              blobSize: blob.size,
              sizeCategory: sizeCategory,
              timestamp: timestamp,
            });

            logger.info("雖無法計算持續時間，但仍註冊了可能的音訊 Blob URL");
          }
        });
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
 * 處理提取 blob 內容的請求
 *
 * @param {Object} message - 包含 blobUrl 的消息對象
 * @param {Function} sendResponse - 回應函數
 * @returns {boolean} - 標示是否保持連接開啟
 */
export function handleExtractBlobRequest(message, sendResponse) {
  logger.debug("收到提取 blob 內容要求", {
    blobUrl: message.blobUrl,
    blobType: message.blobType,
    requestId: message.requestId,
  });

  // 提取 blob 內容
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

/**
 * 處理計算 blob 持續時間的請求
 *
 * @param {Object} message - 包含 blobUrl 的消息對象
 * @param {Function} sendResponse - 回應函數
 * @returns {boolean} - 標示是否保持連接開啟
 */
export function handleCalculateDurationRequest(message, sendResponse) {
  logger.debug("收到計算 blob 持續時間要求", {
    blobUrl: message.blobUrl,
    blobType: message.blobType,
    requestId: message.requestId,
  });

  // 計算 blob 持續時間
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
  selfCreatedBlobs,
  processedBlobUrls,
};
