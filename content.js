// Content script to fill Efaas login forms and intercept OAuth callbacks
if (typeof browser === "undefined") {
  var browser = chrome;
}
(function () {

  // Flag to prevent multiple executions
  if (window.efaasExtensionProcessed) {
    return;
  }
  window.efaasExtensionProcessed = true;

  // Listen for messages from the background script
  browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fillCredentials') {
      fillLoginForm(request.credentials);
      sendResponse({ success: true });
    }
    return true; // Keep message channel open for async response
  });

  // Handle Interception Toggle State (Isolated World)
  function updateInterceptionState() {
    browser.storage.local.get(['interceptionDisabled']).then(result => {
      const disabled = result.interceptionDisabled;
      if (disabled) {
        document.documentElement.setAttribute('data-efaas-interception-disabled', 'true');
        console.log('Efaas Extension: Interception DISABLED');
      } else {
        document.documentElement.removeAttribute('data-efaas-interception-disabled');
        console.log('Efaas Extension: Interception ENABLED');
      }
    });
  }

  // Initial check
  updateInterceptionState();

  // Listen for changes
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.interceptionDisabled) {
      updateInterceptionState();
    }
  });

  // Function to fill login form fields
  function fillLoginForm(credentials) {
    // Attempt to find common login form fields
    const idFieldSelectors = [
      'input[name="username"]',
      'input[name="email"]',
      'input[name="id"]',
      'input[id*="username" i]',
      'input[id*="email" i]',
      'input[id*="id" i]',
      'input[placeholder*="username" i]',
      'input[placeholder*="email" i]',
      'input[placeholder*="ID" i]'
    ];

    const passwordFieldSelectors = [
      'input[type="password"][name*="password" i]',
      'input[type="password"][id*="password" i]',
      'input[type="password"][name*="pass" i]',
      'input[type="password"][id*="pass" i]',
      'input[type="password"][placeholder*="password" i]'
    ];

    // Find and fill ID field
    let idFieldFound = false;
    for (const selector of idFieldSelectors) {
      const field = document.querySelector(selector);
      if (field) {
        field.value = credentials.username || credentials.id;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        idFieldFound = true;
        break;
      }
    }

    // Find and fill password field
    let passwordFieldFound = false;
    for (const selector of passwordFieldSelectors) {
      const field = document.querySelector(selector);
      if (field) {
        field.value = credentials.password;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        passwordFieldFound = true;
        break;
      }
    }

    // Log success to console
    console.log(`Efaas autofill: ${idFieldFound ? 'ID field filled' : 'No ID field found'}, ${passwordFieldFound ? 'Password field filled' : 'No password field found'}`);
  }



  // Helper function to find OAuth authorize form
  function findOAuthAuthorizeForm() {
    // Look for forms immediately without waiting
    const forms = document.querySelectorAll('form');

    for (let form of forms) {
      // Look for common OAuth authorize form fields
      const responseTypeInput = form.querySelector('input[name="response_type"]');
      const clientIdInput = form.querySelector('input[name="client_id"]');
      const redirectUriInput = form.querySelector('input[name="redirect_uri"]');
      const scopeInput = form.querySelector('input[name="scope"]');
      const stateInput = form.querySelector('input[name="state"]');
      const nonceInput = form.querySelector('input[name="nonce"]');

      if (clientIdInput && (responseTypeInput || redirectUriInput)) {
        return form;
      }
    }

    return null;
  }

  // Helper function to extract form data
  function extractFormData(form) {
    const formData = {};
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
      if (input.name) {
        if (input.type === 'checkbox' || input.type === 'radio') {
          if (input.checked) {
            formData[input.name] = input.value;
          }
        } else {
          formData[input.name] = input.value;
        }
      }
    });

    return formData;
  }

  // Function to inject a script into the Main World to intercept form submissions
  function injectInterceptionScript() {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('interceptor.js');
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    console.log('Efaas Extension: Injected interceptor.js');
  }

  // Listen for the interception event from the Main World
  window.addEventListener('efaasOAuthIntercepted', async function (e) {
    const data = e.detail;
    console.log('Content Script: Received intercepted OAuth data', data);

    // DOUBLE CHECK storage to be absolutely sure
    const storageResult = await browser.storage.local.get(['interceptionDisabled']);
    if (storageResult.interceptionDisabled) {
      console.warn('Efaas Extension: Interception disabled (redundant check). Replaying original submission.');

      // Replay the submission to the original URL
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.originalAction;
      form.style.display = 'none';

      for (const [key, value] of Object.entries(data.formData)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }

      document.body.appendChild(form);
      form.submit();
      return;
    }

    // Get the domain map
    const result = await browser.storage.local.get(['domainMap']);
    const domainMap = result.domainMap || [];

    // Check if we have a mapping for the original action's domain
    let redirectUrl = null;

    // Parse the original action URL to find its hostname
    try {
      const originalUrlObj = new URL(data.originalAction);
      const originalHostname = originalUrlObj.hostname;

      console.log('Checking domain map for:', originalHostname);

      const mapping = domainMap.find(m => m.source === originalHostname);

      if (mapping) {
        console.log('Found mapping:', mapping);
        // Construct the new URL using the target domain from the map
        // We want to preserve the path from the original action if possible, 
        // or maybe the user wants to map to a specific full URL?
        // "portal-staging.example.com would submit the thing to localhost:3000"
        // Let's assume we replace the hostname but keep the path

        // However, the user might input "localhost:3000" or "localhost:3000/callback"
        // Let's handle both cases. If target has no path, append original path.

        let target = mapping.target;
        if (!target.startsWith('http')) {
          // Heuristic: If it looks like localhost, use http, else https? 
          // Or just default to http for "test" domains as per typical dev workflows?
          // Safest is to inherit protocol or default to http for .test/.localhost
          const isLocal = target.includes('localhost') || target.endsWith('.test') || target.endsWith('.local');
          target = (isLocal ? 'http://' : 'https://') + target;
        }

        const targetUrlObj = new URL(target);

        // If the target config has a path, use it. If it's just a root domain, append original path.
        if (targetUrlObj.pathname === '/' && !mapping.target.endsWith('/')) {
          targetUrlObj.pathname = originalUrlObj.pathname;
        }

        // Also preserve query params? Original action might have them.
        // The form data is POST, so query params on action might be important.
        // Let's assume we copy them over.
        originalUrlObj.searchParams.forEach((value, key) => {
          targetUrlObj.searchParams.append(key, value);
        });

        redirectUrl = targetUrlObj.toString();
      }
    } catch (e) {
      console.error('Error parsing original action URL:', e);
    }

    if (!redirectUrl) {
      console.log('No matching domain mapping found. Cannot redirect.');
      alert('Efaas Extension: OAuth intercepted but no "Domain Mapping" found for this source domain!');
      return;
    }

    console.log('Redirecting submission to:', redirectUrl);

    // Submit to local domain
    // We create a NEW form in the content script context (Isolated World) 
    // to avoid our own Main World interceptor (though it shouldn't trigger it anyway).
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = redirectUrl;
    form.style.display = 'none';

    for (const [key, value] of Object.entries(data.formData)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    // Add original action for reference
    const origInput = document.createElement('input');
    origInput.type = 'hidden';
    origInput.name = 'original_action';
    origInput.value = data.originalAction;
    form.appendChild(origInput);

    document.body.appendChild(form);

    // Submit this new form. 
    // Since this is in the content script's Isolated World, it uses the native submit,
    // NOT the overridden one in the Main World.
    HTMLFormElement.prototype.submit.call(form);
  });

  // Inject immediately
  injectInterceptionScript();

  // Function to submit form data to the configured local domain
  async function submitFormDataToLocalDomain(payload, localDomain) {
    // Ensure the redirect domain is a complete URL
    let submissionUrl = localDomain;
    if (!submissionUrl.startsWith('http://') && !submissionUrl.startsWith('https://')) {
      // Check if it contains the path component, otherwise default to https
      if (submissionUrl.includes('/')) {
        // Contains path, assume http
        submissionUrl = 'http://' + submissionUrl;
      } else {
        // Just a domain, assume https
        submissionUrl = 'https://' + submissionUrl;
      }
    }

    try {
      console.log(`Submitting extracted data to: ${submissionUrl}`, payload);

      const response = await fetch(submissionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log('Data successfully sent to local domain');

        // Trigger a notification to the extension popup
        browser.runtime.sendMessage({
          action: 'authorizeDataSent',
          data: payload
        }).catch(error => {
          console.log('No listener for authorizeDataSent');
        });
      } else {
        console.error('Failed to send data to local domain:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error submitting data to local domain:', error);
    }
  }



  // Function to submit form data to the configured local domain via fetch
  async function submitFormDataToCustomDomain(data, redirectUrl) {
    try {
      // Prepare the form data as URL-encoded string to match the original form submission
      const formData = data.extracted_form_data;
      const params = new URLSearchParams();

      // Add each key-value pair to the URLSearchParams object
      for (const [key, value] of Object.entries(formData)) {
        if (Array.isArray(value)) {
          // Handle multiple values for the same field (like checkboxes)
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }

      // Add special fields to preserve original context
      params.append('original_url', data.original_url);
      params.append('original_action', data.original_action || '');
      params.append('page_type', data.page_type);

      console.log(`Submitting form data to: ${redirectUrl}`, formData);

      const response = await fetch(redirectUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
      });

      if (response.ok) {
        console.log('Form data successfully sent to local domain');

        // Optionally show a notification
        browser.runtime.sendMessage({
          action: 'formDataSentSuccessfully',
          url: redirectUrl
        }).catch(error => {
          console.log('No listener for formDataSentSuccessfully');
        });
      } else {
        console.error('Failed to send form data to local domain:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error submitting form data to local domain:', error);
    }
  }

  // Initialize when DOM is ready
  // Logic is now triggered immediately by injectInterceptionScript() above
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Any additional init if needed
    });
  }
})();