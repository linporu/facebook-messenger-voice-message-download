/**
 * context-menu-handler.js
 * 負責處理右鍵選單事件
 */

import {
  findVoiceMessageElement,
  getDurationFromSlider,
  getSliderFromPlayButton,
} from "../utils/dom-utils.js";
import { secondsToMilliseconds } from "../utils/time-utils.js";

/**
 * 初始化右鍵選單處理器
 */
export function initContextMenuHandler() {
  console.log("初始化右鍵選單處理器");

  // 監聽 contextmenu 事件
  document.addEventListener("contextmenu", (event) => {
    handleContextMenu(event);
  });
}

/**
 * 處理右鍵選單事件
 *
 * @param {MouseEvent} event - 滑鼠事件
 */
function handleContextMenu(event) {
  // 記錄實際點擊的元素
  const clickedElement = event.target;
  console.log("[DEBUG] 右鍵點擊元素:", clickedElement);

  // 尋找語音訊息元素
  const result = findVoiceMessageElement(clickedElement);
  console.log("[DEBUG] 尋找語音訊息元素結果:", result);

  if (!result) {
    // 如果找不到語音訊息元素，不做任何處理
    console.log("[DEBUG] 未找到語音訊息元素");
    return;
  }

  const { element, type } = result;
  console.log("[DEBUG] 找到語音訊息元素類型:", type);

  // 根據元素類型獲取滑桿元素
  const sliderElement =
    type === "slider" ? element : getSliderFromPlayButton(element);
  console.log("[DEBUG] 滑桿元素:", sliderElement);

  if (!sliderElement) {
    console.log("[DEBUG] 未找到滑桿元素");
    return;
  }

  // 檢查元素是否有 data-voice-message-id 屬性
  const id = sliderElement.getAttribute("data-voice-message-id");
  console.log("[DEBUG] 語音訊息 ID:", id);

  // 從滑桿元素獲取持續時間
  const durationSec = getDurationFromSlider(sliderElement);
  console.log("[DEBUG] 從滑桿獲取的持續時間(秒):", durationSec);

  if (durationSec !== null) {
    // 將秒轉換為毫秒
    const durationMs = secondsToMilliseconds(durationSec);
    console.log("[DEBUG] 持續時間(毫秒):", durationMs);

    // 發送訊息到背景腳本，包含元素 ID 和持續時間
    console.log("[DEBUG] 準備發送右鍵點擊訊息");
    sendRightClickMessage(id, null, null, durationMs);
  } else {
    console.log("[DEBUG] 無法從滑桿獲取持續時間");
  }
}

/**
 * 發送右鍵點擊訊息到背景腳本
 *
 * @param {string} elementId - 元素 ID
 * @param {string} downloadUrl - 下載 URL
 * @param {string} [lastModified] - Last-Modified 標頭值
 * @param {number} [durationMs] - 持續時間（毫秒）
 */
function sendRightClickMessage(
  elementId,
  downloadUrl,
  lastModified,
  durationMs
) {
  // 準備訊息物件
  const message = {
    action: "rightClickOnVoiceMessage",
    elementId,
    downloadUrl,
    lastModified,
    durationMs,
  };

  console.log("[DEBUG] 準備發送訊息到背景腳本:", message);

  // 使用 window.sendToBackground 發送訊息
  if (window.sendToBackground) {
    try {
      // 添加錯誤處理
      window.sendToBackground(message);
      console.log("[DEBUG] 訊息已發送到背景腳本");
    } catch (error) {
      console.error("[DEBUG] 發送訊息到背景腳本時發生錯誤:", error);

      // 如果使用 sendToBackground 失敗，嘗試使用 chrome.runtime.sendMessage
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage(message, (response) => {
            console.log("[DEBUG] chrome.runtime.sendMessage 回應:", response);
          });
          console.log("[DEBUG] 已使用 chrome.runtime.sendMessage 發送訊息");
        } catch (chromeError) {
          console.error(
            "[DEBUG] 使用 chrome.runtime.sendMessage 發生錯誤:",
            chromeError
          );
        }
      }
    }
  } else {
    // 如果沒有 sendToBackground 函數，嘗試使用 chrome.runtime.sendMessage
    console.warn(
      "[DEBUG] sendToBackground 函數不存在，嘗試使用 chrome.runtime.sendMessage"
    );

    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          console.log("[DEBUG] chrome.runtime.sendMessage 回應:", response);
        });
        console.log("[DEBUG] 已使用 chrome.runtime.sendMessage 發送訊息");
      } catch (error) {
        console.error(
          "[DEBUG] 使用 chrome.runtime.sendMessage 發生錯誤:",
          error
        );
      }
    } else {
      console.error("[DEBUG] 無法發送訊息到背景腳本，所有可用的方法都失敗");
    }
  }

  console.log("發送右鍵點擊訊息", {
    elementId,
    downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
    lastModified,
  });
}
