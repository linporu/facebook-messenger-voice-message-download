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
  AUDIO_REGEX,
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
export function isLikelyVoiceMessage(url, method, statusCode, metadata) {
  // 1. 基本檢查：URL 存在、為 GET 請求、狀態碼表示成功
  if (!url || method !== "GET") return false;

  if (
    statusCode &&
    !WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES.includes(statusCode)
  ) {
    return false;
  }

  // 2. 網域檢查：是否來自已知 CDN
  const isFromKnownCdn = SUPPORTED_SITES.CDN_PATTERNS.some((pattern) => {
    const domain = pattern.replace("*://*.", "").replace("/*", "");
    return url.includes(domain);
  });

  if (!isFromKnownCdn) return false;

  // 3. 內容類型檢查：是否為音訊
  if (
    metadata.contentType &&
    !WEB_REQUEST_CONSTANTS.AUDIO_CONTENT_TYPES.includes(metadata.contentType)
  ) {
    return false;
  }

  // 4. 檔案大小檢查：是否在合理範圍內
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

  // 所有提取方法皆失敗，回傳 null
  Logger.debug("所有提取持續時間方法皆失敗", {
    module: MODULE_NAMES.AUDIO_ANALYZER,
  });
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
  const oldFormatMatch =
    AUDIO_REGEX.OLD_FORMAT_FILENAME.exec(contentDisposition);
  if (oldFormatMatch && oldFormatMatch[1]) {
    const durationMs = parseInt(oldFormatMatch[1], 10);
    Logger.debug("匹配到舊格式持續時間", {
      module: MODULE_NAMES.AUDIO_ANALYZER,
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  // 格式範例 2：attachment; filename="audio_message.mp4"; duration=30999
  const durationMatch = AUDIO_REGEX.DURATION_PARAM.exec(contentDisposition);
  if (durationMatch && durationMatch[1]) {
    const durationMs = parseInt(durationMatch[1], 10);
    Logger.debug("匹配到持續時間標記", {
      module: MODULE_NAMES.AUDIO_ANALYZER,
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  // 嘗試其他可能的檔案名格式
  const filenameMatch = AUDIO_REGEX.FILENAME_PATTERN.exec(contentDisposition);
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
  const audioclipMatch = AUDIO_REGEX.AUDIOCLIP_URL.exec(url);
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
  const durationMatch = AUDIO_REGEX.DURATION_URL_PARAM.exec(url);
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
  const lengthMatch = AUDIO_REGEX.LENGTH_URL_PARAM.exec(url);
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
