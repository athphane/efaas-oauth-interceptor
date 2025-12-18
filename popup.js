if (typeof browser === "undefined") {
  var browser = chrome;
}
document.addEventListener('DOMContentLoaded', function () {

  const userTypeSelect = document.getElementById('user-type');
  const accountSelect = document.getElementById('account-select');
  const fillButton = document.getElementById('fill-credentials');
  const setDefaultButton = document.getElementById('set-default');
  const randomAccountButton = document.getElementById('random-account');
  const fillDefaultButton = document.getElementById('fill-default');
  const viewOAuthButton = document.getElementById('view-oauth');
  const viewAuthorizeButton = document.getElementById('view-authorize');
  const closeBtn = document.getElementById('close-btn');
  const interceptionToggle = document.getElementById('interception-toggle');



  // Disable these initially until we verify we are on a valid page
  randomAccountButton.disabled = true;
  fillDefaultButton.disabled = true;

  // Check if we are on a valid Efaas login page
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs && tabs[0]) {
      const url = new URL(tabs[0].url);
      const hostname = url.hostname;
      const pathname = url.pathname;

      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
      const isEfaasDomain = (hostname === 'developer.gov.mv' || hostname === 'developer.egov.mv') && pathname.startsWith('/efaas');

      if (isLocalhost || isEfaasDomain) {
        randomAccountButton.disabled = false;
        fillDefaultButton.disabled = false;
      } else {
        // Optional: Update UI to indicate why buttons are disabled
        randomAccountButton.title = "Only available on Efaas login pages";
        fillDefaultButton.title = "Only available on Efaas login pages";
      }
    }
  }).catch(err => {
    console.error('Error querying tabs:', err);
  });

  // Load account types when popup opens
  browser.runtime.sendMessage({ action: 'getAccountTypes' })
    .then(response => {
      if (response.accountTypes) {
        // Clear existing options except the first one
        userTypeSelect.innerHTML = '<option value="">Select Type...</option>';

        response.accountTypes.forEach(type => {
          const option = document.createElement('option');
          option.value = type;
          option.textContent = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
          userTypeSelect.appendChild(option);
        });
      }
    })
    .catch(error => {
      console.error('Error getting account types:', error);
    });

  // When user selects a user type, populate accounts
  userTypeSelect.addEventListener('change', function () {
    const selectedType = this.value;
    accountSelect.innerHTML = '<option value="">-- Select Account --</option>';

    if (selectedType) {
      browser.runtime.sendMessage({ action: 'getAccountsByType', userType: selectedType })
        .then(response => {
          if (response.accounts && response.accounts.length > 0) {
            response.accounts.forEach(account => {
              const option = document.createElement('option');
              option.value = JSON.stringify(account);
              option.textContent = `${account.description} (${account.username})`;
              accountSelect.appendChild(option);
            });
            accountSelect.disabled = false;
          } else {
            accountSelect.disabled = true;
          }
        })
        .catch(error => {
          console.error('Error getting accounts:', error);
          accountSelect.disabled = true;
        });
    } else {
      accountSelect.disabled = true;
    }

    fillButton.disabled = true;
    setDefaultButton.disabled = true;
  });

  // When user selects an account, enable fill and set default buttons
  accountSelect.addEventListener('change', function () {
    fillButton.disabled = !this.value;
    setDefaultButton.disabled = !this.value;
  });

  // Fill credentials when button is clicked
  fillButton.addEventListener('click', function () {
    const selectedAccount = JSON.parse(accountSelect.value);

    browser.runtime.sendMessage({
      action: 'fillCredentials',
      credentials: selectedAccount
    })
      .then(response => {
        if (response.success) {
          // Close popup after successful fill
          window.close();
        } else {
          alert('Error filling credentials: ' + (response.error || 'Unknown error'));
        }
      })
      .catch(error => {
        console.error('Error sending fill credentials message:', error);
        if (error.message && error.message.includes('Could not establish connection')) {
          alert('Error: Could not connect to the page. Make sure you are on a supported Efaas domain or localhost.');
        } else {
          alert('Error filling credentials: ' + error.message);
        }
      });
  });

  // Set selected account as default
  setDefaultButton.addEventListener('click', function () {
    const selectedAccount = JSON.parse(accountSelect.value);

    // Save as user preference
    browser.runtime.sendMessage({
      action: 'saveUserPreference',
      account: selectedAccount
    })
      .then(response => {
        if (response.success) {
          alert('Account set as default preference');
        } else {
          alert('Error saving preference');
        }
      })
      .catch(error => {
        console.error('Error saving preference:', error);
        alert('Error saving preference: ' + error.message);
      });
  });

  // Fill with random account
  randomAccountButton.addEventListener('click', function () {
    browser.runtime.sendMessage({ action: 'getRandomAccount' })
      .then(response => {
        if (response.account) {
          browser.runtime.sendMessage({
            action: 'fillCredentials',
            credentials: response.account
          })
            .then(fillResponse => {
              if (fillResponse.success) {
                window.close();
              } else {
                alert('Error filling credentials: ' + (fillResponse.error || 'Unknown error'));
              }
            })
            .catch(error => {
              console.error('Error filling random account:', error);
              alert('Error filling random account: ' + error.message);
            });
        } else {
          alert('Error getting random account');
        }
      })
      .catch(error => {
        console.error('Error getting random account:', error);
        alert('Error getting random account: ' + error.message);
      });
  });

  // Fill with default account
  fillDefaultButton.addEventListener('click', function () {
    // First try to get the user's preferred account
    browser.runtime.sendMessage({ action: 'getUserPreference' })
      .then(response => {
        let accountPromise;

        if (response.preferredAccount) {
          // Use user's preferred account
          accountPromise = Promise.resolve(response.preferredAccount);
        } else {
          // Use the extension's default account
          accountPromise = browser.runtime.sendMessage({ action: 'getDefaultAccount' })
            .then(defaultResponse => {
              if (defaultResponse.account) {
                return defaultResponse.account;
              } else {
                throw new Error(defaultResponse.error || 'No default account available');
              }
            });
        }

        return accountPromise;
      })
      .then(account => {
        return browser.runtime.sendMessage({
          action: 'fillCredentials',
          credentials: account
        });
      })
      .then(response => {
        if (response.success) {
          window.close();
        } else {
          alert('Error filling credentials: ' + (response.error || 'Unknown error'));
        }
      })
      .catch(error => {
        console.error('Error filling default account:', error);
        if (error.message && error.message.includes('Could not establish connection')) {
          alert('Error: Could not connect to the page. Make sure you are on a supported Efaas domain or localhost.');
        } else {
          alert('Error filling default account: ' + error.message);
        }
      });
  });

  // View last OAuth callback data
  viewOAuthButton.addEventListener('click', function () {
    browser.runtime.sendMessage({ action: 'getLastOAuthCallback' })
      .then(response => {
        if (response.oauthData) {
          // Create a more user-friendly display of the OAuth data
          let displayData = "Last OAuth Callback Data:\n\n";
          displayData += `Code: ${response.oauthData.code ? response.oauthData.code.substring(0, 10) + '...' : 'N/A'}\n`;
          displayData += `ID Token: ${response.oauthData.id_token ? response.oauthData.id_token.substring(0, 20) + '...' : 'N/A'}\n`;
          displayData += `State: ${response.oauthData.state || 'N/A'}\n`;
          displayData += `Scope: ${response.oauthData.scope || 'N/A'}\n`;
          displayData += `Session State: ${response.oauthData.session_state || 'N/A'}\n`;
          displayData += `Timestamp: ${new Date(response.oauthData.timestamp).toLocaleString()}\n\n`;
          displayData += "Full data has been copied to clipboard.";

          alert(displayData);

          // Copy the full data to clipboard for easy access
          const fullData = JSON.stringify(response.oauthData, null, 2);
          navigator.clipboard.writeText(fullData).then(() => {
            console.log('OAuth data copied to clipboard');
          }).catch(err => {
            console.error('Failed to copy OAuth data to clipboard:', err);
            // Fallback: show in an alert if clipboard doesn't work
            alert("Full data:\n\n" + fullData);
          });
        } else {
          alert('No OAuth callback data captured yet.');
        }
      })
      .catch(error => {
        console.error('Error getting OAuth callback data:', error);
        alert('Error getting OAuth callback data: ' + error.message);
      });
  });

  // View last authorize endpoint data
  viewAuthorizeButton.addEventListener('click', function () {
    browser.runtime.sendMessage({ action: 'getLastAuthorizeData' })
      .then(response => {
        if (response.authorizeData) {
          // Create a more user-friendly display of the authorize data
          let displayData = "Last /authorize Endpoint Data:\n\n";
          displayData += `Page Type: ${response.authorizeData.page_type || 'N/A'}\n`;
          displayData += `Original URL: ${response.authorizeData.original_url || 'N/A'}\n`;
          displayData += `Timestamp: ${new Date(response.authorizeData.timestamp).toLocaleString()}\n\n`;
          displayData += "Extracted Form Data:\n";
          for (const [key, value] of Object.entries(response.authorizeData.extracted_data)) {
            displayData += `${key}: ${typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value}\n`;
          }
          displayData += "\nFull data has been copied to clipboard.";

          alert(displayData);

          // Copy the full data to clipboard for easy access
          const fullData = JSON.stringify(response.authorizeData, null, 2);
          navigator.clipboard.writeText(fullData).then(() => {
            console.log('/authorize data copied to clipboard');
          }).catch(err => {
            console.error('Failed to copy /authorize data to clipboard:', err);
            // Fallback: show in an alert if clipboard doesn't work
            alert("Full data:\n\n" + fullData);
          });
        } else {
          alert('No /authorize endpoint data captured yet.');
        }
      })
      .catch(error => {
        console.error('Error getting /authorize endpoint data:', error);
        alert('Error getting /authorize endpoint data: ' + error.message);
      });
  });



  // Domain Map Elements
  const domainMapTbody = document.getElementById('domain-map-tbody');
  const mapSourceInput = document.getElementById('map-source');
  const mapTargetInput = document.getElementById('map-target');
  const addMappingBtn = document.getElementById('add-mapping-btn');

  function loadDomainMap() {
    browser.runtime.sendMessage({ action: 'getDomainMap' })
      .then(response => {
        const map = response.domainMap || [];
        renderDomainMap(map);
      })
      .catch(error => {
        console.error('Error loading domain map:', error);
      });
  }

  function renderDomainMap(map) {
    domainMapTbody.innerHTML = '';

    if (map.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="3" style="text-align:center; color:#999; padding:10px;">No mappings configured</td>';
      domainMapTbody.appendChild(row);
      return;
    }

    map.forEach(mapping => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid #eee';

      const sourceCell = document.createElement('td');
      sourceCell.style.padding = '5px';
      sourceCell.textContent = mapping.source;

      const targetCell = document.createElement('td');
      targetCell.style.padding = '5px';
      targetCell.textContent = mapping.target;

      const actionCell = document.createElement('td');
      actionCell.style.padding = '5px';
      actionCell.style.textAlign = 'right';

      const removeBtn = document.createElement('button');
      removeBtn.innerHTML = '&times;';
      removeBtn.style.color = 'red';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.border = 'none';
      removeBtn.style.background = 'transparent';
      removeBtn.style.fontWeight = 'bold';
      removeBtn.title = 'Remove';

      removeBtn.onclick = function () {
        browser.runtime.sendMessage({ action: 'removeDomainMapping', source: mapping.source })
          .then(response => {
            loadDomainMap();
          });
      };

      actionCell.appendChild(removeBtn);

      row.appendChild(sourceCell);
      row.appendChild(targetCell);
      row.appendChild(actionCell);

      domainMapTbody.appendChild(row);
    });
  }

  addMappingBtn.addEventListener('click', function () {
    const source = mapSourceInput.value.trim();
    const target = mapTargetInput.value.trim();

    if (!source || !target) {
      alert('Please provide both Source and Target domains.');
      return;
    }

    browser.runtime.sendMessage({
      action: 'addDomainMapping',
      mapping: { source, target }
    }).then(response => {
      mapSourceInput.value = '';
      mapTargetInput.value = '';
      loadDomainMap();
    }).catch(error => {
      alert('Error adding mapping: ' + error.message);
    });
  });

  // Initial Load
  loadDomainMap();

  // Close button closes popup
  closeBtn.addEventListener('click', function () {
    window.close();
  });

  // Interception Toggle Logic
  if (interceptionToggle) {
    // Load initial state (default is enabled, so disabled=false)
    browser.storage.local.get(['interceptionDisabled']).then(result => {
      // If interceptionDisabled is true, checkbox should be UNCHECKED
      // If interceptionDisabled is false/undefined, checkbox should be CHECKED
      interceptionToggle.checked = !result.interceptionDisabled;
    }).catch(error => {
      console.error('Error loading interception state:', error);
    });

    interceptionToggle.addEventListener('change', function () {
      const disabled = !this.checked;
      browser.storage.local.set({ interceptionDisabled: disabled }).then(() => {
        console.log('Interception disabled:', disabled);
      }).catch(error => {
        console.error('Error saving interception state:', error);
      });
    });
  }
  // CSV Data Management
  const csvUpload = document.getElementById('csv-upload');
  const clearDataBtn = document.getElementById('clear-data-btn');
  const dataStatusMsg = document.getElementById('data-status-msg');

  // CSV Parsing Logic (Copied from background.js and adapted)
  function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return []; // Need at least header and one row

    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, '').replace(/'/g, ''));
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const row = parseCSVRow(lines[i]);
      const record = {};

      for (let j = 0; j < headers.length; j++) {
        // Map header to value, handling potential index out of bounds
        record[headers[j]] = row[j] || '';
      }
      records.push(record);
    }
    return records;
  }

  function parseCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  function transformRecordToAccount(record) {
    // Determine user type and format accordingly
    // Default to 'maldivian' if not specified, or normalize
    let userTypeRaw = record['User Type'] || 'Maldivian';
    let userType = 'maldivian'; // default key

    if (userTypeRaw.toLowerCase().includes('foreigner')) userType = 'foreigner';
    else if (userTypeRaw.toLowerCase().includes('work permit')) userType = 'work-permit';

    const account = {
      id: record['#'] || Date.now().toString(),
      username: record.Username || '',
      password: record.Password || '',
      description: ''
    };

    if (userType === 'work-permit') {
      account.description = `Verif: ${record['Verification Level'] || '-'} | Passport: ${record['Passport Number'] || '-'}`;
    } else {
      account.description = `${record['User State'] || 'Unknown'} (Verif: ${record['Verification Level'] || '-'})`;
    }

    return { userType, account };
  }

  function updateDataStatus() {
    browser.storage.local.get(['accountUserDB']).then(result => {
      const db = result.accountUserDB;
      if (!db || Object.keys(db).length === 0) {
        dataStatusMsg.textContent = "No data loaded. Please upload a CSV file.";
        dataStatusMsg.style.color = "var(--text-secondary)";
      } else {
        const summary = Object.keys(db).map(type => {
          const count = db[type].length;
          // Format type name nicely
          const typeName = type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
          return `${count} ${typeName}`;
        }).join(', ');
        dataStatusMsg.textContent = `Loaded: ${summary}`;
        dataStatusMsg.style.color = "var(--success-color)";
      }
    }).catch(err => {
      dataStatusMsg.textContent = "Error checking data status.";
    });
  }

  // Handle File Upload
  csvUpload.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    dataStatusMsg.textContent = "Processing file...";
    dataStatusMsg.style.color = "var(--info-color)";

    const reader = new FileReader();
    reader.onload = function (event) {
      const csvText = event.target.result;
      try {
        console.log("CSV content loaded, length:", csvText.length);
        const records = parseCSV(csvText);
        console.log("Parsed records:", records.length);

        if (records.length === 0) {
          dataStatusMsg.textContent = "Error: No records found in CSV.";
          dataStatusMsg.style.color = "var(--danger-color)";
          return;
        }

        // Fetch existing DB to merge or create new
        const storageAPI = (typeof browser !== 'undefined' ? browser : chrome);
        storageAPI.storage.local.get(['accountUserDB']).then(result => {
          const db = result.accountUserDB || { maldivian: [], foreigner: [], 'work-permit': [] };

          let addedCount = 0;
          records.forEach(record => {
            if (!record.Username) return; // Skip invalid records

            const { userType, account } = transformRecordToAccount(record);

            // Initialize array if missing
            if (!db[userType]) db[userType] = [];

            const existingIndex = db[userType].findIndex(a => a.username === account.username);
            if (existingIndex >= 0) {
              db[userType][existingIndex] = account; // Update
            } else {
              db[userType].push(account); // Add
              addedCount++;
            }
          });

          console.log("Saving to storage, added/updated:", addedCount);

          storageAPI.storage.local.set({ accountUserDB: db }).then(() => {
            updateDataStatus();
            dataStatusMsg.textContent = `Success: Processed ${records.length} records.`;
            dataStatusMsg.style.color = "var(--success-color)";

            // Clear input so change event fires again for same file
            csvUpload.value = '';

            // Refresh account list if a type is selected
            if (userTypeSelect.value) {
              const event = new Event('change');
              userTypeSelect.dispatchEvent(event);
            }

            // Clear success message after 3 seconds
            setTimeout(() => {
              updateDataStatus();
            }, 3000);
          });
        });

      } catch (err) {
        console.error('Error parsing CSV:', err);
        dataStatusMsg.textContent = "Error parsing CSV: " + err.message;
        dataStatusMsg.style.color = "var(--danger-color)";
      }
    };

    reader.onerror = function () {
      dataStatusMsg.textContent = "Error reading file.";
      dataStatusMsg.style.color = "var(--danger-color)";
    }

    reader.readAsText(file);
  });

  // Handle Clear Data
  clearDataBtn.addEventListener('click', function () {
    if (confirm('Are you sure you want to clear all stored account data?')) {
      browser.storage.local.remove(['accountUserDB']).then(() => {
        updateDataStatus();
        alert('All account data cleared.');
        // Refresh lists
        accountSelect.innerHTML = '<option value="">-- Select Account --</option>';
        accountSelect.disabled = true;
      });
    }
  });

  // Handle Open in New Tab
  const openTabBtn = document.getElementById('open-tab-btn');
  if (openTabBtn) {
    openTabBtn.addEventListener('click', function () {
      const storageAPI = (typeof browser !== 'undefined' ? browser : chrome);
      storageAPI.tabs.create({ url: 'popup.html' });
      window.close();
    });
  }

  // Initial Status Check
  updateDataStatus();

});