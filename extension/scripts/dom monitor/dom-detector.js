/**
 * dom-detector.js
 * 負責偵測 DOM 中的語音訊息元素
 */

import {

  getDurationFromSlider,

  markAsVoiceMessageElement,
} from "./dom-utils.js";
import { generateVoiceMessageId } from "../utils/id-generator.js";
import { secondsToMilliseconds } from "../utils/time-utils.js";
import { Logger } from "../utils/logger.js";
import {
  MESSAGE_ACTIONS,
  MESSAGE_SOURCES,

  MODULE_NAMES,

  DOM_CONSTANTS,
} from "../utils/constants.js";

/**
 * 初始化 DOM 偵測器
 */
export function initDomDetector() {
  Logger.info("初始化 DOM 偵測器", { module: MODULE_NAMES.DOM_DETECTOR });

  // 立即執行一次偵測
  detectVoiceMessages();

  // 設置 MutationObserver 偵測動態載入的內容
  const observer = new MutationObserver((mutations) => {
    let shouldDetect = false;

    // 檢查是否有新節點添加
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        shouldDetect = true;
        break;
      }
    }

    // 如果有新節點添加，執行偵測
    if (shouldDetect) {
      detectVoiceMessages();
    }
  });

  // 開始監聽 document.body 的變化
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

/**
 * 偵測頁面上的語音訊息元素
 */
export function detectVoiceMessages() {
  // 尋找滑桿元素
  const sliders = document.querySelectorAll(
    `[role="slider"][aria-label="${DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`
  );

  for (const slider of sliders) {
    processSliderElement(slider);
  }

}

/**
 * 處理滑桿元素
 *
 * @param {Element} sliderElement - 滑桿元素
 */
function processSliderElement(sliderElement) {
  // 檢查元素是否已經被處理過
  if (sliderElement.hasAttribute(DOM_CONSTANTS.VOICE_MESSAGE_ID_DATA_ATTR)) {
    return;
  }

  // 從滑桿元素獲取持續時間（秒）
  const durationSec = getDurationFromSlider(sliderElement);

  // 如果持續時間是有效數字
  if (durationSec !== null) {
    // 生成元素 ID
    const elementId = generateVoiceMessageId();

    // 標記元素
    markAsVoiceMessageElement(sliderElement, elementId);

    // 將持續時間轉換為毫秒
    const durationMs = secondsToMilliseconds(durationSec);

    // 發送訊息到背景腳本，檢查函數是否存在
    if (typeof window.sendToBackground === "function") {
      window.sendToBackground({
        action: MESSAGE_ACTIONS.REGISTER_ELEMENT,
        elementId: elementId,
        durationMs: durationMs,
      });
    } else {
      // 使用替代方法發送訊息
      window.postMessage(
        {
          type: MESSAGE_SOURCES.CONTENT_SCRIPT,
          message: {
            action: MESSAGE_ACTIONS.REGISTER_ELEMENT,
            elementId: elementId,
            durationMs: durationMs,
          },
        },
        "*"
      );

      Logger.warn("window.sendToBackground 不是函數，使用替代方法", {
        module: MODULE_NAMES.DOM_DETECTOR,
      });
    }

    // 輸出偵測到的語音訊息
    Logger.debug("找到語音訊息", {
      module: MODULE_NAMES.DOM_DETECTOR,
      data: {
        element: sliderElement,
        durationSec,
        durationMs,
        elementId,
      },
    });
  }
}
