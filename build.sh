#!/bin/bash

# Script to build the extension by zipping all files except .git folder
# and renaming the output to .xpi extension

set -e  # Exit on any error

# Define variables
ZIP_NAME="build_temp.zip"
XPI_NAME="efaas-developer-ext.xpi"
BUILD_DIR="$(pwd)"

echo "Building extension..."

# Create zip archive excluding .git folder and .github folder
zip -r "$ZIP_NAME" . -x ".git/*" ".github/*" "*.sh" "$XPI_NAME"

# Move the zip file to xpi extension
mv "$ZIP_NAME" "$XPI_NAME"

echo "Build complete! Created $XPI_NAME"