// Background script for Manifest V3
// Compatible with Chrome, Edge, and Firefox

// Polyfill browser API for Chrome
if (typeof browser === "undefined") {
  var browser = chrome;
}

// Default account configuration
const DEFAULT_ACCOUNT_CONFIG = {
  userType: 'maldivian',
  username: 'A900316'
};

// Helper: Get DB from storage
async function getAccountDB() {
  const result = await browser.storage.local.get(['accountUserDB']);
  return result.accountUserDB || {};
}

// Function to check for OAuth form (to be executed in tab)
function checkForOAuthForm() {
  const forms = document.querySelectorAll('form[method="post"]');
  for (let form of forms) {
    const codeInput = form.querySelector('input[name="code"]');
    const idTokenInput = form.querySelector('input[name="id_token"]');
    const stateInput = form.querySelector('input[name="state"]');
    if (codeInput && idTokenInput && stateInput) {
      return true;
    }
  }
  return false;
}

// Add action click listener (replaces browserAction in V3)
const actionAPI = browser.action || browser.browserAction;

actionAPI.onClicked.addListener((tab) => {
  // Check if the current tab is on an allowed domain
  const allowedDomains = ['developer.gov.mv', 'developer.egov.mv'];
  const tabUrl = new URL(tab.url);
  const isAllowedDomain = allowedDomains.some(domain => tabUrl.hostname === domain || tabUrl.hostname.endsWith('.' + domain));

  if (isAllowedDomain && tabUrl.pathname.startsWith('/efaas')) {
    // Check if we have the scripting API (MV3) or need to fallback to tabs (MV2)
    if (browser.scripting && browser.scripting.executeScript) {
      // MV3: Use scripting API
      browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: checkForOAuthForm
      }).then((injectionResults) => {
        const isOAuthPage = injectionResults && injectionResults[0] && injectionResults[0].result;
        handleOAuthCheckResult(tab, isOAuthPage);
      }).catch(err => {
        console.error('Error executing script (MV3):', err);
      });
    } else {
      // MV2: Use tabs API
      const code = `(${checkForOAuthForm.toString()})();`;
      browser.tabs.executeScript(tab.id, {
        code: code
      }).then((results) => {
        const isOAuthPage = results && results[0];
        handleOAuthCheckResult(tab, isOAuthPage);
      }).catch(err => {
        console.error('Error executing script (MV2):', err);
      });
    }
  } else {
    console.log('Extension not active on this domain.');
    if (actionAPI.openPopup) {
      actionAPI.openPopup();
    }
  }
});

function handleOAuthCheckResult(tab, isOAuthPage) {
  if (isOAuthPage) {
    console.log('Detected OAuth callback page');
    // We already have the content script handling this
  } else {
    // Regular page, fill with default account
    browser.runtime.sendMessage({ action: 'getDefaultAccount' }).then(response => {
      if (response.account) {
        browser.tabs.sendMessage(tab.id, {
          action: 'fillCredentials',
          credentials: response.account
        });
      } else if (response.error) {
        console.error('Error getting default account:', response.error);
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'No Account Data',
          message: 'Please click the extension icon and upload a CSV file to use this feature.'
        });
      }
    }).catch(console.error);
  }
}





// Set up the web request listener for /authorize endpoint interception
// Listener removed: handleAuthorizeRequest used to intercept /authorize and redirect to local domain immediately.
// This was incorrect as it bypassed the IDP authentication step.
// We now rely on content.js to intercept the RESULT (form submission) of the auth flow.

