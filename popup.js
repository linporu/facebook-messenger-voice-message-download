/**
 * Facebook Messenger Voice Message Downloader
 * 
 * Popup script to handle user interactions in the extension popup.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Get references to UI elements
  const optionsBtn = document.getElementById('options-btn');
  
  // Add event listeners
  optionsBtn.addEventListener('click', function() {
    // For now, just show an alert since we don't have options page yet
    alert('Options page will be available in future versions!');
    
    // Uncomment this when options page is implemented
    // chrome.runtime.openOptionsPage();
  });
  
  // Check if we're on Facebook Messenger
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    const url = currentTab.url;
    
    // Update status message based on current site
    const statusElement = document.querySelector('.status p');
    
    if (url.includes('facebook.com') || url.includes('messenger.com')) {
      statusElement.textContent = '✅ You are on Facebook/Messenger. Voice message download buttons should appear automatically.';
    } else {
      statusElement.textContent = '⚠️ You are not on Facebook/Messenger. Navigate to Facebook or Messenger to use this extension.';
    }
  });
});
