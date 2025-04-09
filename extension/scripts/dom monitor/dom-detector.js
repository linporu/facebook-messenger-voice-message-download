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
            detectVoiceMessages(node);
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
 * 搜索和處理語音訊息滑桿
 * 無參數時執行完整掃描，提供節點時只掃描該節點
 * 
 * @param {Node|null} [node=null] - 要搜索的節點，如果未提供則搜索整個文檔
 * @returns {number} - 找到並處理的滑桿數量
 */
export function detectVoiceMessages(node = null) {
  const isFullScan = node === null;
  const rootElement = isFullScan ? document : node;
  
  // 如果是完整掃描，記錄開始日誌
  if (isFullScan) {
    Logger.info("執行完整 DOM 掃描", { module: MODULE_NAMES.DOM_DETECTOR });
  }
  
  // 如果提供了節點且不是完整掃描，先檢查節點本身
  if (!isFullScan && node.nodeType === Node.ELEMENT_NODE && isVoiceMessageSlider(node)) {
    processSliderElement(node);
  }
  
  // 如果根元素不支援 querySelectorAll，直接返回
  if (!rootElement || !rootElement.querySelectorAll) {
    return 0;
  }
  
  // 查詢和處理滑桿
  const sliders = [];
  
  DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL.forEach(label => {
    try {
      const currentLabelSliders = rootElement.querySelectorAll(
        `[role="slider"][aria-label="${label}"]`
      );
      
      if (currentLabelSliders.length > 0) {
        sliders.push(...currentLabelSliders);
      }
    } catch (error) {
      Logger.warn("查詢滑桿時發生錯誤", {
        module: MODULE_NAMES.DOM_DETECTOR,
        error: error.message,
        node: rootElement.tagName || rootElement.nodeName
      });
    }
  });

  // 處理找到的滑桿
  for (const slider of sliders) {
    processSliderElement(slider);
  }
  
  // 記錄適當的日誌
  if (isFullScan) {
    Logger.info("完整掃描找到的滑桿數量", {
      module: MODULE_NAMES.DOM_DETECTOR,
      slidersCount: sliders.length
    });
  } else if (sliders.length > 0) {
    Logger.debug("節點掃描完成", {
      module: MODULE_NAMES.DOM_DETECTOR,
      nodeTag: node.tagName || node.nodeName,
      slidersFound: sliders.length
    });
  }
  
  return sliders.length;
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
