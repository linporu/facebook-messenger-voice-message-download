/**
 * Facebook Messenger Voice Message Downloader
 * 
 * This content script identifies voice messages in Facebook Messenger
 * and adds download buttons next to them.
 */

// Configuration
const config = {
  // CSS class for the download button
  downloadButtonClass: 'fb-voice-msg-download-btn',
  // How often to check for new voice messages (in milliseconds)
  checkInterval: 1000,
  // Debug mode
  debug: false
};

// Logging utility
const logger = {
  log: function(message) {
    if (config.debug) {
      console.log(`[FB Voice Downloader] ${message}`);
    }
  },
  error: function(message) {
    console.error(`[FB Voice Downloader] ${message}`);
  }
};

/**
 * Main class for handling voice message detection and download
 */
class VoiceMessageDownloader {
  constructor() {
    this.processedMessages = new Set();
    this.observer = null;
    this.setupMutationObserver();
    this.init();
  }

  /**
   * Initialize the downloader
   */
  init() {
    logger.log('Initializing voice message downloader');
    this.scanForVoiceMessages();
    
    // Periodically scan for new voice messages
    setInterval(() => {
      this.scanForVoiceMessages();
    }, config.checkInterval);
  }

  /**
   * Set up mutation observer to detect DOM changes
   */
  setupMutationObserver() {
    logger.log('Setting up mutation observer');
    
    // Create a new observer
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      
      if (shouldScan) {
        this.scanForVoiceMessages();
      }
    });
    
    // Start observing the document body
    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Scan the page for voice messages
   */
  scanForVoiceMessages() {
    logger.log('Scanning for voice messages');
    
    // Look for audio elements within messenger conversations
    // This selector might need adjustment based on Facebook's actual DOM structure
    const potentialVoiceMessages = document.querySelectorAll('audio[src*="audioclip"]');
    
    if (potentialVoiceMessages.length > 0) {
      logger.log(`Found ${potentialVoiceMessages.length} potential voice messages`);
      
      potentialVoiceMessages.forEach(audioElement => {
        this.processVoiceMessage(audioElement);
      });
    }
    
    // Alternative approach: look for voice message containers
    // This is a fallback in case direct audio element detection doesn't work
    const voiceMessageContainers = document.querySelectorAll('div[aria-label*="Voice Message"], div[data-testid*="voice-message"]');
    
    if (voiceMessageContainers.length > 0) {
      logger.log(`Found ${voiceMessageContainers.length} voice message containers`);
      
      voiceMessageContainers.forEach(container => {
        const audioElement = container.querySelector('audio');
        if (audioElement) {
          this.processVoiceMessage(audioElement);
        }
      });
    }
  }

  /**
   * Process a voice message element
   * @param {HTMLElement} audioElement - The audio element
   */
  processVoiceMessage(audioElement) {
    // Generate a unique ID for this audio element
    const audioId = this.getUniqueIdForElement(audioElement);
    
    // Skip if we've already processed this element
    if (this.processedMessages.has(audioId)) {
      return;
    }
    
    logger.log(`Processing voice message: ${audioId}`);
    this.processedMessages.add(audioId);
    
    // Get the parent container for the audio element
    const container = this.findParentContainer(audioElement);
    if (!container) {
      logger.error('Could not find parent container for voice message');
      return;
    }
    
    // Add download button
    this.addDownloadButton(container, audioElement);
  }

  /**
   * Find the parent container for an audio element
   * @param {HTMLElement} audioElement - The audio element
   * @returns {HTMLElement} The parent container
   */
  findParentContainer(audioElement) {
    // Look for a parent div that contains the audio controls
    // This might need adjustment based on Facebook's DOM structure
    let container = audioElement.parentElement;
    
    // Go up a few levels to find a suitable container
    for (let i = 0; i < 5; i++) {
      if (!container) break;
      
      // Check if this is a good container (has other controls, etc.)
      if (container.querySelector('div[role="button"]')) {
        return container;
      }
      
      container = container.parentElement;
    }
    
    // Fallback: return the immediate parent
    return audioElement.parentElement;
  }

  /**
   * Add a download button to a voice message container
   * @param {HTMLElement} container - The container element
   * @param {HTMLElement} audioElement - The audio element
   */
  addDownloadButton(container, audioElement) {
    // Check if button already exists
    if (container.querySelector(`.${config.downloadButtonClass}`)) {
      return;
    }
    
    logger.log('Adding download button');
    
    // Create download button
    const downloadButton = document.createElement('div');
    downloadButton.className = config.downloadButtonClass;
    downloadButton.title = 'Download voice message';
    downloadButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 17V3"></path>
        <path d="M7 12l5 5 5-5"></path>
        <path d="M19 21H5"></path>
      </svg>
    `;
    
    // Add click event listener
    downloadButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.downloadVoiceMessage(audioElement);
    });
    
    // Find a good place to insert the button
    // Look for existing control buttons
    const controlsContainer = container.querySelector('div[role="button"]')?.parentElement;
    
    if (controlsContainer) {
      // Insert next to other controls
      controlsContainer.appendChild(downloadButton);
    } else {
      // Fallback: append to container
      container.appendChild(downloadButton);
    }
  }

  /**
   * Download a voice message
   * @param {HTMLElement} audioElement - The audio element
   */
  downloadVoiceMessage(audioElement) {
    const audioUrl = audioElement.src;
    
    if (!audioUrl) {
      logger.error('No audio URL found');
      return;
    }
    
    logger.log(`Downloading voice message from: ${audioUrl}`);
    
    // Generate a filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `voice_message_${timestamp}.mp3`;
    
    // Send message to background script to handle download
    chrome.runtime.sendMessage({
      action: 'downloadVoiceMessage',
      url: audioUrl,
      filename: filename
    }, (response) => {
      if (response && response.success) {
        logger.log('Download initiated successfully');
      } else {
        logger.error('Failed to initiate download');
      }
    });
  }

  /**
   * Generate a unique ID for an element
   * @param {HTMLElement} element - The element
   * @returns {string} A unique ID
   */
  getUniqueIdForElement(element) {
    const src = element.src || '';
    const parent = element.parentElement ? element.parentElement.innerHTML.length : 0;
    return `${src}-${parent}`;
  }
}

// Initialize the downloader when the page is loaded
window.addEventListener('load', () => {
  logger.log('Page loaded, initializing downloader');
  new VoiceMessageDownloader();
});

// Initialize immediately in case the page is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  logger.log('Page already loaded, initializing downloader');
  new VoiceMessageDownloader();
}
