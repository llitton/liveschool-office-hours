# Connect with LiveSchool - Chrome Extension

Quick access to your LiveSchool scheduling links from anywhere in Chrome.

## Features

- **One-click access** to all your booking links
- **Quick copy** buttons for each event
- **Search** to find events fast
- **See upcoming slots** count for each event
- Works with both individual and shared event types

## Installation (Developer Mode)

Since this extension isn't published to the Chrome Web Store yet, you'll need to install it in developer mode:

1. **Prepare the icons** (one-time setup):
   - Create PNG icons at 16x16, 32x32, 48x48, and 128x128 pixels
   - Save them as `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`
   - Also save the LiveSchool logo as `icons/logo.png` (about 120px wide)
   - You can use the `icons/icon.svg` as a template

2. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `chrome-extension` folder

3. **Connect your account**:
   - Click the extension icon in Chrome toolbar
   - Click "Open Settings"
   - Go to [liveschoolhelp.com/admin/settings](https://liveschoolhelp.com/admin/settings)
   - Find your Quick Links token (under "My Booking Links")
   - Copy the token and paste it in the extension settings
   - Click "Connect Account"

## Usage

1. Click the extension icon in Chrome
2. See all your active events with booking links
3. Click "Copy" to copy any link to clipboard
4. Click "Open" to open the booking page
5. Use the search box to filter events

## Troubleshooting

**Extension shows "Setup Required"**
- You need to connect your LiveSchool account. Click "Open Settings" and enter your token.

**Token not working**
- Make sure you copied the complete token from your settings page
- The token is the part after `/my-links/` in the URL
- Try disconnecting and reconnecting

**Events not loading**
- Check your internet connection
- Make sure you're logged into LiveSchool
- Try clicking the extension again

## Development

For local development, change the API URL in `popup.js` and `options.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000';
```

## Publishing to Chrome Web Store

To publish this extension:

1. Create icons at all required sizes
2. Take screenshots (1280x800 or 640x400)
3. Create a ZIP of the extension folder
4. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
5. Pay the one-time $5 developer fee
6. Upload the ZIP and fill in the listing details
7. Submit for review (usually 1-3 days)

## Files

- `manifest.json` - Extension configuration
- `popup.html` - Main popup UI
- `popup.js` - Popup logic
- `popup.css` - Popup styles
- `options.html` - Settings page
- `options.js` - Settings logic
- `icons/` - Extension icons
