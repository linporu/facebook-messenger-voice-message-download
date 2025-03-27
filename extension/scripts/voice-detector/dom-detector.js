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
  VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL
} from '../utils/dom-utils.js';
import { registerVoiceMessageElement } from './data-store.js';

/**
 * 初始化 DOM 偵測器
 * 
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function initDomDetector(voiceMessages) {
  console.log('初始化 DOM 偵測器');
  
  // 立即執行一次偵測
  detectVoiceMessages(voiceMessages);
  
  // 設置 MutationObserver 偵測動態載入的內容
  const observer = new MutationObserver((mutations) => {
    let shouldDetect = false;
    
    // 檢查是否有新節點添加
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldDetect = true;
        break;
      }
    }
    
    // 如果有新節點添加，執行偵測
    if (shouldDetect) {
      detectVoiceMessages(voiceMessages);
    }
  });
  
  // 開始監聽 document.body 的變化
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

/**
 * 偵測頁面上的語音訊息元素
 * 
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
export function detectVoiceMessages(voiceMessages) {
  // 方法 1: 尋找滑桿元素
  const sliders = document.querySelectorAll(`[role="slider"][aria-label="${VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`);
  
  for (const slider of sliders) {
    processSliderElement(voiceMessages, slider);
  }
  
  // 方法 2: 尋找播放按鈕
  const playButtons = document.querySelectorAll(`[role="button"][aria-label="${VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL}"]`);
  
  for (const button of playButtons) {
    if (isVoiceMessagePlayButton(button)) {
      const slider = getSliderFromPlayButton(button);
      if (slider) {
        processSliderElement(voiceMessages, slider);
      }
    }
  }
}

/**
 * 處理滑桿元素
 * 
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Element} sliderElement - 滑桿元素
 */
function processSliderElement(voiceMessages, sliderElement) {
  // 檢查元素是否已經被處理過
  if (sliderElement.hasAttribute('data-voice-message-element')) {
    return;
  }
  
  // 從滑桿元素獲取持續時間（秒）
  const durationSec = getDurationFromSlider(sliderElement);
  
  // 如果持續時間是有效數字
  if (durationSec !== null) {
    // 註冊語音訊息元素
    registerVoiceMessageElement(voiceMessages, sliderElement, durationSec);
    
    // 輸出偵測到的語音訊息
    console.log('找到語音訊息', {
      element: sliderElement,
      durationSec
    });
  }
}
