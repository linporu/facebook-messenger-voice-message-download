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
import { Logger } from "../utils/logger.js";

/**
 * 初始化右鍵選單處理器
 */
export function initContextMenuHandler() {
  Logger.info("初始化右鍵選單處理器", { module: "context-menu" });

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
  Logger.debug("右鍵點擊元素", {
    module: "context-menu",
    data: clickedElement,
  });

  // 尋找語音訊息元素
  const result = findVoiceMessageElement(clickedElement);
  Logger.debug("尋找語音訊息元素結果", {
    module: "context-menu",
    data: result,
  });

  if (!result) {
    // 如果找不到語音訊息元素，不做任何處理
    Logger.debug("未找到語音訊息元素", { module: "context-menu" });
    return;
  }

  const { element, type } = result;
  Logger.debug("找到語音訊息元素類型", { module: "context-menu", data: type });

  // 根據元素類型獲取滑桿元素
  const sliderElement =
    type === "slider" ? element : getSliderFromPlayButton(element);
  Logger.debug("滑桿元素", { module: "context-menu", data: sliderElement });

  if (!sliderElement) {
    Logger.debug("未找到滑桿元素", { module: "context-menu" });
    return;
  }

  // 檢查元素是否有 data-voice-message-id 屬性
  const id = sliderElement.getAttribute("data-voice-message-id");
  Logger.debug("語音訊息 ID", { module: "context-menu", data: id });

  // 從滑桿元素獲取持續時間
  const durationSec = getDurationFromSlider(sliderElement);
  Logger.debug("從滑桿獲取的持續時間(秒)", {
    module: "context-menu",
    data: durationSec,
  });

  if (durationSec !== null) {
    // 將秒轉換為毫秒
    const durationMs = secondsToMilliseconds(durationSec);
    Logger.debug("持續時間(毫秒)", {
      module: "context-menu",
      data: durationMs,
    });

    // 發送訊息到背景腳本，包含元素 ID 和持續時間
    Logger.debug("準備發送右鍵點擊訊息", { module: "context-menu" });
    sendRightClickMessage(id, null, null, durationMs);
  } else {
    Logger.debug("無法從滑桿獲取持續時間", { module: "context-menu" });
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

  Logger.debug("準備發送訊息到背景腳本", {
    module: "context-menu",
    data: message,
  });

  // 使用 window.sendToBackground 發送訊息
  if (window.sendToBackground) {
    try {
      // 添加錯誤處理
      window.sendToBackground(message);
      Logger.debug("訊息已發送到背景腳本", { module: "context-menu" });
    } catch (error) {
      Logger.error("發送訊息到背景腳本時發生錯誤", {
        module: "context-menu",
        data: error,
      });

      // 如果使用 sendToBackground 失敗，嘗試使用 chrome.runtime.sendMessage
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage(message, (response) => {
            Logger.debug("chrome.runtime.sendMessage 回應", {
              module: "context-menu",
              data: response,
            });
          });
          Logger.debug("已使用 chrome.runtime.sendMessage 發送訊息", {
            module: "context-menu",
          });
        } catch (chromeError) {
          Logger.error("使用 chrome.runtime.sendMessage 發生錯誤", {
            module: "context-menu",
            data: chromeError,
          });
        }
      }
    }
  } else {
    // 如果沒有 sendToBackground 函數，嘗試使用 chrome.runtime.sendMessage
    Logger.warn(
      "sendToBackground 函數不存在，嘗試使用 chrome.runtime.sendMessage",
      { module: "context-menu" }
    );

    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          Logger.debug("chrome.runtime.sendMessage 回應", {
            module: "context-menu",
            data: response,
          });
        });
        Logger.debug("已使用 chrome.runtime.sendMessage 發送訊息", {
          module: "context-menu",
        });
      } catch (error) {
        Logger.error("使用 chrome.runtime.sendMessage 發生錯誤", {
          module: "context-menu",
          data: error,
        });
      }
    } else {
      Logger.error("無法發送訊息到背景腳本，所有可用的方法都失敗", {
        module: "context-menu",
      });
    }
  }

  Logger.info("發送右鍵點擊訊息", {
    module: "context-menu",
    data: {
      elementId,
      downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
      lastModified,
    },
  });
}
