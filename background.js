// Background script to handle popup and content script communication

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

// Add browser action to allow clicking the extension icon for quick fill
browser.browserAction.onClicked.addListener((tab) => {
  // Check if the current tab is on an allowed domain
  const allowedDomains = ['developer.gov.mv', 'developer.egov.mv'];
  const tabUrl = new URL(tab.url);
  const isAllowedDomain = allowedDomains.some(domain => tabUrl.hostname === domain || tabUrl.hostname.endsWith('.' + domain));

  if (isAllowedDomain && tabUrl.pathname.startsWith('/efaas')) {
    // Check if this is an OAuth callback page
    browser.tabs.executeScript(tab.id, {
      code: `
        (${function checkForOAuthForm() {
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
        }.toString()})();
      `
    }).then((results) => {
      if (results && results[0]) {
        console.log('Detected OAuth callback page');
        // We already have the content script handling this, so just log it
      } else {
        // Regular page, fill with default account
        browser.runtime.sendMessage({ action: 'getDefaultAccount' }).then(response => {
          if (response.account) {
            // Send credentials to content script to fill the form
            browser.tabs.sendMessage(tab.id, {
              action: 'fillCredentials',
              credentials: response.account
            });
          } else if (response.error) {
            console.error('Error getting default account:', response.error);
            // Verify if we can show a notification or popup to warn user no data is loaded
            browser.notifications.create({
              type: 'basic',
              iconUrl: 'icon.png',
              title: 'No Account Data',
              message: 'Please click the extension icon and upload a CSV file to use this feature.'
            });
          }
        }).catch(console.error);
      }
    }).catch(console.error);
  } else {
    // Not on an allowed domain, show an informative message in console
    console.log('Extension not active on this domain. Only works on Efaas domains (developer.gov.mv/efaas or developer.egov.mv/efaas).');
    // Open the popup so the user can see available options
    browser.browserAction.openPopup && browser.browserAction.openPopup();
  }
});



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
  // Handle existing message types...
  else if (request.action === 'getAccountTypes') {
    // Return the available account types
    const accountTypes = Object.keys(testAccounts);
    sendResponse({ accountTypes: accountTypes });
  }
  else if (request.action === 'getAccountsByType') {
    // Return accounts for a specific type
    const accounts = testAccounts[request.userType] || [];
    sendResponse({ accounts: accounts });
  }
  else if (request.action === 'getRandomAccount') {
    // Return a random account from any type
    const randomAccount = getRandomAccount();
    sendResponse({ account: randomAccount.account, userType: randomAccount.userType });
  }
  else if (request.action === 'getDefaultAccount') {
    // Return the default account
    const defaultAccount = getAccountByUsername(DEFAULT_ACCOUNT_CONFIG.username);
    if (defaultAccount) {
      sendResponse({ account: defaultAccount.account, userType: defaultAccount.userType });
    } else {
      // If default account not found, return the first account of the default type
      const accounts = testAccounts[DEFAULT_ACCOUNT_CONFIG.userType] || [];
      if (accounts.length > 0) {
        sendResponse({ account: accounts[0], userType: DEFAULT_ACCOUNT_CONFIG.userType });
      } else {
        sendResponse({ error: "No accounts available for the default user type" });
      }
    }
  }
  else if (request.action === 'getUserPreference') {
    // Get user's saved preference
    browser.storage.local.get(['preferredAccount']).then((result) => {
      if (result.preferredAccount) {
        sendResponse({ preferredAccount: result.preferredAccount });
      } else {
        // If no preference set, return null
        sendResponse({ preferredAccount: null });
      }
    });
  }
  else if (request.action === 'saveUserPreference') {
    // Save user's preferred account
    browser.storage.local.set({ preferredAccount: request.account }).then(() => {
      sendResponse({ success: true });
    });
  }
  else if (request.action === 'getLastOAuthCallback') {
    // Get the last captured OAuth callback data
    browser.storage.local.get(['lastOAuthCallback', 'oauthCallbackData']).then((result) => {
      const data = result.lastOAuthCallback || result.oauthCallbackData || null;
      sendResponse({ oauthData: data });
    });
  }
  else if (request.action === 'getLastAuthorizeData') {
    // Get the last captured authorize endpoint data (both from content script and web request)
    browser.storage.local.get(['lastAuthorizePageReplacement', 'lastAuthorizeFormData', 'lastAuthorizationFormChange', 'lastAuthorizeData', 'authorizeData', 'lastAuthorizeRequest']).then((result) => {
      // Prioritize the most recent data: page replacement > form extraction > form change > other data
      const data = result.lastAuthorizePageReplacement || result.lastAuthorizeFormData || result.lastAuthorizationFormChange || result.lastAuthorizeData || result.authorizeData || result.lastAuthorizeRequest || null;
      sendResponse({ authorizeData: data });
    });
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