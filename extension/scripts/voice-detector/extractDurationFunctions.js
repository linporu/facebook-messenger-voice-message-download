/**
 * 從 content-disposition 標頭提取持續時間
 * 
 * @param {string} contentDisposition - Content-Disposition 標頭值
 * @returns {number|null} - 持續時間（毫秒），如果無法提取則返回 null
 */
function extractDurationFromContentDisposition(contentDisposition) {
  if (!contentDisposition) {
    console.log('[DEBUG-NETWORK] content-disposition 為空');
    return null;
  }
  
  console.log('[DEBUG-NETWORK] 分析 content-disposition:', contentDisposition);
  
  // 嘗試多種可能的格式
  
  // 格式範例 1：attachment; filename=audioclip-1742393117000-30999.mp4
  const oldFormatMatch = contentDisposition.match(/filename=audioclip-\d+-(\d+)\.mp4/);
  if (oldFormatMatch && oldFormatMatch[1]) {
    const durationMs = parseInt(oldFormatMatch[1], 10);
    console.log('[DEBUG-NETWORK] 匹配到舊格式持續時間:', durationMs);
    return isNaN(durationMs) ? null : durationMs;
  }
  
  // 格式範例 2：attachment; filename="audio_message.mp4"; duration=30999
  const durationMatch = contentDisposition.match(/duration=(\d+)/);
  if (durationMatch && durationMatch[1]) {
    const durationMs = parseInt(durationMatch[1], 10);
    console.log('[DEBUG-NETWORK] 匹配到持續時間標記:', durationMs);
    return isNaN(durationMs) ? null : durationMs;
  }
  
  // 嘗試其他可能的檔案名格式
  const filenameMatch = contentDisposition.match(/filename=["']?([^"']+)["']?/);
  console.log('[DEBUG-NETWORK] 檔案名匹配:', filenameMatch ? filenameMatch[1] : null);
  
  console.log('[DEBUG-NETWORK] 未匹配到持續時間模式');
  return null;
}

/**
 * 從 URL 提取持續時間
 * 
 * @param {string} url - 請求 URL
 * @returns {number|null} - 持續時間（毫秒），如果無法提取則返回 null
 */
function extractDurationFromUrl(url) {
  if (!url) {
    return null;
  }
  
  console.log('[DEBUG-NETWORK] 嘗試從 URL 提取持續時間:', url.substring(0, 100));
  
  // 嘗試從 URL 中提取持續時間
  // 格式範例：...duration=30999...
  const durationMatch = url.match(/[?&]duration=(\d+)/);
  if (durationMatch && durationMatch[1]) {
    const durationMs = parseInt(durationMatch[1], 10);
    console.log('[DEBUG-NETWORK] 從 URL 匹配到持續時間:', durationMs);
    return isNaN(durationMs) ? null : durationMs;
  }
  
  return null;
}

/**
 * 根據 content-type 和 URL 判斷是否可能是語音訊息檔案
 * 
 * @param {string} contentType - Content-Type 標頭值
 * @param {string} url - 請求 URL
 * @returns {boolean} - 是否可能是語音訊息檔案
 */
function isLikelyAudioFile(contentType, url) {
  // 檢查 content-type
  if (contentType) {
    if (
      contentType.includes('audio/') ||
      contentType.includes('video/mp4') ||
      contentType.includes('application/octet-stream')
    ) {
      console.log('[DEBUG-NETWORK] 根據 content-type 判斷為語音檔案:', contentType);
      return true;
    }
  }
  
  // 檢查 URL 特徵
  if (url) {
    if (
      url.includes('/o1/v/t2/f2/m69/') ||
      url.includes('/v/t/') ||
      url.includes('audioclip')
    ) {
      console.log('[DEBUG-NETWORK] 根據 URL 判斷為語音檔案:', url.substring(0, 100));
      return true;
    }
  }
  
  return false;
}
