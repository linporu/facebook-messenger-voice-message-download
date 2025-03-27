/**
 * id-generator.js
 * 提供生成唯一 ID 的功能，用於標識語音訊息元素和相關資料
 */

/**
 * 生成語音訊息的唯一 ID
 * 格式：voice-msg-{timestamp}-{隨機字串}
 * 
 * @returns {string} 唯一 ID
 */
export function generateVoiceMessageId() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  return `voice-msg-${timestamp}-${randomString}`;
}

/**
 * 檢查 ID 是否為語音訊息 ID
 * 
 * @param {string} id - 要檢查的 ID
 * @returns {boolean} - 如果 ID 是語音訊息 ID 則返回 true
 */
export function isVoiceMessageId(id) {
  return typeof id === 'string' && id.startsWith('voice-msg-');
}

/**
 * 從 ID 中提取時間戳
 * 
 * @param {string} id - 語音訊息 ID
 * @returns {number|null} - 時間戳（毫秒），如果 ID 格式不正確則返回 null
 */
export function extractTimestampFromId(id) {
  if (!isVoiceMessageId(id)) {
    return null;
  }
  
  const parts = id.split('-');
  if (parts.length >= 3) {
    const timestamp = parseInt(parts[2], 10);
    return isNaN(timestamp) ? null : timestamp;
  }
  
  return null;
}
