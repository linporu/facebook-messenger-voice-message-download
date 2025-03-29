/**
 * content.js
 * 主要內容腳本，負責初始化和協調其他模組
 */

// 檢查是否在支援的網站上
const isSupportedSite =
  window.location.hostname.includes("facebook.com") ||
  window.location.hostname.includes("messenger.com");

if (!isSupportedSite) {
  console.log("不支援的網站，擴充功能不會啟動");
} else {
  // 創建主模組腳本標籤
  const script = document.createElement("script");
  script.type = "module";
  script.src = chrome.runtime.getURL("scripts/main-module.js");
  script.onload = function () {
    console.log("Facebook Messenger 語音訊息下載器已載入主模組");
    this.remove(); // 載入後移除腳本標籤
  };

  // 添加到頁面
  (document.head || document.documentElement).appendChild(script);

  // 設置訊息監聽器，處理腳本與背景腳本的通訊
  window.addEventListener("message", function (event) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) return;

    // 處理來自主模組的訊息
    if (
      event.data.type &&
      event.data.type === "FROM_VOICE_MESSAGE_DOWNLOADER"
    ) {
      console.log(
        "[DEBUG-CONTENT] 收到主模組訊息，轉發到背景腳本:",
        event.data.message
      );
      chrome.runtime.sendMessage(event.data.message, function (response) {
        console.log("[DEBUG-CONTENT] 背景腳本回應:", response);
      });
    }
  });

  // 將來自背景腳本的訊息轉發到主模組
  chrome.runtime.onMessage.addListener(function (
    message,
    sender,
    sendResponse
  ) {
    console.log("[DEBUG-CONTENT] 收到背景腳本訊息:", message);

    // 特別處理 extractBlobContent 訊息
    if (message.action === "extractBlobContent") {
      console.log("[DEBUG-CONTENT] 收到提取 blob 內容要求:", {
        blobUrl: message.blobUrl,
        blobType: message.blobType,
        requestId: message.requestId,
      });

      // 提取 blob 內容
      extractBlobContent(message.blobUrl, message.blobType, message.requestId)
        .then((result) => {
          console.log("[DEBUG-CONTENT] 提取 blob 內容成功，發送回背景腳本");
          sendResponse(result);
        })
        .catch((error) => {
          console.error("[DEBUG-CONTENT] 提取 blob 內容失敗:", error);
          sendResponse({ success: false, error: error.message });
        });

      return true; // 保持連接開啟，以便異步回應
    }

    // 其他訊息轉發到主模組
    window.postMessage(
      {
        type: "FROM_VOICE_MESSAGE_DOWNLOADER_BACKGROUND",
        message: message,
      },
      "*"
    );
    return true;
  });

  /**
   * 提取 blob 內容
   *
   * @param {string} blobUrl - blob URL
   * @param {string} blobType - blob 類型
   * @param {string} requestId - 要求 ID
   * @returns {Promise<Object>} - 提取結果
   */
  async function extractBlobContent(blobUrl, blobType, requestId) {
    try {
      console.log(`[DEBUG-CONTENT] 開始提取 blob 內容: ${blobUrl}`);

      // 使用 fetch 獲取 blob 內容
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error(
          `無法獲取 blob 內容: ${response.status} ${response.statusText}`
        );
      }

      // 獲取 blob 內容
      const blob = await response.blob();
      console.log(
        `[DEBUG-CONTENT] 成功獲取 blob，類型: ${blob.type || blobType}, 大小: ${
          blob.size
        } 位元組`
      );

      // 將 blob 轉換為 base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            // 確保我們取得正確的 base64 數據
            const base64String = reader.result;
            const base64data = base64String.split(",")[1];

            if (!base64data) {
              throw new Error("無法取得有效的 base64 數據");
            }

            console.log(
              `[DEBUG-CONTENT] 成功將 blob 轉換為 base64，長度: ${base64data.length}`
            );

            // 發送到背景腳本，確保包含所有必要的數據
            chrome.runtime.sendMessage(
              {
                action: "downloadBlobContent",
                blobType: blob.type || blobType, // 使用 blob 的類型，如果沒有則使用傳入的類型
                base64data: base64data,
                requestId: requestId,
                timestamp: new Date().toISOString(),
              },
              (response) => {
                console.log("[DEBUG-CONTENT] 背景腳本回應下載要求:", response);
              }
            );

            resolve({
              success: true,
              message: "已發送 blob 內容到背景腳本進行下載",
            });
          } catch (innerError) {
            console.error(
              `[DEBUG-CONTENT] 處理 base64 數據時發生錯誤:`,
              innerError
            );
            reject(innerError);
          }
        };
        reader.onerror = () => {
          reject(new Error("讀取 blob 內容失敗"));
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`[DEBUG-CONTENT] 提取 blob 內容時發生錯誤:`, error);
      throw error;
    }
  }

  console.log("Facebook Messenger 語音訊息下載器已初始化");
}
