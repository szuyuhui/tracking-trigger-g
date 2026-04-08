const initializeTabIfEmpty = async (tabId) => {
  const result = await chrome.storage.local.get(tabId.toString());
  if (!result[tabId]) {
    await chrome.storage.local.set({
      [tabId]: { logs: [], currentLoadGtmFound: false }
    });
  }
};

const getTabData = async (tabId) => {
  const result = await chrome.storage.local.get(tabId.toString());
  return result[tabId] || { logs: [], currentLoadGtmFound: false };
};

const saveTabData = async (tabId, data) => {
  await chrome.storage.local.set({ [tabId]: data });
};

const broadcast = (message) => {
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore errors when side panel is closed
  });
};

const addLog = async (tabId, logEntry, isGtmTracker = false) => {
  const data = await getTabData(tabId);
  data.logs.push(logEntry);
  if (isGtmTracker) {
    data.currentLoadGtmFound = true;
  }
  await saveTabData(tabId, data);
  broadcast({ type: 'NEW_LOG', tabId, logEntry });
};

// Listeners
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId === 0) { // Main frame only
    const tabId = details.tabId;
    const data = await getTabData(tabId);
    
    // Reset GTM found for new navigation
    data.currentLoadGtmFound = false;
    
    const navLog = {
      id: crypto.randomUUID(),
      type: 'navigation',
      url: details.url,
      timestamp: Date.now()
    };
    
    data.logs.push(navLog);
    await saveTabData(tabId, data);
    broadcast({ type: 'NEW_LOG', tabId, logEntry: navLog });
  }
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) { // Main frame only
    const tabId = details.tabId;
    const data = await getTabData(tabId);
    
    if (!data.currentLoadGtmFound) {
      const falseLog = {
        id: crypto.randomUUID(),
        type: 'gtm-false',
        platform: 'Google Tag Manager',
        tagType: 'GTM State',
        timestamp: Date.now(),
        parameters: { id: 'GTM-false' }
      };
      
      data.logs.push(falseLog);
      await saveTabData(tabId, data);
      broadcast({ type: 'NEW_LOG', tabId, logEntry: falseLog });
    }
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;
    const tabId = details.tabId;
    if (tabId === -1) return; // Skip background requests not linked to a tab

    try {
      const urlObj = new URL(url);
      const searchParams = urlObj.searchParams;
      
      let platform = '';
      let tagType = '';
      let params = {};
      let isGtm = false;

      // a. GTM
      if (url.includes('gtm.js') && searchParams.has('id')) {
        platform = 'Google Tag Manager';
        tagType = 'GTM Init'; // Display GTM Init in the tag pill
        params.id = searchParams.get('id');
        isGtm = true;
      }
      // b. GA4
      else if (url.includes('collect') && searchParams.get('v') === '2') {
        platform = 'GA4';
        tagType = searchParams.get('en') || 'Page View';
        params.tid = searchParams.get('tid') || '-';
        params.en = searchParams.get('en') || '-';
      }
      // c. Google Ads
      else if (url.includes('collect') && searchParams.has('frm')) {
        platform = 'Google Ads';
        tagType = searchParams.get('en') || 'Ads Event';
        params.tid = searchParams.get('tid') || '-';
        params.en = searchParams.get('en') || '-';
      }
      // d. Meta Pixel
      else if (url.includes('tr/') && searchParams.has('id')) {
        platform = 'Meta Pixel';
        tagType = searchParams.get('ev') || 'Pixel Event';
        params.id = searchParams.get('id');
        params.ev = searchParams.get('ev') || '-';
      }
      // e. MF
      else if (url.includes('cft')) {
        platform = 'MF';
        tagType = searchParams.get('en') || 'MF Event';
        params.sid = searchParams.get('sid') || '-';
        params.en = searchParams.get('en') || '-';
      }
      // f. Taboola
      else if (url.includes('unip?')) {
        platform = 'Taboola';
        tagType = searchParams.get('en') || 'Taboola Event';
        params.id = searchParams.get('id') || '-';
        params.en = searchParams.get('en') || '-';
      }
      // g. Dcard
      else if (url.includes('track?')) {
        platform = 'Dcard';
        tagType = searchParams.get('type') || 'Dcard Event';
        params.pixel = searchParams.get('pixel') || '-';
        params.type = searchParams.get('type') || '-';
      }

      if (platform) {
        const logEntry = {
          id: crypto.randomUUID(),
          type: 'tracker',
          platform,
          tagType,
          timestamp: Date.now(),
          parameters: params
        };
        addLog(tabId, logEntry, isGtm);
      }

    } catch (e) {
      // url parse error
    }
  },
  { urls: ["<all_urls>"] }
);

// Disable side panel globally first
chrome.sidePanel.setOptions({ enabled: false });

chrome.action.onClicked.addListener((tab) => {
  // Enable the side panel strictly for the tab user clicked the icon on
  chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: 'sidepanel.html',
    enabled: true
  });
  // Programmatically open it for the current window and tab
  chrome.sidePanel.open({ tabId: tab.id, windowId: tab.windowId });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(tabId.toString());
});
