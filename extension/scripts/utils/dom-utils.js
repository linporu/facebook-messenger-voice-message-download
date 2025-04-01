/**
 * dom-utils.js
 * 提供 DOM 操作相關的輔助函數
 */

import {
  getCurrentLanguage,
  getPlayButtonLabel,
  getAudioSliderLabel,
  matchesAnyPlayButtonLabel,
  matchesAnyAudioSliderLabel,
} from "./language-utils.js";

/**
 * 語音訊息播放按鈕的 SVG 路徑
 * 用於識別語音訊息元素
 */
export const VOICE_MESSAGE_PLAY_BUTTON_SVG_PATH =
  "M10 25.5v-15a1.5 1.5 0 012.17-1.34l15 7.5a1.5 1.5 0 010 2.68l-15 7.5A1.5 1.5 0 0110 25.5z";

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
  const ariaLabel = element.getAttribute("aria-label");
  if (
    element.getAttribute("role") === "button" &&
    matchesAnyPlayButtonLabel(ariaLabel)
  ) {
    // 檢查是否包含特定 SVG 路徑
    const svgPath = element.querySelector("path");
    if (
      svgPath &&
      svgPath.getAttribute("d") === VOICE_MESSAGE_PLAY_BUTTON_SVG_PATH
    ) {
      return true;
    }

    // 如果沒有直接找到 SVG 路徑，檢查內部的 SVG 元素
    const svg = element.querySelector("svg");
    if (svg) {
      const path = svg.querySelector("path");
      return (
        path && path.getAttribute("d") === VOICE_MESSAGE_PLAY_BUTTON_SVG_PATH
      );
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

  const ariaLabel = element.getAttribute("aria-label");
  return (
    element.getAttribute("role") === "slider" &&
    matchesAnyAudioSliderLabel(ariaLabel)
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
    return null;
  }

  const durationSec = parseFloat(sliderElement.getAttribute("aria-valuemax"));
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
    const slider = parent.querySelector(
      `[role="slider"][aria-label="${VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`
    );
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
  const hasPlayButton = !!element.querySelector(
    `[role="button"][aria-label="${VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL}"]`
  );
  const hasSlider = !!element.querySelector(
    `[role="slider"][aria-label="${VOICE_MESSAGE_SLIDER_ARIA_LABEL}"]`
  );

  return hasPlayButton || hasSlider;
}

/**
 * 計算兩個 DOM 元素之間的距離
 * 使用節點路徑距離（計算共同祖先的距離）
 *
 * @param {Element} element1 - 第一個元素
 * @param {Element} element2 - 第二個元素
 * @returns {number} - 元素之間的距離
 */
function calculateElementDistance(element1, element2) {
  // 如果元素相同，距離為 0
  if (element1 === element2) return 0;

  // 獲取元素 1 的所有父元素
  const parents1 = [];
  let parent = element1;
  while (parent) {
    parents1.push(parent);
    parent = parent.parentElement;
  }

  // 檢查元素 2 是否是元素 1 的祖先
  let parent2 = element2;
  let distance = 0;
  while (parent2) {
    distance++;
    if (parents1.includes(parent2)) {
      // 找到共同祖先
      const ancestorIndex = parents1.indexOf(parent2);
      return distance + ancestorIndex;
    }
    parent2 = parent2.parentElement;
  }

  // 如果沒有共同祖先（不太可能），返回一個大值
  return 1000;
}

/**
 * 從元素獲取所有子元素，最大深度為 maxDepth
 *
 * @param {Element} element - 起始元素
 * @param {number} maxDepth - 最大深度
 * @returns {Element[]} - 子元素列表
 */
function getAllDescendants(element, maxDepth = 5) {
  const descendants = [];

  function traverse(el, depth) {
    if (depth > maxDepth) return;

    const children = el.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      descendants.push(child);
      traverse(child, depth + 1);
    }
  }

  traverse(element, 1);
  return descendants;
}

/**
 * 獲取元素的所有兄弟元素
 *
 * @param {Element} element - 目標元素
 * @returns {Element[]} - 兄弟元素列表
 */
