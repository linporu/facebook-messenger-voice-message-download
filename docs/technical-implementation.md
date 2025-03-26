# Facebook Messenger Voice Message Downloader - Technical Implementation

This document outlines the technical implementation details for the Facebook Messenger Voice Message Downloader Chrome extension.

## Architecture Overview

The extension follows a standard Chrome extension architecture with Manifest V3 compliance:

```
facebook-messenger-voice-message-download/
├── manifest.json           # Extension configuration
├── background.js           # Background service worker
├── content-scripts/
│   └── voice-detector.js   # Content script for voice message detection
├── popup/
│   ├── popup.html          # Optional popup UI
│   └── popup.js            # Optional popup logic
└── assets/
    └── icons/              # Extension icons
```

## Core Components

### 1. Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "Facebook Messenger Voice Message Downloader",
  "version": "1.0.0",
  "description": "Download voice messages from Facebook Messenger with a simple right-click",
  "permissions": [
    "contextMenus",
    "downloads",
    "activeTab"
  ],
  "host_permissions": [
    "*://*.facebook.com/*",
    "*://*.messenger.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*.facebook.com/*", "*://*.messenger.com/*"],
      "js": ["content-scripts/voice-detector.js"]
    }
  ],
  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  }
}
```

### 2. Voice Message Detection (content-scripts/voice-detector.js)

The content script is responsible for:
1. Detecting voice message elements in the DOM
2. Monitoring network requests for MP4 files
3. Creating a mapping between audio durations and download URLs
4. Handling right-click events on voice message elements

```javascript
// Global map to store audio durations and their corresponding URLs
const audioMap = new Map();

// Function to detect voice message elements
function detectVoiceMessages() {
  // Primary method: Find elements with role="slider" and aria-label="音訊滑桿" (Audio slider)
  const sliderElements = document.querySelectorAll('div[role="slider"][aria-label="音訊滑桿"]');
  
  // Secondary method: Find elements with role="button" and aria-label="播放" (Play)
  const playButtons = document.querySelectorAll('div[role="button"][aria-label="播放"]');
  
  // Process found elements
  sliderElements.forEach(element => {
    // Mark elements for context menu handling
    element.dataset.voiceMessageElement = 'true';
    console.log('Found voice message slider:', element);
  });
}

// Set up MutationObserver to detect dynamically loaded voice messages
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        // Check if any added nodes contain voice message elements
        detectVoiceMessages();
      }
    });
  });
  
  // Start observing the document body for DOM changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Network request interception using fetch API
function interceptAudioRequests() {
  // Use a proxy to intercept fetch requests
  const originalFetch = window.fetch;
  
  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init);
    
    // Clone the response to avoid consuming it
    const responseClone = response.clone();
    
    // Check if this is an audio file
    if (input && typeof input === 'string' && input.includes('.mp4') && input.includes('audioclip')) {
      responseClone.headers.get('content-disposition').then(disposition => {
        if (disposition && disposition.includes('audioclip')) {
          // Extract duration from filename
          // Format: attachment; filename=audioclip-1742393117000-30999.mp4
          const match = disposition.match(/audioclip-\d+-(\d+)\.mp4/);
          if (match && match[1]) {
            const durationMs = parseInt(match[1], 10);
            // Store in our map
            audioMap.set(durationMs, input);
            console.log(`Mapped audio duration ${durationMs}ms to URL: ${input}`);
          }
        }
      }).catch(err => console.error('Error processing audio response:', err));
    }
    
    return response;
  };
}

