/**
 * Facebook Messenger Voice Message Downloader
 * 
 * Background script to handle downloads and other background tasks.
 */

// Configuration
const config = {
  // Debug mode
  debug: false
};

// Logging utility
const logger = {
  log: function(message) {
    if (config.debug) {
      console.log(`[FB Voice Downloader BG] ${message}`);
    }
  },
  error: function(message) {
    console.error(`[FB Voice Downloader BG] ${message}`);
  }
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.log('Received message from content script');
  logger.log(JSON.stringify(request));
  
  if (request.action === 'downloadVoiceMessage') {
    downloadVoiceMessage(request.url, request.filename)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        logger.error(`Download error: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate that we will send a response asynchronously
    return true;
  }
});

/**
 * Download a voice message
 * @param {string} url - The URL of the voice message
 * @param {string} filename - The filename to save as
 * @returns {Promise} A promise that resolves when the download is complete
 */
async function downloadVoiceMessage(url, filename) {
  logger.log(`Downloading voice message: ${url} as ${filename}`);
  
  try {
    // Use Chrome's download API to download the file
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    });
    
    logger.log(`Download initiated with ID: ${downloadId}`);
    return downloadId;
  } catch (error) {
    logger.error(`Download failed: ${error.message}`);
    throw error;
  }
}
