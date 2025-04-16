/**
 * audio-analyzer.js
 * 分析音訊的輔助函數
 */

import { Logger } from "../utils/logger.js";
import {
  MODULE_NAMES,
  SUPPORTED_SITES,
  BLOB_MONITOR_CONSTANTS,
  WEB_REQUEST_CONSTANTS,
} from "../utils/constants.js";

// ================================================
// 語音訊息檢測函數
// ================================================

/**
 * 判斷請求是否為語音訊息
 * @param {string} url - 請求 URL
 * @param {string} method - HTTP 方法
 * @param {number} statusCode - HTTP 狀態碼
 * @param {Object} metadata - 選擇性，請求的元數據
 * @returns {boolean} - 是否為語音訊息
 */
export function isVoiceMessage(url, method, statusCode, metadata = null) {
  // 1. 基本檢查：URL 存在、為 GET 請求、狀態碼表示成功
  if (!url || method !== "GET") return false;

  if (
    statusCode &&
    !WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES.includes(statusCode)
  ) {
    return false;
  }

  // 2. URL 模式檢查
  const hasAudioKeyword = WEB_REQUEST_CONSTANTS.AUDIO_KEYWORDS.some((keyword) =>
    url.includes(keyword)
  );

  const isFromKnownCdn = SUPPORTED_SITES.CDN_PATTERNS.some((pattern) => {
    const domain = pattern.replace("*://*.", "").replace("/*", "");
    return url.includes(domain);
  });

  if (!hasAudioKeyword && !isFromKnownCdn) return false;

  // 3. 若有提供元數據，進行額外檢查
  if (metadata) {
    // 檢查內容類型是否為音訊
    if (metadata.contentType && !isLikelyAudioFile(metadata.contentType, url)) {
      return false;
    }

    // 檢查檔案大小是否在合理範圍內
    if (metadata.contentLength) {
      const fileSizeBytes = parseInt(metadata.contentLength, 10);
      if (
        !isNaN(fileSizeBytes) &&
        (fileSizeBytes < BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE ||
          fileSizeBytes > BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE)
      ) {
        return false;
      }
    }
  }

  return true;
}

// ===========================================
// 獲得音訊持續時間
// ===========================================

/**
 * 嘗試獲取音訊持續時間
 * @param {Object} metadata - 基本元數據
 * @param {string} url - 檔案 URL
 * @returns {number|null} - 持續時間（毫秒）或 null
 */
export function getAudioDuration(metadata, url) {
  // 1. 嘗試從 content-disposition 提取
  if (metadata.contentDisposition) {
    const duration = getAudioDurationFromContentDisposition(
      metadata.contentDisposition
    );
    if (duration) return duration;
  }

  // 2. 嘗試從 URL 提取
  const urlDuration = getAudioDurationFromUrl(url);
  if (urlDuration) return urlDuration;

  // 3. 嘗試從檔案大小估算
  if (metadata.contentLength && isLikelyAudioFile(metadata.contentType, url)) {
    const fileSizeBytes = parseInt(metadata.contentLength, 10);
    if (isNaN(fileSizeBytes)) return null;

    // 檢查檔案大小是否在合理範圍內
    if (
      fileSizeBytes < BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE ||
      fileSizeBytes > BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE
    ) {
      return null;
    }

    // 估計持續時間：檔案大小（位元）/ 比特率（每秒位元）
    let estimatedDuration = Math.round(
      ((fileSizeBytes * 8) /
        (WEB_REQUEST_CONSTANTS.AVERAGE_AUDIO_BITRATE * 1024)) *
        1000
    );

    // 確保持續時間在有效範圍內
    estimatedDuration = Math.max(
      estimatedDuration,
      BLOB_MONITOR_CONSTANTS.MIN_VALID_DURATION
    );
    estimatedDuration = Math.min(
      estimatedDuration,
      BLOB_MONITOR_CONSTANTS.MAX_VALID_DURATION
    );

    metadata.isDurationEstimated = true;
    return estimatedDuration;
  }

  return null;
}

/**
 * 從 content-disposition 標頭提取持續時間
 *
 * @param {string} contentDisposition - Content-Disposition 標頭值
 * @returns {number|null} - 持續時間（毫秒），如果無法提取則返回 null
 */
