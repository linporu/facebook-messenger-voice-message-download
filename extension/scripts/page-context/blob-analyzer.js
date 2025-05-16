/**
 * blob-analyzer.js
 * 負責處理音檔分析相關功能，包含持續時間計算和音訊資料處理
 */

import { Logger } from "../utils/logger.js";
import {
  TIME_CONSTANTS,
  MODULE_NAMES,
  BLOB_MONITOR_CONSTANTS,
} from "../utils/constants.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_ANALYZER);

/**
 * 從 Blob 中計算音訊持續時間
 * 首先嘗試使用 Audio 元素，若失敗則嘗試使用 Web Audio API
 *
 * @param {Blob|string} blobOrUrl - 音訊 Blob 對象或 blob URL
 * @param {string} [blobType] - blob 類型 (如果傳入 URL，則此參數為必須)
 * @returns {Promise<number>} - 返回音訊持續時間（毫秒）的 Promise
 */
export async function calculateBlobDuration(blobOrUrl, blobType = null) {
  try {
    logger.debug("開始計算音訊持續時間");

    let blob = null;
    let tempUrl = null;

    // 判斷傳入參數是 Blob 還是 URL
    if (typeof blobOrUrl === "string") {
      logger.debug("傳入參數為 URL，開始獲取 Blob", { blobUrl: blobOrUrl });

      // 使用 fetch 獲取 blob 內容
      const response = await fetch(blobOrUrl);
      if (!response.ok) {
        throw new Error(
          `無法獲取 blob 內容: ${response.status} ${response.statusText}`
        );
      }

      // 獲取 blob 內容
      blob = await response.blob();
      logger.debug("成功獲取 blob", {
        blobType: blob.type || blobType,
        blobSize: blob.size,
      });
    } else {
      // 直接使用傳入的 Blob
      blob = blobOrUrl;
      logger.debug("使用傳入的 Blob 對象", {
        blobType: blob.type,
        blobSize: blob.size,
      });
    }

    // 確保我們有 blob 類型
    const actualBlobType = blob.type || blobType;

    if (!actualBlobType) {
      logger.warn("無法確定 Blob 類型，可能會影響音訊解析");
    }

    // 計算持續時間 - 先使用 Audio 元素方法
    return new Promise((resolve, reject) => {
      try {
        // 方法 1: 使用 HTML5 Audio 元素
        const audioElement = new Audio();
        tempUrl = URL.createObjectURL(blob);

        // 設置事件監聽器
        audioElement.addEventListener("loadedmetadata", () => {
          try {
            // 獲取持續時間（秒）並轉換為毫秒
            const durationMs = Math.round(audioElement.duration * 1000);
            logger.debug("使用 Audio 元素獲取到持續時間", { durationMs });

            // 釋放 Blob URL
            URL.revokeObjectURL(tempUrl);

            resolve(durationMs);
          } catch (innerError) {
            logger.error("處理音訊元數據時發生錯誤", { error: innerError });
            // 釋放 Blob URL
            URL.revokeObjectURL(tempUrl);

            // 嘗試方法 2
            resolveUsingWebAudioAPI(blob, resolve, reject);
          }
        });

        // 設置錯誤處理
        audioElement.addEventListener("error", (e) => {
          logger.error("載入音訊時發生錯誤", { error: e });
          URL.revokeObjectURL(tempUrl);

          // 嘗試方法 2
          resolveUsingWebAudioAPI(blob, resolve, reject);
        });

        // 設置音訊來源
        audioElement.src = tempUrl;
        audioElement.load();

        // 設置超時處理
        setTimeout(() => {
          if (!audioElement.duration) {
            logger.debug("Audio 元素方法超時，嘗試 Web Audio API");
            URL.revokeObjectURL(tempUrl);

            // 嘗試方法 2
            resolveUsingWebAudioAPI(blob, resolve, reject);
          }
        }, TIME_CONSTANTS.AUDIO_LOAD_TIMEOUT); // 超時時間
      } catch (error) {
        logger.error("使用 Audio 元素計算持續時間失敗", { error });

        // 釋放資源
        if (tempUrl) {
          URL.revokeObjectURL(tempUrl);
        }

        // 嘗試方法 2
        resolveUsingWebAudioAPI(blob, resolve, reject);
      }
    });
  } catch (error) {
    logger.error("計算音訊持續時間時發生錯誤", { error });
    throw error;
  }
}

/**
 * 提取 Blob 內容並轉換為 base64 格式
 *
 * @param {string} blobUrl - blob URL
 * @returns {Promise<Object>} - 包含 base64data、blobType 和 blobSize 的對象
 */
export async function extractBlobContent(blobUrl) {
  try {
    logger.debug("開始提取 blob 內容", { blobUrl });

    // 使用 fetch 獲取 blob 內容
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(
        `無法獲取 blob 內容: ${response.status} ${response.statusText}`
      );
    }

    // 獲取 blob 內容
    const blob = await response.blob();
    logger.debug("成功獲取 blob", {
      blobType: blob.type,
      blobSize: blob.size,
    });

    // 將 blob 轉換為 base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          // 確保我們取得正確的 base64 數據
          const base64String = reader.result;
          const base64data = base64String.split(",")[1];

          if (!base64data) {
            throw new Error("無法取得有效的 base64 數據");
          }

          logger.debug("成功將 blob 轉換為 base64", {
            dataLength: base64data.length,
          });

          resolve({
            base64data,
            blobType: blob.type,
            blobSize: blob.size,
          });
        } catch (innerError) {
          logger.error("處理 base64 數據時發生錯誤", { error: innerError });
          reject(innerError);
        }
      };
      reader.onerror = () => {
        reject(new Error("讀取 blob 內容失敗"));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logger.error("提取 blob 內容時發生錯誤", { error });
    throw error;
  }
}

/**
 * 檢查 Blob 是否可能是音訊檔案
 * 根據多項指標評估可能性並返回信心分數
 *
 * @param {Blob} blob - 要評估的 Blob 對象
 * @returns {Object} - 包含評估結果的對象
 */
export function isLikelyVoiceMessageBlob(blob) {
  logger.debug("評估 Blob 是否為音訊檔案", {
    blobType: blob.type,
    blobSize: blob.size,
  });

  // 基本檢查 - blob 必須存在、有類型、有大小
  if (!blob || !blob.type || !blob.size) {
    logger.debug("Blob 不存在或無法取得基本資訊");
    return false;
  }

  // 必須為可能的音訊類型之一
  if (
    !BLOB_MONITOR_CONSTANTS.POSSIBLE_AUDIO_TYPES.some((type) =>
      blob.type.includes(type)
    )
  ) {
    logger.debug("Blob 的類型不在可能的音訊類型列表中");
    return false;
  }

  // 檔案不能太小
  if (blob.size <= BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE) {
    logger.debug("Blob 的大小太小");
    return false;
  }

  if (blob.size >= BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE) {
    logger.debug("Blob 的大小太大");
    return false;
  }

  logger.debug("Blob 滿足音訊檔案的基本條件");
  return true;
}
