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
      // 檢查請求 URL 是否包含 ".mp4" 和 "audioclip"
      const url = typeof resource === 'string' ? resource : resource.url;
      
      console.log('[DEBUG-NETWORK] 攝獲到網路請求:', {
        url: url ? url.substring(0, 100) : null,
        method: options?.method || 'GET',
        status: response.status
      });
      
      // 檢查是否為語音訊息請求
      const isOldFormat = url && url.includes('.mp4') && url.includes('audioclip');
      const isNewFormat = url && (
        // 新的 Facebook 語音訊息 URL 格式
        (url.includes('scontent') && url.includes('/o1/v/t2/f2/m69/')) ||
        // 可能的其他格式
        (url.includes('fbcdn.net') && url.includes('/v/t'))
      );
      
      if (isOldFormat || isNewFormat) {
        console.log('[DEBUG-NETWORK] 偵測到語音訊息請求:', {
          url: url.substring(0, 100),
          isOldFormat,
          isNewFormat
        });
        
        // 複製 response 以便我們可以讀取它
        const responseClone = response.clone();
        
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
    const contentType = response.headers.get('content-type');
    const lastModified = response.headers.get('last-modified');
    const contentLength = response.headers.get('content-length');
    
    console.log('[DEBUG-NETWORK] 音訊回應標頭:', {
      contentDisposition,
      contentType,
      contentLength,
      lastModified
    });
    
    // 嘗試從標頭中提取持續時間
    let durationMs = null;
    
    // 從 content-disposition 提取持續時間
    if (contentDisposition) {
      durationMs = extractDurationFromContentDisposition(contentDisposition);
    }
    
    // 如果無法從 content-disposition 提取，嘗試從 URL 提取
    if (!durationMs) {
      durationMs = extractDurationFromUrl(url);
    }
    
    console.log('[DEBUG-NETWORK] 提取的持續時間(毫秒):', durationMs);
    
    // 如果仍然無法提取持續時間，但我們確定這是語音訊息，則使用估計的持續時間
    if (!durationMs && isLikelyAudioFile(contentType, url)) {
      // 如果有 content-length，可以使用它來估計持續時間
      // 假設平均比特率為 32 kbps
      if (contentLength) {
        const fileSizeBytes = parseInt(contentLength, 10);
        if (!isNaN(fileSizeBytes)) {
          // 根據檔案大小估計持續時間（毫秒）
          // 公式：持續時間 = 檔案大小（位元） / 比特率（每秒位元）
          durationMs = Math.round((fileSizeBytes * 8) / (32 * 1024) * 1000);
          console.log('[DEBUG-NETWORK] 根據檔案大小估計的持續時間:', durationMs);
        }
      } else {
        // 如果無法估計，使用一個預設值
        durationMs = 30000; // 預設 30 秒
        console.log('[DEBUG-NETWORK] 使用預設持續時間:', durationMs);
      }
    }
    
    if (durationMs) {
      // 註冊下載 URL
      console.log('[DEBUG-NETWORK] 準備註冊下載 URL:', {
        durationMs,
        url: url.substring(0, 100) + '...'
      });
      
      const result = registerDownloadUrl(voiceMessages, durationMs, url, lastModified);
      console.log('[DEBUG-NETWORK] 註冊下載 URL 結果:', result);
      
      // 輸出更詳細的資料狀態，包括所有項目的詳細資訊
      console.log('[DEBUG-NETWORK] voiceMessages 資料狀態:', {
        itemsCount: voiceMessages.items.size,
        items: Array.from(voiceMessages.items.entries()).map(([id, item]) => ({
          id,
          durationMs: item.durationMs,
          hasDownloadUrl: !!item.downloadUrl,
          isPending: !!item.isPending
        }))
      });
      
      console.log('攔截到語音訊息下載 URL', {
        url: url.substring(0, 100) + '...',
        durationMs,
        lastModified
      });
    } else {
      console.log('[DEBUG-NETWORK] 無法提取持續時間:', {
        contentDisposition,
        url: url.substring(0, 100) + '...'
      });
    }
  } catch (error) {
    console.error('[DEBUG-NETWORK] 處理音訊回應時發生錯誤:', error);
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
