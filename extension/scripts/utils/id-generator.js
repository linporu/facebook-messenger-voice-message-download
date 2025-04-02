/**
 * id-generator.js
 * 提供生成唯一 ID 的功能，用於標識語音訊息元素和相關資料
 */

import { Logger } from "./logger.js";
import { ID_CONSTANTS } from "./constants.js";

/**
 * 生成語音訊息的唯一 ID
 * 格式：voice-msg-{timestamp}-{隨機字串}
 *
 * @returns {string} 唯一 ID
 */
export function generateVoiceMessageId() {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const id = `${ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX}${timestamp}-${randomString}`;

  Logger.debug("生成語音訊息 ID", { id, timestamp });
  return id;
}

/**
 * 檢查 ID 是否為語音訊息 ID
 *
 * @param {string} id - 要檢查的 ID
 * @returns {boolean} - 如果 ID 是語音訊息 ID 則返回 true
 */
export function isVoiceMessageId(id) {
  return typeof id === "string" && id.startsWith(ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX);
}

/**
 * 從 ID 中提取時間戳
 *
 * @param {string} id - 語音訊息 ID
 * @returns {number|null} - 時間戳（毫秒），如果 ID 格式不正確則返回 null
 */
export function extractTimestampFromId(id) {
  if (!isVoiceMessageId(id)) {
    Logger.warn("嘗試從無效 ID 提取時間戳", { id });
    return null;
  }

  const parts = id.split("-");
  if (parts.length >= 3) {
    const timestamp = parseInt(parts[2], 10);
    if (isNaN(timestamp)) {
      Logger.warn("從 ID 提取的時間戳無效", { id, parts });
      return null;
    }
    Logger.debug("從 ID 提取時間戳成功", { id, timestamp });
    return timestamp;
  }

  Logger.warn("ID 格式不正確，無法提取時間戳", { id, parts });
  return null;
}
