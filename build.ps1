# Build script for Windows
$ErrorActionPreference = "Stop"

$zipName = "build_temp.zip"
$xpiName = "efaas-developer-ext.xpi"

Write-Host "Building extension..."

# Remove old files if they exist
if (Test-Path $zipName) { Remove-Item $zipName }
if (Test-Path $xpiName) { Remove-Item $xpiName }

# Get items to zip, excluding git folders and build scripts
$items = Get-ChildItem -Path . -Exclude ".git",".github","*.sh","*.ps1","*.zip","*.xpi"

# Compress items
$items | Compress-Archive -DestinationPath $zipName -Force

# Rename to .xpi
Rename-Item -Path $zipName -NewName $xpiName -Force

Write-Host "Build complete! Created $xpiName"