// Send message to background script when right-clicking on voice message
document.addEventListener('contextmenu', (event) => {
  // Check if right-clicked element is a voice message or its child
  let targetElement = event.target;
  let voiceMessageElement = null;
  
  // Traverse up to find voice message element
  while (targetElement && targetElement !== document.body) {
    if (targetElement.dataset.voiceMessageElement === 'true' || 
        targetElement.closest('div[role="slider"][aria-label="音訊滑桿"]')) {
      voiceMessageElement = targetElement.closest('div[role="slider"][aria-label="音訊滑桿"]') || targetElement;
      break;
    }
    targetElement = targetElement.parentElement;
  }
  
  if (voiceMessageElement) {
    // Extract duration from aria-valuemax (in seconds)
    const durationSec = parseFloat(voiceMessageElement.getAttribute('aria-valuemax'));
    if (!isNaN(durationSec)) {
      // Convert to milliseconds for our map lookup
      const durationMs = Math.round(durationSec * 1000);
      
      // Send message to background script with duration
      chrome.runtime.sendMessage({
        action: 'rightClickOnVoiceMessage',
        durationMs: durationMs
      });
    }
  }
});

// Listen for download command from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadVoiceMessage' && message.durationMs) {
    const url = audioMap.get(message.durationMs);
    if (url) {
      sendResponse({ success: true, url: url });
    } else {
      sendResponse({ success: false, error: 'URL not found for this duration' });
    }
  }
  return true; // Keep the message channel open for async response
});

// Initialize
function init() {
  console.log('Facebook Messenger Voice Message Downloader initialized');
  detectVoiceMessages();
  setupMutationObserver();
  interceptAudioRequests();
}

// Start when DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

### 3. Background Script (background.js)

The background script handles:
1. Context menu creation and management
2. Initiating downloads when the context menu item is clicked

```javascript
// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'downloadVoiceMessage',
    title: 'Download Voice Message',
    contexts: ['all'],
    documentUrlPatterns: ['*://*.facebook.com/*', '*://*.messenger.com/*']
  });
});

// Store the last right-clicked voice message duration
let lastRightClickedDurationMs = null;

// Listen for right-click on voice message from content script
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'rightClickOnVoiceMessage' && message.durationMs) {
    lastRightClickedDurationMs = message.durationMs;
    // Enable context menu item (it's always visible but will only work when we have a duration)
  }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'downloadVoiceMessage' && lastRightClickedDurationMs) {
    // Send message to content script to get the URL for this duration
    chrome.tabs.sendMessage(tab.id, {
      action: 'downloadVoiceMessage',
      durationMs: lastRightClickedDurationMs
    }, response => {
      if (response && response.success && response.url) {
        // Generate a filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `voice-message-${timestamp}-${lastRightClickedDurationMs}ms.mp4`;
        
        // Download the file
        chrome.downloads.download({
          url: response.url,
          filename: filename,
          saveAs: false // Set to true if you want the user to choose the save location
        });
      } else {
        console.error('Failed to get download URL:', response?.error || 'Unknown error');
        // Optionally show an error notification
      }
    });
  }
});
```

## Implementation Challenges and Solutions

### 1. Network Request Interception

**Challenge**: Capturing MP4 URLs from network requests without using webRequest API (which has limitations in Manifest V3).

**Solution**: Use a fetch proxy in the content script to intercept requests and extract audio file URLs and durations.

### 2. Mapping Voice Message UI to Download URLs

**Challenge**: Reliably connecting the UI element (with duration in seconds) to the correct download URL (with duration in milliseconds).

**Solution**: Create a mapping system that:
1. Extracts duration from the filename in the content-disposition header
2. Stores the URL with the duration as key
3. When a user right-clicks, converts the aria-valuemax (seconds) to milliseconds and looks up the URL

### 3. Dynamic Content Loading

**Challenge**: Facebook loads content dynamically as users scroll through conversations.

**Solution**: Use MutationObserver to detect when new voice messages are added to the DOM.

### 4. UI Changes Resilience

**Challenge**: Facebook may change their UI structure, breaking the detection mechanism.

**Solution**: Implement multiple detection methods:
1. Primary: Find elements with role="slider" and aria-label="音訊滑桿"
2. Secondary: Find elements with role="button" and aria-label="播放" with specific SVG path

