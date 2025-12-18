#!/bin/bash

# Script to build the extension by zipping all files except .git folder
# and renaming the output to .xpi extension

set -e  # Exit on any error

# Define variables
DIST_DIR="dist"
CHROME_DIR="$DIST_DIR/chrome"
FIREFOX_DIR="$DIST_DIR/firefox"

# Clean up
rm -rf "$DIST_DIR"
mkdir -p "$CHROME_DIR"
mkdir -p "$FIREFOX_DIR"

echo "Preparing builds..."

# Copy files (simple inclusive copy then delete exclusions for simplicity or use rsync)
# Using rsync if available is better, but plain cp with exclusion logic is complex in sh
# Let's copy everything then delete ignored

cp -r . "$CHROME_DIR/"
cp -r . "$FIREFOX_DIR/"

# Cleanup Chrome dir
rm -rf "$CHROME_DIR/.git" "$CHROME_DIR/.github" "$CHROME_DIR/dist" "$CHROME_DIR/*.sh" "$CHROME_DIR/*.ps1" "$CHROME_DIR/*.zip" "$CHROME_DIR/*.xpi" "$CHROME_DIR/manifest-*.json"
cp manifest-chrome.json "$CHROME_DIR/manifest.json"

# Cleanup Firefox dir
rm -rf "$FIREFOX_DIR/.git" "$FIREFOX_DIR/.github" "$FIREFOX_DIR/dist" "$FIREFOX_DIR/*.sh" "$FIREFOX_DIR/*.ps1" "$FIREFOX_DIR/*.zip" "$FIREFOX_DIR/*.xpi" "$FIREFOX_DIR/manifest-*.json"
cp manifest-firefox.json "$FIREFOX_DIR/manifest.json"

# Zip Chrome
echo "Zipping Chrome extension..."
cd "$CHROME_DIR" && zip -r "../efaas-developer-ext-chrome.zip" . && cd - > /dev/null

# Zip Firefox
echo "Zipping Firefox extension..."
cd "$FIREFOX_DIR" && zip -r "../efaas-developer-ext-firefox.xpi" . && cd - > /dev/null

echo "Build complete!"
echo "Chrome build (Unpacked): $CHROME_DIR"
echo "Chrome build (Zip): $DIST_DIR/efaas-developer-ext-chrome.zip"
echo "Firefox build (XPI): $DIST_DIR/efaas-developer-ext-firefox.xpi"