export function getAudioDurationFromContentDisposition(contentDisposition) {
  if (!contentDisposition) {
    Logger.debug("content-disposition 為空", {
      module: MODULE_NAMES.AUDIO_ANALYZER,
    });
    return null;
  }

  Logger.debug("分析 content-disposition", {
    module: MODULE_NAMES.AUDIO_ANALYZER,
    data: contentDisposition,
  });

  // 嘗試多種可能的格式

  // 格式範例 1：attachment; filename=audioclip-1742393117000-30999.mp4
  const oldFormatMatch = contentDisposition.match(
    /filename=audioclip-\d+-(\d+)\.mp4/
  );
  if (oldFormatMatch && oldFormatMatch[1]) {
    const durationMs = parseInt(oldFormatMatch[1], 10);
    Logger.debug("匹配到舊格式持續時間", {
      module: MODULE_NAMES.AUDIO_ANALYZER,
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  // 格式範例 2：attachment; filename="audio_message.mp4"; duration=30999
  const durationMatch = contentDisposition.match(/duration=(\d+)/);
  if (durationMatch && durationMatch[1]) {
    const durationMs = parseInt(durationMatch[1], 10);
    Logger.debug("匹配到持續時間標記", {
      module: MODULE_NAMES.AUDIO_ANALYZER,
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  // 嘗試其他可能的檔案名格式
  const filenameMatch = contentDisposition.match(/filename=["']?([^"']+)["']?/);
  Logger.debug("檔案名匹配", {
    module: MODULE_NAMES.AUDIO_ANALYZER,
    data: filenameMatch ? filenameMatch[1] : null,
  });

  Logger.debug("未匹配到持續時間模式", { module: MODULE_NAMES.AUDIO_ANALYZER });
  return null;
}

/**
 * 從 URL 提取持續時間
 *
 * @param {string} url - 請求 URL
 * @returns {number|null} - 持續時間（毫秒），如果無法提取則返回 null
 */
export function getAudioDurationFromUrl(url) {
  if (!url) {
    return null;
  }

  Logger.debug("嘗試從 URL 提取持續時間", {
    module: MODULE_NAMES.AUDIO_ANALYZER,
    data: url.substring(0, 100),
  });

  // 嘗試多種可能的 URL 格式

  // 格式範例 1：...audioclip-1742393117000-30999.mp4...
  // 這是 Facebook Messenger 語音訊息的常見格式
  const audioclipMatch = url.match(/audioclip-\d+-([0-9]+)\.mp4/);
  if (audioclipMatch && audioclipMatch[1]) {
    const durationMs = parseInt(audioclipMatch[1], 10);
    Logger.debug("從 URL audioclip 格式匹配到持續時間", {
      module: MODULE_NAMES.AUDIO_ANALYZER,
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  // 格式範例 2：...duration=30999...
  // 這是一些 API 回應中可能的格式
  const durationMatch = url.match(/[?&]duration=(\d+)/);
  if (durationMatch && durationMatch[1]) {
    const durationMs = parseInt(durationMatch[1], 10);
    Logger.debug("從 URL 參數匹配到持續時間", {
      module: MODULE_NAMES.AUDIO_ANALYZER,
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  // 格式範例 3：...length=30999...
  // 這是另一種可能的格式
  const lengthMatch = url.match(/[?&]length=(\d+)/);
  if (lengthMatch && lengthMatch[1]) {
    const durationMs = parseInt(lengthMatch[1], 10);
    Logger.debug("從 URL length 參數匹配到持續時間", {
      module: MODULE_NAMES.AUDIO_ANALYZER,
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  Logger.debug("無法從 URL 提取持續時間", {
    module: MODULE_NAMES.AUDIO_ANALYZER,
  });
  return null;
}

/**
 * 根據 content-type 和 URL 判斷是否可能是語音訊息檔案
 *
 * @param {string} contentType - Content-Type 標頭值
 * @param {string} url - 請求 URL
 * @returns {boolean} - 是否可能是語音訊息檔案
 */
export function isLikelyAudioFile(contentType, url) {
  // 檢查 content-type
  if (contentType) {
    if (
      contentType.includes("audio/") ||
      contentType.includes("video/mp4") ||
      contentType.includes("application/octet-stream")
    ) {
      Logger.debug("根據 content-type 判斷為語音檔案", {
        module: MODULE_NAMES.AUDIO_ANALYZER,
        data: contentType,
      });
      return true;
    }
  }

  // 檢查 URL 特徵
  if (url) {
    if (
      url.includes("/o1/v/t2/f2/m69/") ||
      url.includes("/v/t/") ||
      url.includes("audioclip")
    ) {
      Logger.debug("根據 URL 判斷為語音檔案", {
        module: MODULE_NAMES.AUDIO_ANALYZER,
        data: url.substring(0, 100),
      });
      return true;
    }
  }

  return false;
}
