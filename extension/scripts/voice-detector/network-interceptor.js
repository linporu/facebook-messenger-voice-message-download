/**
 * network-interceptor.js
 * 負責攔截網路請求以獲取音訊 URL
 */

import { registerDownloadUrl } from './data-store.js';

/**
 * 初始化網路攔截器
 * 
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function initNetworkInterceptor(voiceMessages) {
  console.log('初始化網路攔截器');
  
  // 保存原始的 fetch 函數
  const originalFetch = window.fetch;
  
  // 代理 fetch 函數
  window.fetch = async function(resource, options) {
    // 呼叫原始的 fetch 函數
    const response = await originalFetch.apply(this, arguments);
    
    try {
      // 複製 response 以便我們可以讀取它
      const responseClone = response.clone();
      
      // 檢查請求 URL 是否包含 ".mp4" 和 "audioclip"
      const url = typeof resource === 'string' ? resource : resource.url;
      
      if (url && url.includes('.mp4') && url.includes('audioclip')) {
        // 處理語音訊息請求
        processAudioResponse(voiceMessages, url, responseClone);
      }
    } catch (error) {
      console.error('處理網路請求時發生錯誤:', error);
    }
    
    return response;
  };
}

/**
 * 處理音訊回應
 * 
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {string} url - 請求 URL
 * @param {Response} response - 回應物件
 */
async function processAudioResponse(voiceMessages, url, response) {
  try {
    // 從回應標頭中提取重要資訊
    const contentDisposition = response.headers.get('content-disposition');
    const lastModified = response.headers.get('last-modified');
    
    // 從 content-disposition 提取持續時間
    // 格式範例：attachment; filename=audioclip-1742393117000-30999.mp4
    const durationMs = extractDurationFromContentDisposition(contentDisposition);
    
    if (durationMs) {
      // 註冊下載 URL
      registerDownloadUrl(voiceMessages, durationMs, url, lastModified);
      
      console.log('攔截到語音訊息下載 URL', {
        url,
        durationMs,
        lastModified
      });
    }
  } catch (error) {
    console.error('處理音訊回應時發生錯誤:', error);
  }
}

/**
 * 從 content-disposition 標頭提取持續時間
 * 
 * @param {string} contentDisposition - Content-Disposition 標頭值
 * @returns {number|null} - 持續時間（毫秒），如果無法提取則返回 null
 */
function extractDurationFromContentDisposition(contentDisposition) {
  if (!contentDisposition) {
    return null;
  }
  
  // 格式範例：attachment; filename=audioclip-1742393117000-30999.mp4
  const match = contentDisposition.match(/filename=audioclip-\d+-(\d+)\.mp4/);
  
  if (match && match[1]) {
    const durationMs = parseInt(match[1], 10);
    return isNaN(durationMs) ? null : durationMs;
  }
  
  return null;
}
