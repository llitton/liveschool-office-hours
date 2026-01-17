# Icons Needed

To use this extension, create the following PNG files:

## Required Icons

| File | Size | Purpose |
|------|------|---------|
| `icon16.png` | 16x16 | Toolbar (small) |
| `icon32.png` | 32x32 | Toolbar (retina) |
| `icon48.png` | 48x48 | Extensions page |
| `icon128.png` | 128x128 | Chrome Web Store |
| `logo.png` | ~120px wide | Header logo |

## How to Create

### Option 1: Use the SVG
1. Open `icon.svg` in a browser or image editor
2. Export as PNG at each required size
3. Or use https://svgtopng.com

### Option 2: Use the LiveSchool logo
1. Download from https://info.whyliveschool.com/hubfs/Brand/liveschool-logo.png
2. Crop to square and resize for icons
3. Save the full logo as `logo.png`

### Option 3: Use ImageMagick (if installed)
```bash
./generate-icons.sh
```

## Quick Testing

The extension will load without icons - it just won't display in the toolbar.
Add a simple colored square as a placeholder if needed.
