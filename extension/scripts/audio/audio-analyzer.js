/**
 * audio-analyzer.js
 * 負責處理音檔分析相關功能，包含持續時間計算和音訊資料處理
 */

import { Logger } from "../utils/logger.js";
import { TIME_CONSTANTS, MODULE_NAMES } from "../utils/constants.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.AUDIO_ANALYZER);

/**
 * 從 Blob 中計算音訊持續時間
 * 首先嘗試使用 Audio 元素，若失敗則嘗試使用 Web Audio API
 *
 * @param {Blob|string} blobOrUrl - 音訊 Blob 對象或 blob URL
 * @param {string} [blobType] - blob 類型 (如果傳入 URL，則此參數為必須)
 * @returns {Promise<number>} - 返回音訊持續時間（毫秒）的 Promise
 */
export async function calculateAudioDuration(blobOrUrl, blobType = null) {
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
 * 使用 Web Audio API 解析音訊持續時間
 *
 * @param {Blob} blob - 音訊 Blob 對象
 * @param {Function} resolve - Promise 解析函數
 * @param {Function} reject - Promise 拒絕函數
 */
function resolveUsingWebAudioAPI(blob, resolve, reject) {
  try {
    logger.debug("嘗試使用 Web Audio API 計算持續時間");

    // 創建 AudioContext
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();

    // 設置超時處理
    const timeoutId = setTimeout(() => {
      logger.error("Web Audio API 解碼超時");
      // 確保關閉 AudioContext
      if (audioContext && audioContext.state !== "closed") {
        try {
          audioContext.close();
        } catch (err) {
          logger.error("關閉 AudioContext 時發生錯誤", { error: err });
        }
      }
      reject(new Error("Web Audio API 解碼超時"));
    }, TIME_CONSTANTS.AUDIO_LOAD_TIMEOUT + 2000); // 音訊載入超時加2秒

    // 設置清理函數
    const cleanup = () => {
      clearTimeout(timeoutId);
      if (audioContext && audioContext.state !== "closed") {
        try {
          audioContext.close();
        } catch (err) {
          logger.error("關閉 AudioContext 時發生錯誤", { error: err });
        }
      }
    };

    // 將 Blob 轉換為 ArrayBuffer
    const fileReader = new FileReader();

    fileReader.onload = function () {
      try {
        // 解碼音訊數據
        audioContext.decodeAudioData(
          fileReader.result,
          (audioBuffer) => {
            // 獲取持續時間（秒）並轉換為毫秒
            const durationMs = Math.round(audioBuffer.duration * 1000);
            logger.debug("使用 Web Audio API 獲取到持續時間", { durationMs });

            // 清理資源
            cleanup();
            resolve(durationMs);
          },
          (decodeError) => {
            logger.error("解碼音訊數據時發生錯誤", { error: decodeError });

            // 清理資源
            cleanup();
            reject(decodeError);
          }
        );
      } catch (decodeError) {
        logger.error("處理音訊數據時發生錯誤", { error: decodeError });

        // 清理資源
        cleanup();
        reject(decodeError);
      }
    };

    fileReader.onerror = function (readError) {
      logger.error("讀取 Blob 時發生錯誤", { error: readError });

      // 清理資源
      cleanup();
      reject(readError);
    };

    // 開始讀取 Blob
    fileReader.readAsArrayBuffer(blob);
  } catch (error) {
    logger.error("使用 Web Audio API 計算持續時間失敗", { error });
    reject(error);
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
export function evaluateAudioLikelihood(blob) {
  if (!blob) {
    return {
      isLikelyAudio: false,
      confidenceScore: 0,
      confidenceReason: ["無效的 Blob 對象"],
    };
  }

  // 初始化變數
  let confidenceScore = 0;
  const confidenceReason = [];

  // 根據 MIME 類型評分
  if (blob.type) {
    if (blob.type.includes("audio/")) {
      confidenceScore += 30;
      confidenceReason.push("音訊 MIME 類型");
    } else if (
      blob.type.includes("video/mp4") ||
      blob.type.includes("video/mpeg")
    ) {
      confidenceScore += 20;
      confidenceReason.push("MP4 容器格式 (可能包含音訊)");
    }
  } else {
    confidenceScore -= 10;
    confidenceReason.push("無 MIME 類型");
  }

  // 根據檔案大小評分
  if (blob.size) {
    // 典型的語音訊息大小範圍
    if (blob.size >= 20 * 1024 && blob.size <= 2 * 1024 * 1024) {
      // 20KB 到 2MB
      confidenceScore += 20;
      confidenceReason.push("合理的語音訊息大小");
    } else if (blob.size < 5 * 1024) {
      confidenceScore -= 15;
      confidenceReason.push("檔案太小");
    } else if (blob.size > 10 * 1024 * 1024) {
      confidenceScore -= 15;
      confidenceReason.push("檔案太大");
    }
  }

  // 分類大小
  let sizeCategory = "未知";
  if (blob.size < 10 * 1024) {
    sizeCategory = "極小 (<10KB)";
  } else if (blob.size < 100 * 1024) {
    sizeCategory = "小 (10KB-100KB)";
  } else if (blob.size < 1024 * 1024) {
    sizeCategory = "中 (100KB-1MB)";
  } else if (blob.size < 10 * 1024 * 1024) {
    sizeCategory = "大 (1MB-10MB)";
  } else {
    sizeCategory = "極大 (>10MB)";
  }

  // 判斷最終信心度
  const isLikelyAudio = confidenceScore >= 30;

  return {
    isLikelyAudio,
    confidenceScore,
    confidenceReason,
    sizeCategory,
    blobType: blob.type,
    blobSize: blob.size,
    blobSizeKB: (blob.size / 1024).toFixed(2),
  };
}

// 匯出所有功能
export default {
  calculateAudioDuration,
  extractBlobContent,
  evaluateAudioLikelihood,
};
