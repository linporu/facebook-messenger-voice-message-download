# Facebook Messenger Voice Message Downloader

A Chrome extension that adds a download button to voice messages in Facebook Messenger.

## Features

- Automatically detect voice messages in Facebook Messenger
- Add a download button to each voice message
- Click the button to download the voice message as an MP3 file
- Supports Facebook web version and Messenger.com
- Consistent with Facebook Messenger's UI style

## Installation Methods

### Development Mode Installation

1. Download or clone this repository to your local machine
2. Open Chrome browser, enter extension management page (`chrome://extensions/`)
3. Enable developer mode in the top right corner
4. Click "Load unpacked"
5. Select the folder of this repository

## Usage

1. After installation, open Facebook Messenger (web version)
2. Enter a conversation with voice messages
3. A download button (↓) will appear next to each voice message
4. Click the button to download the voice message

## Technical Architecture

- `manifest.json`: The configuration file of the extension
- `content.js`: Injected into Facebook Messenger page, detect voice messages and add download button
- `background.js`: Handle download requests
- `popup.html/js`: The popup UI of the extension
- `styles.css`: The style file

## Future Plans

- Batch download feature
- Customizable download file name
- Support more chat platforms
