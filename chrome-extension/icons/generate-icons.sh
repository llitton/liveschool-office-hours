#!/bin/bash
# Generate PNG icons from SVG using ImageMagick (if available)
# Install with: brew install imagemagick

if command -v convert &> /dev/null; then
    convert -background none icon.svg -resize 16x16 icon16.png
    convert -background none icon.svg -resize 32x32 icon32.png
    convert -background none icon.svg -resize 48x48 icon48.png
    convert -background none icon.svg -resize 128x128 icon128.png
    echo "Icons generated successfully!"
else
    echo "ImageMagick not found. Install with: brew install imagemagick"
    echo "Or use an online SVG to PNG converter at https://svgtopng.com"
fi
