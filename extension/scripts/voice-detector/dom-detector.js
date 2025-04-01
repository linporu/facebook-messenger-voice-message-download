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
import {
  getCurrentLanguage,
  getPlayButtonLabel,
  getAudioSliderLabel,
} from "../utils/language-utils.js";

/**
 * 初始化 DOM 偵測器
 */
export function initDomDetector() {
  console.log("[DEBUG-DOM-DETECTOR] 初始化 DOM 偵測器");

  // 使用防抖函數來減少频繁調用 detectVoiceMessages
  let debounceTimer = null;
  const debouncedDetect = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log("[DEBUG-DOM-DETECTOR] 執行防抖後的偵測");
      detectVoiceMessages();
    }, 300); // 300ms 防抖時間
  };

  // 立即執行一次偵測
  detectVoiceMessages();

  // 設置 MutationObserver 偵測動態載入的內容
  const observer = new MutationObserver((mutations) => {
    let hasRelevantChanges = false;

    // 只關注可能包含語音訊息的特定變更
    for (const mutation of mutations) {
      // 只處理節點添加和屬性變更
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // 檢查添加的節點是否可能包含語音訊息元素
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 檢查是否為可能包含語音訊息的元素（例如訊息容器）
            if (
              node.querySelector('[role="slider"]') ||
              node.querySelector('[role="button"]') ||
              node.closest('[role="article"]') ||
              node.closest('[data-testid="message-container"]')
            ) {
              hasRelevantChanges = true;
              console.log(
                "[DEBUG-DOM-DETECTOR] 偵測到可能包含語音訊息的 DOM 變更"
              );
              break;
            }
          }
        }
      } else if (
        mutation.type === "attributes" &&
        mutation.attributeName === "aria-label"
      ) {
        // 監控 aria-label 屬性的變更
        const target = mutation.target;
        if (
          target.getAttribute("role") === "slider" ||
          target.getAttribute("role") === "button"
        ) {
          hasRelevantChanges = true;
          console.log(
            `[DEBUG-DOM-DETECTOR] 偵測到 aria-label 屬性變更: "${target.getAttribute(
              "aria-label"
            )}"`
          );
          break;
        }
      }
    }

    // 如果有相關變更，使用防抖函數執行偵測
    if (hasRelevantChanges) {
      debouncedDetect();
    }
  });

  // 開始監聽 document.body 的變化，使用更精細的配置
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "role"], // 只關注這些屬性的變更
  });

  console.log("[DEBUG-DOM-DETECTOR] MutationObserver 已設置，使用優化的配置");
  return observer;
}

/**
 * 偵測頁面上的語音訊息元素
 */
export function detectVoiceMessages() {
  // 使用語言感知方式偵測語音訊息元素
  console.log("[DEBUG-DOM-DETECTOR] 開始偵測語音訊息元素");

  // 記錄當前語言環境
  const currentLang = getCurrentLanguage();
  const playLabel = getPlayButtonLabel();
  const sliderLabel = getAudioSliderLabel();

  console.log(`[DEBUG-DOM-DETECTOR] 當前語言: ${currentLang}`);
  console.log(`[DEBUG-DOM-DETECTOR] 當前播放按鈕標籤: "${playLabel}"`);
  console.log(`[DEBUG-DOM-DETECTOR] 當前音訊滑桿標籤: "${sliderLabel}"`);

  // 方法 1: 直接使用所有滑桿元素，然後使用 isVoiceMessageSlider 函數過濾
  const allSliders = document.querySelectorAll('[role="slider"]');
  console.log(`[DEBUG-DOM-DETECTOR] 找到 ${allSliders.length} 個滑桿元素`);

  let matchedSliders = 0;
  for (const slider of allSliders) {
    const sliderAriaLabel = slider.getAttribute("aria-label");
    console.log(
      `[DEBUG-DOM-DETECTOR] 檢查滑桿 aria-label: "${sliderAriaLabel}"`
    );

    if (isVoiceMessageSlider(slider)) {
      matchedSliders++;
      console.log(
        `[DEBUG-DOM-DETECTOR] 匹配到語音訊息滑桿 #${matchedSliders}: "${sliderAriaLabel}"`
      );
      processSliderElement(slider);
    }
  }
  console.log(`[DEBUG-DOM-DETECTOR] 共匹配到 ${matchedSliders} 個語音訊息滑桿`);

  // 方法 2: 直接使用所有按鈕元素，然後使用 isVoiceMessagePlayButton 函數過濾
  const allButtons = document.querySelectorAll('[role="button"]');
  console.log(`[DEBUG-DOM-DETECTOR] 找到 ${allButtons.length} 個按鈕元素`);

  let matchedButtons = 0;
  for (const button of allButtons) {
    const buttonAriaLabel = button.getAttribute("aria-label");

    if (isVoiceMessagePlayButton(button)) {
      matchedButtons++;
      console.log(
        `[DEBUG-DOM-DETECTOR] 匹配到語音訊息播放按鈕 #${matchedButtons}: "${buttonAriaLabel}"`
      );

      const slider = getSliderFromPlayButton(button);
      if (slider) {
        console.log(`[DEBUG-DOM-DETECTOR] 從播放按鈕找到相關滑桿元素`);
        processSliderElement(slider);
      } else {
        console.log(`[DEBUG-DOM-DETECTOR] 無法從播放按鈕找到相關滑桿元素`);
      }
    }
  }
  console.log(
    `[DEBUG-DOM-DETECTOR] 共匹配到 ${matchedButtons} 個語音訊息播放按鈕`
  );
}

/**
 * 處理滑桿元素
 *
 * @param {Element} sliderElement - 滑桿元素
 */
function processSliderElement(sliderElement) {
  // 檢查元素是否已經被處理過
  if (sliderElement.hasAttribute("data-voice-message-id")) {
    console.log(`[DEBUG-DOM-DETECTOR] 滑桿元素已被標記，跳過處理`);
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
    console.log(
      `[DEBUG-DOM-DETECTOR] 成功處理語音訊息元素, ID: ${elementId}, 持續時間: ${durationSec}秒 (${durationMs}毫秒)`
    );
  } else {
    console.log(`[DEBUG-DOM-DETECTOR] 無法從滑桿元素獲取持續時間，跳過處理`);
  }
}
