/**
 * welcome.js
 * 處理 onboarding 頁面的邏輯
 */

import { Logger } from "../scripts/utils/logger.js";
import { MODULE_NAMES } from "../scripts/utils/constants.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("onboarding");

// 頁面載入時執行
document.addEventListener("DOMContentLoaded", async () => {
  logger.info("Onboarding 頁面載入");

  // 檢查是否已經完成過 onboarding
  const result = await chrome.storage.local.get(["onboardingCompleted"]);

  if (result.onboardingCompleted) {
    logger.info("用戶已完成過 onboarding");
    // 可以顯示不同的內容或添加"已完成"標記
    showCompletedMessage();
  }

  // 設置完成按鈕事件
  setupCompleteButton();

  // 添加動畫效果
  addAnimations();
});

/**
 * 設置完成按鈕的事件處理
 */
function setupCompleteButton() {
  const completeButton = document.getElementById("complete-onboarding");

  if (completeButton) {
    completeButton.addEventListener("click", async () => {
      logger.info("用戶點擊完成按鈕");

      // 添加載入狀態
      completeButton.disabled = true;
      completeButton.textContent = "載入中...";

      try {
        // 標記 onboarding 已完成
        await chrome.storage.local.set({
          onboardingCompleted: true,
          completedAt: Date.now(),
        });

        logger.info("Onboarding 狀態已更新");

        // 檢查是否有已開啟的 Messenger 標籤
        const tabs = await chrome.tabs.query({
          url: ["*://*.messenger.com/*", "*://*.facebook.com/*"],
        });

        if (tabs.length > 0) {
          // 如果有已開啟的標籤，切換到第一個並重新整理
          logger.info("找到已開啟的 Facebook/Messenger 標籤");
          await chrome.tabs.update(tabs[0].id, { active: true });
          await chrome.tabs.reload(tabs[0].id);

          // 顯示成功訊息
          showSuccessMessage();

          // 3秒後關閉 onboarding 頁面
          setTimeout(() => {
            window.close();
          }, 3000);
        } else {
          // 如果沒有，開啟新的 Messenger 標籤
          logger.info("開啟新的 Messenger 標籤");
          await chrome.tabs.create({
            url: "https://www.messenger.com",
            active: true,
          });

          // 關閉 onboarding 頁面
          window.close();
        }
      } catch (error) {
        logger.error("完成 onboarding 時發生錯誤", { error });
        completeButton.disabled = false;
        completeButton.textContent = "開始使用 →";
        showErrorMessage();
      }
    });
  }
}

/**
 * 顯示已完成訊息
 */
function showCompletedMessage() {
  const container = document.querySelector(".container");
  const notice = document.createElement("div");
  notice.className = "completed-notice";
  notice.innerHTML = `
        <div class="notice-content">
            <span class="notice-icon">✅</span>
            <span>您已經完成過設定，可以直接使用擴充功能！</span>
        </div>
    `;
  container.insertBefore(notice, container.firstChild);
}

/**
 * 顯示成功訊息
 */
function showSuccessMessage() {
  const button = document.getElementById("complete-onboarding");
  const footer = document.querySelector("footer");

  const successMsg = document.createElement("div");
  successMsg.className = "success-message";
  successMsg.innerHTML = `
        <span class="success-icon">✅</span>
        <p>設定完成！正在為您重新整理頁面...</p>
    `;

  footer.insertBefore(successMsg, button);
  button.style.display = "none";
}

/**
 * 顯示錯誤訊息
 */
function showErrorMessage() {
  const footer = document.querySelector("footer");

  const errorMsg = document.createElement("div");
  errorMsg.className = "error-message";
  errorMsg.innerHTML = `
        <span class="error-icon">❌</span>
        <p>發生錯誤，請重試</p>
    `;

  footer.appendChild(errorMsg);

  // 3秒後移除錯誤訊息
  setTimeout(() => {
    errorMsg.remove();
  }, 3000);
}

/**
 * 添加動畫效果
 */
function addAnimations() {
  // 當元素進入視窗時觸發動畫
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  }, observerOptions);

  // 觀察所有動畫元素
  const animatedElements = document.querySelectorAll(".step, .feature");
  animatedElements.forEach((el) => {
    observer.observe(el);
  });
}

// 監聽鍵盤事件
document.addEventListener("keydown", (event) => {
  // 按下 Enter 鍵時觸發完成按鈕
  if (event.key === "Enter") {
    const completeButton = document.getElementById("complete-onboarding");
    if (completeButton && !completeButton.disabled) {
      completeButton.click();
    }
  }
});
