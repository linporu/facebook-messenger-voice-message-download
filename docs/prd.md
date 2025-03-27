# Facebook Messenger Voice Message Downloader - PRD

## Product Overview
A Chrome extension that enables users to download voice messages from Facebook Messenger through a simple right-click context menu option.

## Problem Statement
Facebook Messenger doesn't provide a native way to download voice messages. Users often need to save these messages for various purposes such as record-keeping, sharing on other platforms, or offline access.

## Target Users
- Regular Facebook Messenger users
- People who need to archive conversations
- Users who want to save important voice messages

## User Flow
1. User navigates to Facebook Messenger (facebook.com or messenger.com)
2. User scrolls through the chat, loading voice messages
3. User right-clicks on a voice message UI element
4. User selects "Download Voice Message" from the context menu
5. The voice message downloads to the user's default download directory

## Features and Requirements

### Core Functionality
1. **Voice Message Detection**
   - Automatically detect voice message elements in the DOM
   - Support for both facebook.com and messenger.com
   - Handle dynamically loaded content through MutationObserver

2. **Context Menu Integration**
   - Add a "Download Voice Message" option to the context menu when right-clicking on voice message elements
   - Only show this option when a voice message is right-clicked

3. **Download Mechanism**
   - Extract the correct MP4 URL for the voice message
   - Use Chrome's download API to save the file
   - Provide appropriate filename with timestamp and duration

### Technical Implementation

1. **Voice Message Detection**
   - Listen for DOM mutations to detect dynamically loaded voice messages
   - Identify voice messages using multiple attributes for reliability:
     - Primary method: Find elements with `role="slider"` and `aria-label="音訊滑桿"` (Audio slider)
     - Secondary method: Find elements with `role="button"` and `aria-label="播放"` (Play) containing the SVG path
   - The audio slider element contains duration information in `aria-valuemax` attribute
   - The play button contains the SVG path: "M10 25.5v-15a1.5 1.5 0 012.17-1.34l15 7.5a1.5 1.5 0 010 2.68l-15 7.5A1.5 1.5 0 0110 25.5z"

2. **URL Extraction Method**
   - Monitor network requests for MP4 files
   - Extract duration from response headers (content-disposition)
   - Example: `attachment; filename=audioclip-1742393117000-30999.mp4` where 30999 is the duration in milliseconds
   - Create a map with duration as key and request URL as value

3. **Context Menu Handling**
   - Register a context menu item using Chrome's contextMenus API
   - When user right-clicks on a voice message element, identify the parent slider element
   - Extract audio duration from the slider element's `aria-valuemax` attribute (in seconds)
   - Convert to milliseconds and use as key to find the corresponding URL in the map
   - Trigger download when "Download Voice Message" option is clicked

4. **Download Process**
   - Use chrome.downloads.download API to initiate the download
   - Append appropriate query parameters to ensure successful download
   - Handle potential errors during the download process

## Technical Constraints

1. **Manifest V3 Compliance**
   - Use Manifest V3 for Chrome extension development
   - Follow Chrome Web Store policies and guidelines

2. **Permissions**
   - Minimal permissions required:
     - contextMenus: For adding the download option
     - downloads: For downloading files
     - activeTab: For accessing the current tab's content
     - host permissions for facebook.com and messenger.com

3. **Performance Considerations**
   - Minimize impact on page load and browsing experience
   - Efficient DOM observation to avoid performance issues

## Edge Cases and Handling

1. **Multiple Voice Messages**
   - Handle scenarios where multiple voice messages are present
   - Ensure correct mapping between UI elements and download URLs

2. **Network Issues**
   - Handle cases where network requests fail
   - Provide appropriate error feedback to users

3. **UI Changes**
   - Design detection mechanism to be robust against minor UI changes
   - Implement multiple detection methods as fallbacks

## Testing Strategy

1. **Functional Testing**
   - Test on both facebook.com and messenger.com
   - Verify detection of voice messages
   - Confirm context menu appears correctly
   - Validate download functionality

2. **Unit Testing**
   - Use Jest for unit testing components
   - Test detection mechanisms
   - Test URL extraction logic

3. **User Testing**
   - Gather feedback on usability
   - Identify any edge cases missed during development

## Future Enhancements

1. **Support for Additional Platforms**
   - Extend functionality to Instagram direct messages
   - Support for other messaging platforms with similar voice message features

2. **Enhanced User Options**
   - Allow users to customize download location
   - Provide options for automatic file naming conventions
   - Add batch download capability for multiple voice messages

3. **Format Conversion**
   - Add option to convert MP4 to other audio formats (MP3, WAV, etc.)
   - Implement client-side conversion to maintain privacy