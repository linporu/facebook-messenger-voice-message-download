/**
 * dom-detector.js
 * 負責偵測 DOM 中的語音訊息元素
 */

import {
  getDurationFromSlider,
  markAsVoiceMessageElement,
  isVoiceMessageSlider,
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

  // 立即執行一次完整掃描
  detectVoiceMessages();

  // 設置 MutationObserver 偵測動態載入的內容
  const observer = new MutationObserver((mutations) => {
    // 對每個 mutation 進行處理
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // 只處理新增的節點
        for (const node of mutation.addedNodes) {
          // 檢查節點是否為元素節點
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 處理單個節點及其子樹
            searchAndProcessSlidersInNode(node);
          }
        }
      }
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
 * 在指定節點及其子樹中搜索和處理語音訊息滑桿
 * 
 * @param {Node} node - 要搜索的節點
 */
function searchAndProcessSlidersInNode(node) {
  // 先檢查節點本身是否為滑桿
  if (node.nodeType === Node.ELEMENT_NODE && isVoiceMessageSlider(node)) {
    processSliderElement(node);
  }

  // 在節點子樹中搜索滑桿
  const sliders = [];
  
  // 如果節點有 querySelectorAll 方法
  if (node.querySelectorAll) {
    // 遍歷所有可能的語音訊息滑桿標籤
    DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL.forEach(label => {
      try {
        // 限制在當前節點子樹中查詢
        const currentLabelSliders = node.querySelectorAll(
          `[role="slider"][aria-label="${label}"]`
        );
        
        if (currentLabelSliders.length > 0) {
          sliders.push(...currentLabelSliders);
        }
      } catch (error) {
        Logger.warn("在節點中查詢滑桿時發生錯誤", {
          module: MODULE_NAMES.DOM_DETECTOR,
          error: error.message,
          nodeType: node.nodeType,
        });
      }
    });
  }

  // 處理找到的滑桿
  for (const slider of sliders) {
    processSliderElement(slider);
  }

  Logger.debug("節點掃描完成", {
    module: MODULE_NAMES.DOM_DETECTOR,
    nodeTag: node.tagName,
    slidersFound: sliders.length,
  });
}

/**
 * 偵測頁面上的語音訊息元素 (完整掃描)
 */
export function detectVoiceMessages() {
  Logger.info("執行完整 DOM 掃描", { module: MODULE_NAMES.DOM_DETECTOR });
  
  // 尋找所有滑桿元素
  const sliders = [];
  
  // 遍歷所有可能的語音訊息滑桿標籤
  DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL.forEach(label => {
    // 查詢符合當前標籤的滑桿元素
    const currentLabelSliders = document.querySelectorAll(
      `[role="slider"][aria-label="${label}"]`
    );
    
    // 將找到的元素添加到總集合中
    if (currentLabelSliders.length > 0) {
      sliders.push(...currentLabelSliders);
    }
  });

  Logger.info("完整掃描找到的滑桿數量", { 
    module: MODULE_NAMES.DOM_DETECTOR,
    slidersCount: sliders.length 
  });

  // 處理所有找到的滑桿
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

    // 發送訊息到背景腳本
    window.sendToBackground({
      action: MESSAGE_ACTIONS.REGISTER_ELEMENT,
      elementId: elementId,
      durationMs: durationMs,
    });

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
