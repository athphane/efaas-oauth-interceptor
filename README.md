# Efaas Test Account Autofill Extension

This Firefox extension allows you to quickly select and autofill test account credentials for the Efaas national identity provider of Maldives.

## Features
- Select between different user types: Maldivian, Foreigner, Work Permit Holder
- Choose from predefined test accounts for each type
- Automatically fills ID/password fields on Efaas login pages
- Set a default account as extension-wide default or user preference
- Randomly select a test account from any user type
- Single-click fill using the default account by clicking the extension icon
- Fill default account directly from the popup interface
- OAuth callback redirection for local development
- View and copy captured OAuth tokens from the popup interface
- Local domain redirection for custom development environments
- Add, remove, and select local domains for OAuth callback redirection

> [!IMPORTANT]  
> **DISCLAIMER: DEVELOPMENT USE ONLY**  
> This extension is intended strictly for **local development and testing purposes**. It allows developers to test OAuth flows by redirecting callbacks to their local machine (e.g., localhost). It is **not** designed or intended to intercept production traffic for any malicious purpose. Do not use this extension in a production environment where real user data is present.

## Installation Instructions

### Method 1: Developer Mode (Recommended for testing)
1. Open Firefox and navigate to `about:debugging`
2. Click on "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Navigate to the extension folder and select any file (e.g., manifest.json)
5. The extension will be loaded temporarily

### Method 2: Packaged Add-on
1. Package the extension as a .xpi file using web-ext
2. Install the .xpi file in Firefox

## Setup Instructions

1. Place all files in a single directory
2. Create or acquire a 48x48 pixel PNG icon named `icon.png` and place it in the directory
3. Replace the sample test account data in `background.js` with actual data from the Efaas Excel sheet

## Using the Extension

1. Navigate to an Efaas login page
2. Click the extension icon in the toolbar
3. Select the user type (Maldivian, Foreigner, or Work Permit Holder)
4. Choose a specific test account
5. Click "Fill Credentials" to auto-fill the login form

## Customizing Test Account Data

The extension now includes the actual Efaas test account data from the CSV files in the data folder:
- `data/maldivians.csv` - Maldivian test accounts
- `data/foreigners.csv` - Foreigner test accounts
- `data/work_permit_holders.csv` - Work Permit Holder accounts

The extension automatically parses these CSV files to populate the account selection. If you need to update the test accounts:
1. Update the CSV files in the data folder with new account information
2. The extension will automatically use the updated data when reloaded

## Configuring Default Account for Distribution

To set a default account when building and distributing the extension:

1. Open `background.js`
2. Find the `DEFAULT_ACCOUNT_CONFIG` object:
   ```javascript
   const DEFAULT_ACCOUNT_CONFIG = {
     userType: 'maldivian',  // Default user type
     username: 'A900316'      // Default username
   };
   ```
3. Change the `userType` to one of: 'maldivian', 'foreigner', or 'work-permit'
4. Change the `username` to any valid username from the CSV files
5. Save the file

When users click the extension icon directly (not opening the popup), it will automatically fill using this default account.

## Setting User Preferences

Users can set their own preferred default account by:
1. Opening the extension popup
2. Selecting an account
3. Clicking the "Set as Default" button
4. The account will be saved in their browser storage and used for the "Fill Default" button

## OAuth Callback Interceptor (for Local Development)

The extension includes an OAuth callback interceptor that:

1. Automatically detects Efaas OAuth callback pages with hidden forms (containing code, id_token, state fields)
2. Captures the OAuth parameters and stores them in browser storage
3. Shows a notification when OAuth callback data is captured
4. Provides a "View Last OAuth" button in the popup to access captured data
5. Allows developers to easily access the authorization code and tokens during local development
6. Copies the full OAuth data to clipboard when viewed for easy use in development workflows

## Domain Restrictions

For security and performance reasons, this extension only operates on specific Efaas domains:

- `developer.gov.mv/efaas*`
- `developer.egov.mv/efaas*`

The content script (which handles form filling and OAuth interception) only runs on these domains. The popup interface is available everywhere, but form filling and OAuth interception only work when you're on one of the allowed domains.

## Local Domain Redirection

The extension allows you to redirect OAuth callback requests to your local development environment:

1. Use the "Local Domain Redirect" section in the popup interface
2. Enter your local domain (e.g., "localhost:3000/oauth/efaas/callback") in the "Add New Local Domain" field
3. Select it from the "Current Redirect Target" dropdown to set it as the active redirect
4. When an OAuth callback is intercepted, the form will submit to your local domain instead of the staging domain
5. You can add multiple local domains and switch between them as needed
6. Remove domains you no longer need using the "Remove" buttons

This allows you to seamlessly test OAuth flows with your local development environment without having to manually modify callback URLs.

## Files Included

- `manifest.json` - Extension configuration
- `popup.html` - User interface for selecting accounts
- `popup.css` - Styling for the popup
- `popup.js` - Logic for the popup interface
- `content.js` - Script that fills forms on web pages and intercepts OAuth callbacks (only runs on Efaas domains)
- `background.js` - Main logic and data storage (with CSV parsers, account data, and new features like default account, random selection, and OAuth handling)
- `data/` - Folder containing the Efaas test account CSV files
  - `maldivians.csv` - Maldivian test accounts
  - `foreigners.csv` - Foreigner test accounts
  - `work_permit_holders.csv` - Work Permit Holder accounts
- `icon.png` - Extension icon
- `ICON_INSTALLATION.md` - Instructions for adding the icon file

## Notes

- The extension will attempt to identify common login form fields based on their names, IDs, or placeholders
- For best results, the extension works on pages with standard login forms
- Remember to update the test account data with real values from the Efaas Excel sheet