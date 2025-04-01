/**
 * dom-utils.js
 * 提供 DOM 操作相關的輔助函數
 */

import { 
  getCurrentLanguage, 
  getPlayButtonLabel, 
  getAudioSliderLabel,
  matchesAnyPlayButtonLabel,
  matchesAnyAudioSliderLabel
} from './language-utils.js';

/**
 * 語音訊息播放按鈕的 SVG 路徑
 * 用於識別語音訊息元素
 */
export const VOICE_MESSAGE_PLAY_BUTTON_SVG_PATH = 'M10 25.5v-15a1.5 1.5 0 012.17-1.34l15 7.5a1.5 1.5 0 010 2.68l-15 7.5A1.5 1.5 0 0110 25.5z';

/**
 * 獲取當前語言的語音訊息播放按鈕的 aria-label
 */
export function VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL() {
  return getPlayButtonLabel();
}

/**
 * 獲取當前語言的語音訊息滑桿的 aria-label
 */
export function VOICE_MESSAGE_SLIDER_ARIA_LABEL() {
  return getAudioSliderLabel();
}

/**
 * 檢查元素是否為語音訊息播放按鈕
 * 
 * @param {Element|null} element - 要檢查的元素
 * @returns {boolean} - 如果元素是語音訊息播放按鈕則返回 true
 */
export function isVoiceMessagePlayButton(element) {
  if (!element) return false;
  
  // 檢查 aria-label - 使用語言感知函數
  const ariaLabel = element.getAttribute('aria-label');
  if (element.getAttribute('role') === 'button' && 
      matchesAnyPlayButtonLabel(ariaLabel)) {
    
    // 檢查是否包含特定 SVG 路徑
    const svgPath = element.querySelector('path');
    if (svgPath && svgPath.getAttribute('d') === VOICE_MESSAGE_PLAY_BUTTON_SVG_PATH) {
      return true;
    }
    
    // 如果沒有直接找到 SVG 路徑，檢查內部的 SVG 元素
    const svg = element.querySelector('svg');
    if (svg) {
      const path = svg.querySelector('path');
      return path && path.getAttribute('d') === VOICE_MESSAGE_PLAY_BUTTON_SVG_PATH;
    }
  }
  
  return false;
}

/**
 * 檢查元素是否為語音訊息滑桿
 * 
 * @param {Element|null} element - 要檢查的元素
 * @returns {boolean} - 如果元素是語音訊息滑桿則返回 true
 */
export function isVoiceMessageSlider(element) {
  if (!element) return false;
  
  const ariaLabel = element.getAttribute('aria-label');
  return element.getAttribute('role') === 'slider' && 
         matchesAnyAudioSliderLabel(ariaLabel);
}

/**
 * 從滑桿元素獲取音訊持續時間（秒）
 * 
 * @param {Element} sliderElement - 滑桿元素
 * @returns {number|null} - 持續時間（秒），如果無法獲取則返回 null
 */
export function getDurationFromSlider(sliderElement) {
  if (!isVoiceMessageSlider(sliderElement)) {
    return null;
  }
  
  const durationSec = parseFloat(sliderElement.getAttribute('aria-valuemax'));
  return isNaN(durationSec) ? null : durationSec;
}

/**
 * 從播放按鈕元素獲取相關的滑桿元素
 * 
 * @param {Element} playButtonElement - 播放按鈕元素
 * @returns {Element|null} - 滑桿元素，如果找不到則返回 null
 */
export function getSliderFromPlayButton(playButtonElement) {
  if (!isVoiceMessagePlayButton(playButtonElement)) {
    return null;
  }
  
  // 嘗試在父元素中查找滑桿
  let parent = playButtonElement.parentElement;
  while (parent) {
    // 在父元素中查找滑桿
    const slider = parent.querySelector(`[role="slider"][aria-label="${VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`);
    if (slider) {
      return slider;
    }
    
    // 向上遍歷 DOM 樹
    parent = parent.parentElement;
    
    // 限制遍歷深度，避免無限循環
    if (parent === document.body) {
      break;
    }
  }
  
  return null;
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
  const hasPlayButton = !!element.querySelector(`[role="button"][aria-label="${VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL}"]`);
  const hasSlider = !!element.querySelector(`[role="slider"][aria-label="${VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`);
  
  return hasPlayButton || hasSlider;
}

/**
 * 從點擊的元素查找語音訊息元素
 * 使用多種策略尋找相關的語音訊息元素
 * 
 * @param {Element|null} clickedElement - 被點擊的元素
 * @returns {Object|null} - 包含 element（語音訊息元素）和 type（'slider' 或 'playButton'）的物件，如果找不到則返回 null
 */
export function findVoiceMessageElement(clickedElement) {
  if (!clickedElement) return null;
  
  // 策略 1: 檢查點擊的元素自身
  if (isVoiceMessageSlider(clickedElement)) {
    return { element: clickedElement, type: 'slider' };
  }
  
  if (isVoiceMessagePlayButton(clickedElement)) {
    return { element: clickedElement, type: 'playButton' };
  }
  
  // 策略 2: 在點擊元素內部查找
  const sliderInside = clickedElement.querySelector(`[role="slider"][aria-label="${VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`);
  if (sliderInside) {
    return { element: sliderInside, type: 'slider' };
  }
  
  const playButtonInside = clickedElement.querySelector(`[role="button"][aria-label="${VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL}"]`);
  if (playButtonInside && isVoiceMessagePlayButton(playButtonInside)) {
    return { element: playButtonInside, type: 'playButton' };
  }
  
  // 策略 3: 向上遍歷 DOM 樹
  let parent = clickedElement.parentElement;
  while (parent) {
    // 檢查父元素是否為潛在容器
    if (isPotentialVoiceMessageContainer(parent)) {
      // 在父元素中查找滑桿
      const slider = parent.querySelector(`[role="slider"][aria-label="${VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`);
      if (slider) {
        return { element: slider, type: 'slider' };
      }
      
      // 在父元素中查找播放按鈕
      const playButton = parent.querySelector(`[role="button"][aria-label="${VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL}"]`);
      if (playButton && isVoiceMessagePlayButton(playButton)) {
        return { element: playButton, type: 'playButton' };
      }
    }
    
    // 向上遍歷 DOM 樹
    parent = parent.parentElement;
    
    // 限制遍歷深度，避免無限循環
    if (parent === document.body) {
      break;
    }
  }
  
  return null;
}

/**
 * 標記元素為語音訊息元素
 * 
 * @param {Element} element - 要標記的元素
 * @param {string} id - 語音訊息 ID
 */
export function markAsVoiceMessageElement(element, id) {
  if (!element || !id) return;
  
  element.setAttribute('data-voice-message-element', 'true');
  element.setAttribute('data-voice-message-id', id);
}
