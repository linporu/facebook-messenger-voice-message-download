/**
 * language-utils.js
 * 提供語言偵測和標籤映射相關的輔助函數
 */

// 當前偵測到的語言代碼
let currentLanguage = null;

// 默認語言代碼（用於回退）
const DEFAULT_LANGUAGE = 'en';

/**
 * 語言代碼到 aria-label 的映射表
 * 包含各種語言的播放按鈕和音訊滑桿標籤
 */
const LANGUAGE_LABELS = {
  "zh-Hant": {
    // 繁體中文（台灣、香港）
    playButton: "播放",
    audioSlider: "音訊滑桿",
  },
  "zh-Hans": {
    // 簡體中文（中國）
    playButton: "播放",
    audioSlider: "音频时间刷",
  },
  es: {
    // 西班牙語
    playButton: "Reproducir",
    audioSlider: "Barra de arrastre de audio",
  },
  en: {
    playButton: "Play",
    audioSlider: "Audio scrubber",
  },
  bn: {
    // 孟加拉語
    playButton: "চালান",
    audioSlider: "অডিও স্ক্রাবার",
  },
  hi: {
    // 北印度語
    playButton: "चलाएँ",
    audioSlider: "ऑडियो स्क्रबर",
  },
  ar: {
    // 阿拉伯語
    playButton: "تشغيل",
    audioSlider: "شريط تمرير المقطع الصوتي",
  },
  pt: {
    // 葡萄牙語（包含巴西和葡萄牙）
    playButton: "Reproduzir",
    audioSlider: ["Barra seletora de áudio", "Barra de duração do áudio"],
  },
  ru: {
    playButton: "Воспроизвести",
    audioSlider: "Ползунок аудио",
  },
  ja: {
    // 日語
    playButton: "再生",
    audioSlider: "音声スライダー",
  },
  de: {
    // 德語
    playButton: "Abspielen",
    audioSlider: "Schieberegler für Audio",
  },
  fr: {
    // 法語
    playButton: "Lire",
    audioSlider: "Curseur audio",
  },
  jv: {
    // 爪哇語
    playButton: "Lakoke",
    audioSlider: "Scrubber Audio",
  },
  ko: {
    // 韓語
    playButton: "재생",
    audioSlider: "오디오 스크러버",
  },
};

// 儲存偵測到的語言代碼
let detectedLanguageCode = null;
// 儲存所有已知的標籤，用於備選方案
let allPlayButtonLabels = null;
let allAudioSliderLabels = null;

/**
 * 從 HTML 標籤的 lang 屬性中獲取當前介面語言
 * 注意：此函數依賴 DOM，只能在內容腳本或網頁環境中使用
 *
 * @returns {string|null} - 偵測到的語言代碼，如果無法偵測則返回 null
 */
function detectLanguage() {
  // 如果已經有偵測結果，直接返回
  if (detectedLanguageCode) {
    return detectedLanguageCode;
  }

  // 檢查當前環境是否有 document 物件
  if (typeof document === "undefined" || !document.documentElement) {
    console.warn(
      "偵測語言失敗：當前環境沒有 document 物件，可能在背景腳本中執行"
    );
    detectedLanguageCode = "en"; // 默認使用英文
    return detectedLanguageCode;
  }

  try {
    // 從 HTML 標籤獲取語言
    const htmlLang = document.documentElement.lang;

    if (htmlLang) {
      // 處理常見的語言代碼格式，例如 "en_US" -> "en"
      const langParts = htmlLang.split(/[-_]/);
      const baseLang = langParts[0].toLowerCase();

      // 處理特殊情況：中文繁體和簡體
      if (baseLang === "zh") {
        const region = langParts[1] ? langParts[1].toUpperCase() : "";
        if (region === "TW" || region === "HK") {
          detectedLanguageCode = "zh-Hant";
        } else if (region === "CN" || region === "SG") {
          detectedLanguageCode = "zh-Hans";
        } else {
          // 默認使用繁體中文
          detectedLanguageCode = "zh-Hant";
        }
      } else {
        // 檢查是否支援此語言
        const supportedLang = Object.keys(LANGUAGE_LABELS).find(
          (lang) => lang === baseLang || lang.startsWith(baseLang + "-")
        );

        detectedLanguageCode = supportedLang || "en"; // 默認使用英文
      }

      console.log(`偵測到介面語言: ${detectedLanguageCode}`);
      return detectedLanguageCode;
    }
  } catch (error) {
    console.error("偵測語言時發生錯誤:", error);
  }

  // 默認使用英文
  detectedLanguageCode = "en";
  return detectedLanguageCode;
}

/**
 * 獲取所有已知的播放按鈕標籤
 *
 * @returns {string[]} - 所有已知的播放按鈕標籤
 */
function getAllPlayButtonLabels() {
  if (!allPlayButtonLabels) {
    allPlayButtonLabels = Object.values(LANGUAGE_LABELS).map(
      (labels) => labels.playButton
    );
  }
  return allPlayButtonLabels;
}

/**
 * 獲取所有已知的音訊滑桿標籤
 *
 * @returns {string[]} - 所有已知的音訊滑桿標籤
 */
