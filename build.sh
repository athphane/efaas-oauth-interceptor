#!/bin/bash

# Script to build the extension by zipping all files except .git folder
# and renaming the output to .xpi extension

set -e  # Exit on any error

# Define variables
DIST_DIR="dist"
CHROME_DIR="$DIST_DIR/chrome"
FIREFOX_DIR="$DIST_DIR/firefox"

# Clean up
# Clean up and recreate directories
rm -rf "$DIST_DIR"
mkdir -p "$CHROME_DIR"
mkdir -p "$FIREFOX_DIR"

echo "Preparing builds..."

# List of files and folders to include in the build
BUILD_ASSETS="background.js content.js interceptor.js icon.png popup.html popup.css popup.js data"

for asset in $BUILD_ASSETS; do
    if [ -e "$asset" ]; then
        cp -r "$asset" "$CHROME_DIR/"
        cp -r "$asset" "$FIREFOX_DIR/"
    fi
done

# Copy browser-specific manifests
cp manifest-chrome.json "$CHROME_DIR/manifest.json"
cp manifest-firefox.json "$FIREFOX_DIR/manifest.json"

# Zip Chrome
echo "Zipping Chrome extension..."
(cd "$CHROME_DIR" && zip -r "../efaas-developer-ext-chrome.zip" .)

# Zip Firefox
echo "Zipping Firefox extension..."
(cd "$FIREFOX_DIR" && zip -r "../efaas-developer-ext-firefox.xpi" .)

echo "Build complete!"
echo "Chrome build (Unpacked): $CHROME_DIR"
echo "Chrome build (Zip): $DIST_DIR/efaas-developer-ext-chrome.zip"
echo "Firefox build (XPI): $DIST_DIR/efaas-developer-ext-firefox.xpi"



