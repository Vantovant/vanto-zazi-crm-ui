# Vanto Zazi — WhatsApp Web CRM Chrome Extension

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select this `chrome-extension` folder
5. The extension icon will appear in your toolbar

## Usage

1. Open [WhatsApp Web](https://web.whatsapp.com) in Chrome
2. Click the **Vanto Zazi** extension icon in your toolbar
3. Log in with your CRM email and password
4. Click **Sync WhatsApp Contacts** to import contacts into your CRM

## What it does

- **Scans** your WhatsApp Web chat list for contact names and phone numbers
- **Syncs** them to your Vanto Zazi CRM database
- **Matches** existing contacts by phone number (no duplicates)
- **Creates** new prospects for unrecognized contacts

## Notes

- You must be logged into WhatsApp Web for the sync to work
- Group chats are automatically skipped
- Only contacts visible in your chat list are scraped (scroll down to load more)
- The extension uses your CRM credentials to securely authenticate
