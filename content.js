/**
 * Chrome Extension Template
 * 
 * Basic content script structure.
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
      console.log(`[Extension Content] ${message}`);
    }
  }
};

/**
 * Main functionality
 */
function initialize() {
  logger.log('Content script initialized');
  
  // Send a test message to the background script
  chrome.runtime.sendMessage(
    { action: 'test', message: 'Hello from content script!' },
    (response) => {
      if (response) {
        logger.log('Received response from background script:');
        logger.log(JSON.stringify(response));
      }
    }
  );
}

// Initialize when the page is loaded
window.addEventListener('load', () => {
  logger.log('Page loaded');
  initialize();
});

// Initialize immediately in case the page is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  logger.log('Page already loaded');
  initialize();
}
