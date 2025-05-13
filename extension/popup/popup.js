/**
 * popup.js
 * 處理擴充功能彈出視窗的邏輯
 */

import { checkOnboardingStatus } from "../scripts/background/onboarding-utils.js";
import { Logger } from "../scripts/utils/logger.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("popup");

document.addEventListener("DOMContentLoaded", async function () {
  logger.info("Popup 載入完成");

  // 顯示基本狀態
  const statusElement = document.querySelector(".status p");
  const now = new Date();
  statusElement.textContent = `✅ 擴充功能運作中！ (${now.toLocaleTimeString()})`;

  // 檢查 onboarding 狀態
  try {
    const { completed, installTime, completedAt } =
      await checkOnboardingStatus();
    logger.debug("Onboarding 狀態", { completed, installTime, completedAt });

    if (!completed) {
      // 如果未完成 onboarding，顯示提醒
      showOnboardingReminder();
    } else {
      // 如果已完成，可以顯示一些統計資訊
      showCompletedStatus(completedAt);
    }

    // 添加快速連結
    addQuickLinks();
  } catch (error) {
    logger.error("檢查 onboarding 狀態時發生錯誤", { error });
  }
});

/**
 * 顯示 onboarding 提醒
 */
function showOnboardingReminder() {
  const reminderDiv = document.createElement("div");
  reminderDiv.className = "onboarding-reminder";
  reminderDiv.innerHTML = `
    <div class="reminder-content">
      <span class="reminder-icon">⚠️</span>
      <div class="reminder-text">
        <p>請先完成初始設定</p>
        <button id="open-onboarding" class="small-button">開始設定</button>
      </div>
    </div>
  `;

  const statusDiv = document.querySelector(".status");
  statusDiv.appendChild(reminderDiv);

  // 添加按鈕事件
  document.getElementById("open-onboarding").addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/welcome.html"),
    });
    window.close();
  });
}

/**
 * 顯示已完成狀態
 */
function showCompletedStatus(completedAt) {
  if (!completedAt) return;

  const completedDate = new Date(completedAt);
  const formattedDate = completedDate.toLocaleDateString("zh-TW");

  const completedDiv = document.createElement("div");
  completedDiv.className = "completed-status";
  completedDiv.innerHTML = `
    <p class="completed-text">✨ 設定完成於 ${formattedDate}</p>
  `;

  const footer = document.querySelector(".footer");
  footer.appendChild(completedDiv);
}

/**
 * 添加快速連結
 */
function addQuickLinks() {
  const linksDiv = document.createElement("div");
  linksDiv.className = "quick-links";
  linksDiv.innerHTML = `
    <h3>快速連結</h3>
    <div class="links-grid">
      <button id="open-messenger" class="link-button">
        <span class="icon">💬</span>
        <span>開啟 Messenger</span>
      </button>
      <button id="open-facebook" class="link-button">
        <span class="icon">📘</span>
        <span>開啟 Facebook</span>
      </button>
      <button id="view-tutorial" class="link-button">
        <span class="icon">📖</span>
        <span>檢視教學</span>
      </button>
      <button id="report-issue" class="link-button">
        <span class="icon">🐛</span>
        <span>回報問題</span>
      </button>
    </div>
  `;

  const footer = document.querySelector(".footer");
  footer.insertBefore(linksDiv, footer.firstChild);

  // 添加按鈕事件
  document.getElementById("open-messenger").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.messenger.com" });
    window.close();
  });

  document.getElementById("open-facebook").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.facebook.com" });
    window.close();
  });

  document.getElementById("view-tutorial").addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/welcome.html"),
    });
    window.close();
  });

  document.getElementById("report-issue").addEventListener("click", () => {
    // 這裡可以連結到 GitHub issues 或其他回報頁面
    chrome.tabs.create({
      url: "mailto:linpoju.richard@gmail.com?subject=VoiLoad%20問題回報",
    });
  });
}
