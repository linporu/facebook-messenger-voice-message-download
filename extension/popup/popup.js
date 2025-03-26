/**
 * Chrome Extension Template
 * 
 * Popup script with basic functionality.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup loaded');
  
  // Display current time in the status element
  const statusElement = document.querySelector('.status p');
  const now = new Date();
  statusElement.textContent = `✅ Extension is active! (${now.toLocaleTimeString()})`;
});
