/**
 * dom-utils.js
 * 提供 DOM 操作相關的輔助函數
 */

import { Logger } from "../utils/logger.js";
import { DOM_CONSTANTS } from "../utils/constants.js";

/**
 * 檢查元素是否為語音訊息滑桿
 *
 * @param {Element|null} element - 要檢查的元素
 * @returns {boolean} - 如果元素是語音訊息滑桿則返回 true
 */
export function isVoiceMessageSlider(element) {
  return (
    element &&
    element.getAttribute("role") === "slider" &&
    element.getAttribute("aria-label") ===
      DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL
  );
}

/**
 * 從滑桿元素獲取音訊持續時間（秒）
 *
 * @param {Element} sliderElement - 滑桿元素
 * @returns {number|null} - 持續時間（秒），如果無法獲取則返回 null
 */
export function getDurationFromSlider(sliderElement) {
  if (!isVoiceMessageSlider(sliderElement)) {
    Logger.warn("嘗試從非滑杆元素獲取持續時間", {
      element: sliderElement?.tagName,
    });
    return null;
  }

  const durationSec = parseFloat(sliderElement.getAttribute("aria-valuemax"));
  if (isNaN(durationSec)) {
    Logger.warn("從滑杆元素獲取的持續時間無效", {
      element: sliderElement.tagName,
      ariaValueMax: sliderElement.getAttribute("aria-valuemax"),
    });
    return null;
  }

  Logger.debug("從滑杆元素獲取持續時間成功", { durationSec });
  return durationSec;
}

/**
 * 檢查元素是否為潛在的語音訊息容器
 *
 * @param {Element|null} element - 要檢查的元素
 * @returns {boolean} - 如果元素是潛在的語音訊息容器則返回 true
 */
export function isPotentialVoiceMessageContainer(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  // 檢查元素是否包含語音訊息相關元素

  const hasSlider = !!element.querySelector(
    `[role="slider"][aria-label="${DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`
  );

  return hasSlider;
}

/**
 * 從點擊的元素查找語音訊息元素
 * 使用多種策略尋找相關的語音訊息元素
 *
 * @param {Element|null} clickedElement - 被點擊的元素
 * @returns {Object|null} - 包含 element（語音訊息元素）和 type（'slider' 或 'playButton'）的物件，如果找不到則返回 null
 */
export function findVoiceMessageElement(clickedElement) {
  if (!clickedElement) {
    Logger.warn("嘗試在 null 元素上查找語音訊息元素");
    return null;
  }

  Logger.debug("開始尋找語音訊息元素", { elementTag: clickedElement.tagName });

  // 策略 1: 檢查點擊的元素自身
  if (isVoiceMessageSlider(clickedElement)) {
    Logger.debug("直接找到語音訊息滑杆元素");
    return { element: clickedElement, type: "slider" };
  }

  // 策略 2: 在點擊元素內部查找
  Logger.debug("在元素內部尋找語音訊息元素");
  const sliderInside = clickedElement.querySelector(
    `[role="slider"][aria-label="${DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`
  );
  if (sliderInside) {
    Logger.debug("在元素內部找到語音訊息滑杆");
    return { element: sliderInside, type: "slider" };
  }

  // 策略 3: 向上遍歷 DOM 樹
  Logger.debug("開始向上遍歷 DOM 樹尋找語音訊息元素");
  let parent = clickedElement.parentElement;
  let depth = 0;

  while (parent) {
    depth++;
    // 檢查父元素是否為潛在容器
    if (isPotentialVoiceMessageContainer(parent)) {
      Logger.debug("找到潛在的語音訊息容器", {
        depth,
        elementTag: parent.tagName,
      });

      // 在父元素中查找滑杆
      const slider = parent.querySelector(
        `[role="slider"][aria-label="${DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`
      );
      if (slider) {
        Logger.debug("在容器中找到語音訊息滑杆");
        return { element: slider, type: "slider" };
      }
    }

    // 向上遍歷 DOM 樹
    parent = parent.parentElement;

    // 限制遍歷深度，避免無限循環
    if (parent === document.body) {
      Logger.debug("已達到 document.body，終止尋找");
      break;
    }
  }

  Logger.warn("無法找到語音訊息元素");
  return null;
}

/**
 * 標記元素為語音訊息元素
 *
 * @param {Element} element - 要標記的元素
 * @param {string} id - 語音訊息 ID
 */
export function markAsVoiceMessageElement(element, id) {
  if (!element || !id) {
    Logger.warn("嘗試使用無效的元素或 ID 標記語音訊息元素", {
      hasElement: !!element,
      hasId: !!id,
    });
    return;
  }

  element.setAttribute(DOM_CONSTANTS.VOICE_MESSAGE_ELEMENT_DATA_ATTR, "true");
  element.setAttribute(DOM_CONSTANTS.VOICE_MESSAGE_ID_DATA_ATTR, id);

  Logger.debug("標記語音訊息元素成功", {
    elementTag: element.tagName,
    id,
  });
}