function getAllAudioSliderLabels() {
  if (!allAudioSliderLabels) {
    allAudioSliderLabels = [];

    // 處理可能是字串或數組的情況
    Object.values(LANGUAGE_LABELS).forEach((labels) => {
      if (Array.isArray(labels.audioSlider)) {
        // 如果是數組，展開添加所有標籤
        allAudioSliderLabels.push(...labels.audioSlider);
      } else {
        // 如果是字串，直接添加
        allAudioSliderLabels.push(labels.audioSlider);
      }
    });
  }
  return allAudioSliderLabels;
}

/**
 * 獲取當前語言的播放按鈕標籤
 *
 * @returns {string} - 播放按鈕標籤
 */
function getPlayButtonLabel() {
  const langCode = detectLanguage();
  return (
    LANGUAGE_LABELS[langCode]?.playButton || LANGUAGE_LABELS["en"].playButton
  );
}

/**
 * 獲取當前語言的音訊滑桿標籤
 *
 * @returns {string} - 音訊滑桿標籤
 */
function getAudioSliderLabel() {
  const langCode = detectLanguage();
  const sliderLabel =
    LANGUAGE_LABELS[langCode]?.audioSlider || LANGUAGE_LABELS["en"].audioSlider;

  // 如果是數組，返回第一個標籤
  if (Array.isArray(sliderLabel)) {
    return sliderLabel[0];
  }

  return sliderLabel;
}

/**
 * 檢查元素的 aria-label 是否匹配任何已知的播放按鈕標籤
 *
 * @param {string} ariaLabel - 元素的 aria-label 值
 * @returns {boolean} - 如果匹配則返回 true
 */
function matchesAnyPlayButtonLabel(ariaLabel) {
  if (!ariaLabel) return false;
  return getAllPlayButtonLabels().includes(ariaLabel);
}

/**
 * 檢查元素的 aria-label 是否匹配任何已知的音訊滑桿標籤
 *
 * @param {string} ariaLabel - 元素的 aria-label 值
 * @returns {boolean} - 如果匹配則返回 true
 */
function matchesAnyAudioSliderLabel(ariaLabel) {
  if (!ariaLabel) return false;
  return getAllAudioSliderLabels().includes(ariaLabel);
}

/**
 * 設置當前語言
 * 
 * @param {string} langCode - 語言代碼
 * @returns {boolean} - 是否成功設置語言
 */
export function setCurrentLanguage(langCode) {
  if (!langCode) return false;
  
  // 標準化語言代碼（僅保留主要部分，例如 zh-TW -> zh-Hant）
  const normalizedLangCode = normalizeLanguageCode(langCode);
  
  // 檢查語言是否已改變
  const hasChanged = currentLanguage !== normalizedLangCode;
  
  // 更新當前語言
  currentLanguage = normalizedLangCode;
  
  console.log(`[DEBUG-LANGUAGE] 設置當前語言: ${currentLanguage}`);
  
  return hasChanged;
}

/**
 * 獲取當前語言
 * 
 * @returns {string} - 當前語言代碼
 */
export function getCurrentLanguage() {
  return currentLanguage || DEFAULT_LANGUAGE;
}

/**
 * 標準化語言代碼
 * 將特定的語言代碼映射到我們支援的格式
 * 
 * @param {string} langCode - 原始語言代碼
 * @returns {string} - 標準化後的語言代碼
 */
export function normalizeLanguageCode(langCode) {
  if (!langCode) return DEFAULT_LANGUAGE;
  
  // 轉換為小寫以進行比較
  const lowerLangCode = langCode.toLowerCase();
  
  // 處理繁體中文變體
  if (lowerLangCode === 'zh-tw' || lowerLangCode === 'zh-hk' || lowerLangCode === 'zh-mo') {
    return 'zh-Hant';
  }
  
  // 處理簡體中文變體
  if (lowerLangCode === 'zh-cn' || lowerLangCode === 'zh-sg' || lowerLangCode === 'zh-my') {
    return 'zh-Hans';
  }
  
  // 處理西班牙語變體
  if (lowerLangCode.startsWith('es-')) {
    return 'es';
  }
  
  // 處理法語變體
  if (lowerLangCode.startsWith('fr-')) {
    return 'fr';
  }
  
  // 處理其他語言 - 僅保留主要部分
  if (lowerLangCode.includes('-')) {
    const mainPart = lowerLangCode.split('-')[0];
    // 檢查是否有對應的主要語言代碼
    if (LANGUAGE_LABELS[mainPart]) {
      return mainPart;
    }
  }
  
  // 如果在 LANGUAGE_LABELS 中找到完整匹配，則使用原始代碼
  if (LANGUAGE_LABELS[lowerLangCode]) {
    return lowerLangCode;
  }
  
  // 默認返回英語
  return DEFAULT_LANGUAGE;
}

/**
 * 檢查語言是否受支援
 * 
 * @param {string} langCode - 語言代碼
 * @returns {boolean} - 是否支援該語言
 */
export function isLanguageSupported(langCode) {
  if (!langCode) return false;
  
  const normalizedLangCode = normalizeLanguageCode(langCode);
  return !!LANGUAGE_LABELS[normalizedLangCode];
}

// 導出所有需要的函數
export {
  setCurrentLanguage,
  getCurrentLanguage,
  normalizeLanguageCode,
  isLanguageSupported,
  getPlayButtonLabel,
  getAudioSliderLabel,
  matchesAnyPlayButtonLabel,
  matchesAnyAudioSliderLabel
};

// 記錄語言工具模組已載入
console.log("[DEBUG-LANGUAGE] 語言工具模組已成功載入");
