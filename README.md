# Efaas Developer Assistant

A powerful browser extension designed to streamline the development and testing process for integrations with the Efaas (Maldives National Digital Identity) platform.

## 🚀 Overview

The Efaas Developer Assistant helps developers test OAuth 2.0 flows, manage test accounts, and debug callback redirections without manual effort. It provides a suite of tools that automate the repetitive parts of the Efaas authentication cycle.

> [!IMPORTANT]
> **Developer Credentials & Data**
> This extension **does not provide Efaas Developer Credentials (Client ID, Client Secret, etc.) out of the box**.
> Obtain your own developer credentials legally.
> Similarly, while the extension supports account autofill, you are responsible for providing your own test account data via the CSV upload feature.

## ✨ Key Features

- **Automated Form Filling**: Instantly fill ID and Password fields on Efaas login pages using custom test accounts.
- **CSV Account Management**: Upload your own CSV files containing test accounts for different user types (Maldivian, Foreigner, Work Permit Holder).
- **OAuth Callback Interceptor**: Automatically detect and capture OAuth callback parameters (code, tokens, state) from Efaas response pages.
- **Local Domain Redirection**: Redirect Efaas authorization requests to your local development environment (e.g., `localhost:3000`) with ease.
- **Session Data Viewer**: View, copy, and manage captured OAuth data and authorization form extractions directly from the extension popup.

## 🛠️ Installation

### For Chrome / Chromium
1. Download or clone this repository.
2. Run `.\build.ps1` (Windows) or `./build.sh` (Linux/Mac) to generate the `dist` folder.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer mode** in the top right.
5. Click **Load unpacked** and select the `dist/chrome` folder.

### For Official Firefox
Since the extension is unsigned, you must load it as a temporary add-on:
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Navigate to the `dist/firefox` folder and select the `manifest.json` file.
4. The extension is now active until you restart Firefox.

### For Floorp / Firefox Developer Edition
1. Download the `efaas-developer-ext-firefox.xpi` from the `dist` folder.
2. Drag and drop it into the browser or install it via `about:addons`.


## 📖 How to Use

### 1. Set Up Your Test Accounts
To use the autofill feature, you need to load your test accounts:
- When you receive the Efaas test credentials (typically an Excel file), **save each sheet as a separate CSV file**.
- Open the extension popup by clicking its icon.
- Use the **"Upload CSV"** button to upload each CSV file you created.
- The extension will automatically categorize them based on the content.
- Your data is stored securely in your browser's local storage.

### 2. Autofilling Login Forms
- Navigate to an Efaas login page.
- Choose a user type and account from the dropdowns in the popup.
- Click **"Fill Credentials"** or use the **"Random Account"** button for quick testing.

### 3. Redirecting to Localhost
If you are developing locally:
- Go to the **"Domain Redirect Mapping"** section in the popup.
- Add a mapping (e.g., Source: `developer.gov.mv` -> Target: `localhost:3000`).
- The extension will automatically adjust form targets to point to your development server during the OAuth flow.

## ⚖️ Disclaimer

**STRICTLY FOR DEVELOPMENT USE ONLY.**

This extension is intended for developers working on Efaas integrations. It should **never** be used in production environments or with real user data. The authors are not responsible for any misuse of this tool.

## 📂 Project Structure

- `content.js`: Handles page interaction and form manipulation.
- `background.js`: Manages application state and data storage.
- `popup.html/css/js`: The main user interface.
- `data/`: Sample directory for organizing your test account CSVs.

---
*Created by a developer constantly having to integrate and test eFaas integration across multiple projects...*
