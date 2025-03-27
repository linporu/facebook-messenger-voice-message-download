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
import { getDownloadUrlForElement, findItemByDuration } from "./data-store.js";

/**
 * 初始化右鍵選單處理器
 *
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function initContextMenuHandler(voiceMessages) {
  console.log("初始化右鍵選單處理器");

  // 監聽 contextmenu 事件
  document.addEventListener("contextmenu", (event) => {
    handleContextMenu(event, voiceMessages);
  });
}

/**
 * 處理右鍵選單事件
 *
 * @param {MouseEvent} event - 滑鼠事件
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
function handleContextMenu(event, voiceMessages) {
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

  if (id) {
    // 如果有 ID，獲取下載 URL
    const urlInfo = getDownloadUrlForElement(voiceMessages, sliderElement);
    console.log("[DEBUG] 獲取下載 URL 結果:", urlInfo);

    if (urlInfo && urlInfo.downloadUrl) {
      // 發送訊息到背景腳本
      console.log("[DEBUG] 準備發送右鍵點擊訊息 (通過 ID)");
      sendRightClickMessage(id, urlInfo.downloadUrl, urlInfo.lastModified);
    } else {
      console.log("[DEBUG] 未找到匹配的下載 URL");
    }
  } else {
    // 如果沒有 ID，從滑桿元素獲取持續時間
    const durationSec = getDurationFromSlider(sliderElement);
    console.log("[DEBUG] 從滑桿獲取的持續時間(秒):", durationSec);

    if (durationSec !== null) {
      // 將秒轉換為毫秒
      const durationMs = secondsToMilliseconds(durationSec);
      console.log("[DEBUG] 持續時間(毫秒):", durationMs);
      console.log("[DEBUG] voiceMessages 資料:", {
        itemsCount: voiceMessages.items.size,
      });

      let found = false;
      // 在 voiceMessages 中查找匹配的項目
      const matchedItem = findItemByDuration(voiceMessages, durationMs);
      console.log("[DEBUG] 查找匹配項目結果:", matchedItem);

      if (matchedItem && matchedItem.downloadUrl) {
        // 發送訊息到背景腳本
        console.log(
          "[DEBUG] 找到匹配項目，準備發送右鍵點擊訊息 (通過持續時間)"
        );
        sendRightClickMessage(
          matchedItem.id,
          matchedItem.downloadUrl,
          matchedItem.lastModified
        );
        found = true;
      }

      if (!found) {
        console.log("[DEBUG] 未找到匹配的語音訊息項目");
      }
    } else {
      console.log("[DEBUG] 無法從滑桿獲取持續時間");
    }
  }
}

/**
 * 發送右鍵點擊訊息到背景腳本
 *
 * @param {string} elementId - 元素 ID
 * @param {string} downloadUrl - 下載 URL
 * @param {string} [lastModified] - Last-Modified 標頭值
 */
function sendRightClickMessage(elementId, downloadUrl, lastModified) {
  // 準備訊息物件
  const message = {
    action: "rightClickOnVoiceMessage",
    elementId,
    downloadUrl,
    lastModified,
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
