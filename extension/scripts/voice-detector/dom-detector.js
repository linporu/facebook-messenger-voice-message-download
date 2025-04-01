/**
 * dom-detector.js
 * 負責偵測 DOM 中的語音訊息元素
 */

import {
  isVoiceMessageSlider,
  isVoiceMessagePlayButton,
  getDurationFromSlider,
  getSliderFromPlayButton,
  VOICE_MESSAGE_SLIDER_ARIA_LABEL,
  VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL,
} from "../utils/dom-utils.js";
import { markAsVoiceMessageElement } from "../utils/dom-utils.js";
import { generateVoiceMessageId } from "../utils/id-generator.js";
import { secondsToMilliseconds } from "../utils/time-utils.js";

/**
 * 初始化 DOM 偵測器
 */
export function initDomDetector() {
  console.log("初始化 DOM 偵測器");

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
  // 使用語言感知方式偵測語音訊息元素
  console.log("[DEBUG-DOM-DETECTOR] 開始偵測語音訊息元素");
  
  // 方法 1: 直接使用所有滑桿元素，然後使用 isVoiceMessageSlider 函數過濾
  const allSliders = document.querySelectorAll('[role="slider"]');
  
  for (const slider of allSliders) {
    if (isVoiceMessageSlider(slider)) {
      processSliderElement(slider);
    }
  }

  // 方法 2: 直接使用所有按鈕元素，然後使用 isVoiceMessagePlayButton 函數過濾
  const allButtons = document.querySelectorAll('[role="button"]');

  for (const button of allButtons) {
    if (isVoiceMessagePlayButton(button)) {
      const slider = getSliderFromPlayButton(button);
      if (slider) {
        processSliderElement(slider);
      }
    }
  }
}

/**
 * 處理滑桿元素
 *
 * @param {Element} sliderElement - 滑桿元素
 */
function processSliderElement(sliderElement) {
  // 檢查元素是否已經被處理過
  if (sliderElement.hasAttribute("data-voice-message-id")) {
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

    // 發送訊息到背景腳本
    window.sendToBackground({
      action: "registerVoiceMessageElement",
      elementId: elementId,
      durationMs: durationMs,
    });

    // 輸出偵測到的語音訊息
    console.log("找到語音訊息", {
      element: sliderElement,
      durationSec,
      durationMs,
      elementId,
    });
  }
}