// Listen for messages
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Account Data Retrievers - Async
  if (request.action === 'getAccountTypes') {
    getAccountDB().then(db => {
      sendResponse({ accountTypes: Object.keys(db) });
    });
    return true;
  }
  else if (request.action === 'getAccountsByType') {
    getAccountDB().then(db => {
      const accounts = db[request.userType] || [];
      sendResponse({ accounts: accounts });
    });
    return true;
  }
  else if (request.action === 'getRandomAccount') {
    getAccountDB().then(db => {
      const userTypes = Object.keys(db);
      if (userTypes.length === 0) {
        sendResponse({ error: "No accounts loaded" });
        return;
      }
      const randomUserType = userTypes[Math.floor(Math.random() * userTypes.length)];
      const accounts = db[randomUserType];
      if (!accounts || accounts.length === 0) {
        sendResponse({ error: "No accounts in selected type" });
        return;
      }
      const randomAccount = accounts[Math.floor(Math.random() * accounts.length)];
      sendResponse({ account: randomAccount, userType: randomUserType });
    });
    return true;
  }
  else if (request.action === 'getDefaultAccount') {
    getAccountDB().then(db => {
      const accounts = db[DEFAULT_ACCOUNT_CONFIG.userType];
      if (accounts && accounts.length > 0) {
        const defaultAccount = accounts.find(acc => acc.username === DEFAULT_ACCOUNT_CONFIG.username);
        // Return specific default or fallback to first
        sendResponse({
          account: defaultAccount || accounts[0],
          userType: DEFAULT_ACCOUNT_CONFIG.userType
        });
      } else {
        // Fallback to any available account if default type is empty?
        // Better to just return error or try another type.
        const types = Object.keys(db);
        if (types.length > 0 && db[types[0]].length > 0) {
          sendResponse({
            account: db[types[0]][0],
            userType: types[0]
          });
        } else {
          sendResponse({ error: "No accounts available. Please upload CSV." });
        }
      }
    });
    return true;
  }
  // Data Handlers (Sync/Async mixed)
  else if (request.action === 'oauthCallbackReceived') {
    console.log('OAuth callback received:', request.data);
    // Store the OAuth data for potential use by the popup
    browser.storage.local.set({ lastOAuthCallback: request.data }).catch(error => {
      console.error('Error saving last OAuth callback:', error);
    });
    // Optionally show a notification to the user
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Efaas OAuth Callback Received',
      message: 'Authorization code and tokens captured successfully',
      eventTime: Date.now() + 5000
    }).catch(error => {
      // Notifications permission might not be granted, which is fine
      console.log('Could not create notification:', error);
    });
  }
  else if (request.action === 'authorizeDataSent') {
    console.log('Authorize endpoint data sent to local domain:', request.data);
    // Store the authorize data for potential use by the popup
    browser.storage.local.set({ lastAuthorizeData: request.data }).catch(error => {
      console.error('Error saving last authorize data:', error);
    });
    // Optionally show a notification to the user
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Efaas /authorize Endpoint Intercepted',
      message: 'Authorization request data sent to local domain',
      eventTime: Date.now() + 5000
    }).catch(error => {
      // Notifications permission might not be granted, which is fine
      console.log('Could not create notification:', error);
    });
  }
  else if (request.action === 'authorizationFormModified') {
    console.log('Authorization form modified by content script:', request.data);
    // Store the form modification data for potential use by the popup
    browser.storage.local.set({ lastAuthorizationFormChange: request.data }).catch(error => {
      console.error('Error saving last authorization form change:', error);
    });
    // Show a notification to the user
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Efaas Authorization Form Modified',
      message: 'Form action changed to local domain',
      eventTime: Date.now() + 5000
    }).catch(error => {
      // Notifications permission might not be granted, which is fine
      console.log('Could not create notification:', error);
    });
  }
  else if (request.action === 'authorizeFormExtracted') {
    console.log('Authorization form data extracted by content script:', request.data);
    // Store the extracted form data for potential use by the popup
    browser.storage.local.set({ lastAuthorizeFormData: request.data }).catch(error => {
      console.error('Error saving last authorize form data:', error);
    });
    // Show a notification to the user
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Efaas Authorization Form Data Extracted',
      message: 'Form data sent to local domain',
      eventTime: Date.now() + 5000
    }).catch(error => {
      // Notifications permission might not be granted, which is fine
      console.log('Could not create notification:', error);
    });
  }
  else if (request.action === 'formDataSentSuccessfully') {
    console.log('Form data successfully sent to:', request.url);
  }
  else if (request.action === 'authorizePageReplaced') {
    console.log('Authorization page content replaced by content script:', request.data);
    // Store the page replacement data for potential use by the popup
    browser.storage.local.set({ lastAuthorizePageReplacement: request.data }).catch(error => {
      console.error('Error saving last authorize page replacement:', error);
    });
    // Show a notification to the user
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Efaas Authorization Page Replaced',
      message: 'Page redirected to local domain',
      eventTime: Date.now() + 5000
    }).catch(error => {
      // Notifications permission might not be granted, which is fine
      console.log('Could not create notification:', error);
    });
  }
  else if (request.action === 'getUserPreference') {
    // Get user's saved preference
    browser.storage.local.get(['preferredAccount']).then((result) => {
      sendResponse({ preferredAccount: result.preferredAccount || null });
    });
    return true;
  }
  else if (request.action === 'saveUserPreference') {
    // Save user's preferred account
    browser.storage.local.set({ preferredAccount: request.account }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  else if (request.action === 'getLastOAuthCallback') {
    // Get the last captured OAuth callback data
    browser.storage.local.get(['lastOAuthCallback']).then((result) => {
      sendResponse({ oauthData: result.lastOAuthCallback || null });
    });
    return true;
  }
  else if (request.action === 'getLastAuthorizeData') {
    // Get the last captured authorize endpoint data
    browser.storage.local.get(['lastAuthorizePageReplacement', 'lastAuthorizeFormData', 'lastAuthorizationFormChange', 'lastAuthorizeData']).then((result) => {
      const data = result.lastAuthorizePageReplacement || result.lastAuthorizeFormData || result.lastAuthorizationFormChange || result.lastAuthorizeData || null;
      sendResponse({ authorizeData: data });
    });
    return true;
  }


  else if (request.action === 'getDomainMap') {
    // Get the domain map
    browser.storage.local.get(['domainMap']).then((result) => {
      const map = result.domainMap || [];
      sendResponse({ domainMap: map });
    });
  }
  else if (request.action === 'addDomainMapping') {
    // Add a new mapping
    browser.storage.local.get(['domainMap']).then((result) => {
      const map = result.domainMap || [];
      // Remove existing mapping for this source if exists (upsert)
      const filteredMap = map.filter(m => m.source !== request.mapping.source);
      filteredMap.push(request.mapping);

      browser.storage.local.set({ domainMap: filteredMap }).then(() => {
        sendResponse({ success: true, domainMap: filteredMap });
      });
    });
  }
  else if (request.action === 'removeDomainMapping') {
    // Remove a mapping
    browser.storage.local.get(['domainMap']).then((result) => {
      const map = result.domainMap || [];
      const filteredMap = map.filter(m => m.source !== request.source);

      browser.storage.local.set({ domainMap: filteredMap }).then(() => {
        sendResponse({ success: true, domainMap: filteredMap });
      });
    });
  }
  else if (request.action === 'fillCredentials') {
    // Forward the request to the content script
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      browser.tabs.sendMessage(tabs[0].id, request).then((response) => {
        sendResponse(response);
      }).catch(error => {
        console.error('Error sending message to content script:', error);
        sendResponse({ success: false, error: error.message });
      });
    });
    return true; // Keep message channel open for async response
  }
  return true;
});