### 5. Precise UI Element Recognition

**Challenge**: Accurately identifying which specific voice message UI element the user is right-clicking on, especially when multiple voice messages are present on the page.

**Solution**: Implement a sophisticated DOM traversal approach:

```javascript
// Listen for right-click events anywhere on the page
document.addEventListener('contextmenu', (event) => {
  // Start with the element that was actually clicked
  let targetElement = event.target;
  let voiceMessageElement = null;
  
  // Traverse up the DOM tree to find a voice message container
  while (targetElement && targetElement !== document.body) {
    // Method 1: Check for our custom data attribute (added during detection)
    if (targetElement.dataset.voiceMessageElement === 'true') {
      voiceMessageElement = targetElement;
      break;
    }
    
    // Method 2: Check for the slider element directly
    if (targetElement.matches('div[role="slider"][aria-label="音訊滑桿"]')) {
      voiceMessageElement = targetElement;
      break;
    }
    
    // Method 3: Check if it's within a voice message container
    const sliderParent = targetElement.closest('div[role="slider"][aria-label="音訊滑桿"]');
    if (sliderParent) {
      voiceMessageElement = sliderParent;
      break;
    }
    
    // Move up to the parent element
    targetElement = targetElement.parentElement;
  }
  
  // If we found a voice message element, tell the background script
  if (voiceMessageElement) {
    // Extract the duration from the aria-valuemax attribute
    const durationSec = parseFloat(voiceMessageElement.getAttribute('aria-valuemax'));
    
    if (!isNaN(durationSec)) {
      // Convert to milliseconds for our map lookup
      const durationMs = Math.round(durationSec * 1000);
      
      // Store this element's ID for later reference
      const elementId = `voice-msg-${Date.now()}`;
      voiceMessageElement.dataset.voiceMessageId = elementId;
      
      // Look up the URL directly from our audio map
      const downloadUrl = audioMap.get(durationMs);
      
      // Tell the background script we found a voice message AND send the URL
      chrome.runtime.sendMessage({
        action: 'rightClickOnVoiceMessage',
        durationMs: durationMs,
        elementId: elementId,
        downloadUrl: downloadUrl || null
      });
      
      console.log(`Right-clicked on voice message with duration: ${durationSec}s (${durationMs}ms), URL found: ${downloadUrl ? 'Yes' : 'No'}`);
    }
  }
});
```

### 6. Handling Multiple Voice Messages

**Challenge**: Distinguishing between multiple voice messages on the page, especially if they have similar durations.

**Solution**: Implement a registry system to track all voice message elements:

```javascript
// Keep track of all voice message elements and their durations
const voiceMessageRegistry = new Map();

function detectVoiceMessages() {
  // Find all slider elements
  const sliderElements = document.querySelectorAll('div[role="slider"][aria-label="音訊滑桿"]');
  
  sliderElements.forEach(element => {
    // Mark this as a voice message element
    element.dataset.voiceMessageElement = 'true';
    
    // Extract the duration
    const durationSec = parseFloat(element.getAttribute('aria-valuemax'));
    if (!isNaN(durationSec)) {
      const durationMs = Math.round(durationSec * 1000);
      
      // Generate a unique ID for this element if it doesn't have one
      if (!element.dataset.voiceMessageId) {
        element.dataset.voiceMessageId = `voice-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Register this element
      voiceMessageRegistry.set(element.dataset.voiceMessageId, {
        element: element,
        durationSec: durationSec,
        durationMs: durationMs
      });
      
      console.log(`Registered voice message: ${element.dataset.voiceMessageId} with duration ${durationSec}s`);
    }
  });
}
```

### 7. Context Menu Management

**Challenge**: Showing the context menu only when right-clicking on voice message elements.

**Solution**: Dynamically control context menu visibility in the background script:

```javascript
// Initially create the context menu item as hidden
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'downloadVoiceMessage',
    title: 'Download Voice Message',
    contexts: ['all'],
    documentUrlPatterns: ['*://*.facebook.com/*', '*://*.messenger.com/*'],
    visible: false  // Start with the menu item hidden
  });
});

