/**
 * 提取持續時間相關的輔助函數
 */

import { Logger } from "../utils/logger.js";

/**
 * 從 content-disposition 標頭提取持續時間
 *
 * @param {string} contentDisposition - Content-Disposition 標頭值
 * @returns {number|null} - 持續時間（毫秒），如果無法提取則返回 null
 */
export function extractDurationFromContentDisposition(contentDisposition) {
  if (!contentDisposition) {
    Logger.debug("content-disposition 為空", { module: "network" });
    return null;
  }

  Logger.debug("分析 content-disposition", {
    module: "network",
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
      module: "network",
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  // 格式範例 2：attachment; filename="audio_message.mp4"; duration=30999
  const durationMatch = contentDisposition.match(/duration=(\d+)/);
  if (durationMatch && durationMatch[1]) {
    const durationMs = parseInt(durationMatch[1], 10);
    Logger.debug("匹配到持續時間標記", { module: "network", data: durationMs });
    return isNaN(durationMs) ? null : durationMs;
  }

  // 嘗試其他可能的檔案名格式
  const filenameMatch = contentDisposition.match(/filename=["']?([^"']+)["']?/);
  Logger.debug("檔案名匹配", {
    module: "network",
    data: filenameMatch ? filenameMatch[1] : null,
  });

  Logger.debug("未匹配到持續時間模式", { module: "network" });
  return null;
}

/**
 * 從 URL 提取持續時間
 *
 * @param {string} url - 請求 URL
 * @returns {number|null} - 持續時間（毫秒），如果無法提取則返回 null
 */
export function extractDurationFromUrl(url) {
  if (!url) {
    return null;
  }

  Logger.debug("嘗試從 URL 提取持續時間", {
    module: "network",
    data: url.substring(0, 100),
  });

  // 嘗試多種可能的 URL 格式

  // 格式範例 1：...audioclip-1742393117000-30999.mp4...
  // 這是 Facebook Messenger 語音訊息的常見格式
  const audioclipMatch = url.match(/audioclip-\d+-([0-9]+)\.mp4/);
  if (audioclipMatch && audioclipMatch[1]) {
    const durationMs = parseInt(audioclipMatch[1], 10);
    Logger.debug("從 URL audioclip 格式匹配到持續時間", {
      module: "network",
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
      module: "network",
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
      module: "network",
      data: durationMs,
    });
    return isNaN(durationMs) ? null : durationMs;
  }

  Logger.debug("無法從 URL 提取持續時間", { module: "network" });
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
        module: "network",
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
        module: "network",
        data: url.substring(0, 100),
      });
      return true;
    }
  }

  return false;
}
