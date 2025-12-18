# Build script for Windows
$ErrorActionPreference = "Stop"

$distDir = "dist"
$chromeDir = "$distDir\chrome"
$firefoxDir = "$distDir\firefox"

if (Test-Path $distDir) { Remove-Item $distDir -Recurse -Force }
New-Item -ItemType Directory -Path $chromeDir -Force | Out-Null
New-Item -ItemType Directory -Path $firefoxDir -Force | Out-Null

Write-Host "Preparing builds..."

# Define excluded items
$exclude = @(".git", ".github", "dist", "*.sh", "*.ps1", "*.zip", "*.xpi", "manifest-chrome.json", "manifest-firefox.json")

# Copy Chrome files
Get-ChildItem -Path . -Exclude $exclude | Copy-Item -Destination $chromeDir -Recurse
Copy-Item "manifest-chrome.json" "$chromeDir\manifest.json" -Force

# Copy Firefox files
Get-ChildItem -Path . -Exclude $exclude | Copy-Item -Destination $firefoxDir -Recurse
Copy-Item "manifest-firefox.json" "$firefoxDir\manifest.json" -Force

# Zip Chrome
Write-Host "Zipping Chrome extension..."
Compress-Archive -Path "$chromeDir\*" -DestinationPath "$distDir\efaas-developer-ext-chrome.zip" -Force

# Zip Firefox (XPI)
Write-Host "Zipping Firefox extension..."
Compress-Archive -Path "$firefoxDir\*" -DestinationPath "$distDir\efaas-developer-ext-firefox.xpi" -Force

Write-Host "Build complete!"
Write-Host "Chrome build (Unpacked): $chromeDir"
Write-Host "Chrome build (Zip): $distDir\efaas-developer-ext-chrome.zip"
Write-Host "Firefox build (XPI): $distDir\efaas-developer-ext-firefox.xpi"
