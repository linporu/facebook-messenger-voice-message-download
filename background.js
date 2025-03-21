/**
 * Chrome Extension Template
 * 
 * Basic background script structure.
 */

// Configuration
const config = {
  // Debug mode
  debug: true
};

// Logging utility
const logger = {
  log: function(message) {
    if (config.debug) {
      console.log(`[Extension BG] ${message}`);
    }
  }
};

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  logger.log('Received message from content script');
  logger.log(JSON.stringify(request));
  
  // Send a simple response
  sendResponse({ success: true, message: 'Background script received your message' });
  return true;
});