// Store information about the last right-clicked voice message
let lastRightClickedInfo = null;

// Listen for right-click on voice message from content script
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'rightClickOnVoiceMessage' && message.durationMs) {
    // Store the information about this voice message, including the download URL
    lastRightClickedInfo = {
      tabId: sender.tab.id,
      durationMs: message.durationMs,
      elementId: message.elementId,
      downloadUrl: message.downloadUrl
    };
    
    // Only show the context menu if we have a valid download URL
    if (message.downloadUrl) {
      // Update the context menu to be visible
      chrome.contextMenus.update('downloadVoiceMessage', {
        visible: true
      });
    } else {
      console.log('No download URL found for this voice message');
    }
  }
});

// Handle when context menu is closed without selecting an item
chrome.contextMenus.onHidden.addListener(() => {
  // Hide our menu item again until the next right-click on a voice message
  chrome.contextMenus.update('downloadVoiceMessage', {
    visible: false
  });
  
  // Clear the last right-clicked info
  lastRightClickedInfo = null;
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'downloadVoiceMessage' && lastRightClickedInfo && lastRightClickedInfo.downloadUrl) {
    // Generate a filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `voice-message-${timestamp}-${lastRightClickedInfo.durationMs}ms.mp4`;
    
    // Download the file directly using the URL we already have
    chrome.downloads.download({
      url: lastRightClickedInfo.downloadUrl,
      filename: filename,
      saveAs: false // Set to true if you want the user to choose the save location
    });
    
    console.log(`Downloading voice message: ${filename}`);
  } else if (info.menuItemId === 'downloadVoiceMessage') {
    console.error('No download URL available for this voice message');
    // Optionally show an error notification to the user
  }
});
```

## Testing Strategy

### Unit Tests

Use Jest for unit testing:

```javascript
// Example test for duration extraction
test('extracts duration from content-disposition header', () => {
  const header = 'attachment; filename=audioclip-1742393117000-30999.mp4';
  const duration = extractDurationFromHeader(header);
  expect(duration).toBe(30999);
});
```

### Integration Tests

Test the extension on both facebook.com and messenger.com:
1. Verify voice message detection
2. Confirm context menu appears when right-clicking on voice messages
3. Validate download functionality

### Manual Testing Checklist

- [ ] Extension loads correctly on Facebook and Messenger
- [ ] Voice messages are detected in various conversation layouts
- [ ] Context menu appears only when right-clicking on voice messages
- [ ] Downloaded files play correctly
- [ ] Extension works with different voice message durations
- [ ] Performance impact is minimal

## Security Considerations

1. **Permissions**: The extension uses minimal permissions required for functionality
2. **Data Handling**: All processing happens locally, no data is sent to external servers
3. **URL Validation**: Ensure downloaded URLs are legitimate Facebook audio files
4. **Content Security Policy**: Implement appropriate CSP in manifest.json

## Performance Optimization

1. **Efficient DOM Traversal**: Use specific selectors to minimize DOM searching
2. **Throttled Observers**: Implement throttling for MutationObserver to reduce CPU usage
3. **Memory Management**: Clear audioMap entries for old conversations to prevent memory leaks

## Browser Compatibility

The extension is designed for Chrome but could be adapted for:
- Firefox (with minimal changes to manifest.json)
- Edge (fully compatible with Chrome extensions)
- Opera (based on Chromium, should be compatible)

## Future Technical Enhancements

1. **IndexedDB Storage**: Store URL mappings in IndexedDB for persistence across page reloads
2. **Web Audio API Integration**: Add audio processing capabilities for format conversion
3. **Network Request Batching**: Optimize network request handling for multiple voice messages
4. **Service Worker Improvements**: Enhance background script capabilities within Manifest V3 constraints