function getSiblings(element) {
  if (!element.parentElement) return [];

  const siblings = [];
  const parent = element.parentElement;
  const children = parent.children;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child !== element) {
      siblings.push(child);
    }
  }

  return siblings;
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

  // 候選元素列表，每個項目包含 {element, type, distance}
  const candidates = [];

  // 策略 1: 檢查點擊的元素自身
  if (isVoiceMessageSlider(clickedElement)) {
    candidates.push({ element: clickedElement, type: "slider", distance: 0 });
  }

  if (isVoiceMessagePlayButton(clickedElement)) {
    candidates.push({
      element: clickedElement,
      type: "playButton",
      distance: 0,
    });
  }

  // 策略 2: 在點擊元素內部查找（深度優先，最大深度 5）
  const descendants = getAllDescendants(clickedElement, 5);
  for (const descendant of descendants) {
    if (isVoiceMessageSlider(descendant)) {
      candidates.push({
        element: descendant,
        type: "slider",
        distance: calculateElementDistance(clickedElement, descendant),
      });
    } else if (isVoiceMessagePlayButton(descendant)) {
      candidates.push({
        element: descendant,
        type: "playButton",
        distance: calculateElementDistance(clickedElement, descendant),
      });
    }

    // 如果已經找到足夠多的候選元素，可以提前結束搜索
    if (candidates.length >= 10) break;
  }

  // 策略 3: 向上遍歷 DOM 樹（最大深度 10）
  let parent = clickedElement.parentElement;
  let upwardDepth = 0;
  const MAX_UPWARD_DEPTH = 10;

  while (parent && upwardDepth < MAX_UPWARD_DEPTH) {
    upwardDepth++;

    // 檢查父元素是否為潛在容器
    if (isPotentialVoiceMessageContainer(parent)) {
      // 在父元素中查找滑桿
      const slider = parent.querySelector(
        `[role="slider"][aria-label="${VOICE_MESSAGE_SLIDER_ARIA_LABEL()}"]`
      );
      if (slider) {
        candidates.push({
          element: slider,
          type: "slider",
          distance: upwardDepth,
        });
      }

      // 在父元素中查找播放按鈕
      const playButton = parent.querySelector(
        `[role="button"][aria-label="${VOICE_MESSAGE_PLAY_BUTTON_ARIA_LABEL()}"]`
      );
      if (playButton && isVoiceMessagePlayButton(playButton)) {
        candidates.push({
          element: playButton,
          type: "playButton",
          distance: upwardDepth,
        });
      }
    }

    // 向上遍歷 DOM 樹
    parent = parent.parentElement;
  }

  // 策略 4: 檢查兄弟元素及其子元素
  const siblings = getSiblings(clickedElement);
  for (const sibling of siblings) {
    // 檢查兄弟元素本身
    if (isVoiceMessageSlider(sibling)) {
      candidates.push({
        element: sibling,
        type: "slider",
        distance: 1, // 兄弟元素距離設為 1
      });
    } else if (isVoiceMessagePlayButton(sibling)) {
      candidates.push({
        element: sibling,
        type: "playButton",
        distance: 1,
      });
    }

    // 檢查兄弟元素的子元素
    const siblingDescendants = getAllDescendants(sibling, 3); // 限制深度為 3
    for (const descendant of siblingDescendants) {
      if (isVoiceMessageSlider(descendant)) {
        candidates.push({
          element: descendant,
          type: "slider",
          distance: 2, // 兄弟的子元素距離設為 2
        });
      } else if (isVoiceMessagePlayButton(descendant)) {
        candidates.push({
          element: descendant,
          type: "playButton",
          distance: 2,
        });
      }
    }

    // 如果已經找到足夠多的候選元素，可以提前結束搜索
    if (candidates.length >= 15) break;
  }

  // 如果沒有找到候選元素，返回 null
  if (candidates.length === 0) {
    return null;
  }

  // 根據距離排序候選元素（距離越小越優先）
  candidates.sort((a, b) => a.distance - b.distance);

  // 優先返回滑桿元素，因為它包含持續時間信息
  const sliderCandidates = candidates.filter((c) => c.type === "slider");
  if (sliderCandidates.length > 0) {
    const { element, type } = sliderCandidates[0];
    return { element, type };
  }

  // 如果沒有滑桿元素，返回最近的播放按鈕元素
  const { element, type } = candidates[0];
  return { element, type };
}

/**
 * 標記元素為語音訊息元素
 *
 * @param {Element} element - 要標記的元素
 * @param {string} id - 語音訊息 ID
 */
export function markAsVoiceMessageElement(element, id) {
  if (!element || !id) return;

  element.setAttribute("data-voice-message-element", "true");
  element.setAttribute("data-voice-message-id", id);
}
