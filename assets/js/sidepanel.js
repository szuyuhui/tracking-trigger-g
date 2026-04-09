let currentTabId = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    currentTabId = tab.id;
    await renderFullState();
  }
}

chrome.tabs.onActivated.addListener(activeInfo => {
  currentTabId = activeInfo.tabId;
  renderFullState();
});

// Update data if navigation happens in the tab and changes logs
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'NEW_LOG' && message.tabId === currentTabId) {
    appendLog(message.logEntry);
  }
});

async function renderFullState() {
  if (!currentTabId) return;
  const data = await chrome.storage.local.get(currentTabId.toString());
  const tabData = data[currentTabId] || { logs: [] };
  
  const container = document.getElementById('log-container');
  const emptyState = document.getElementById('empty-state');
  
  container.innerHTML = '';
  if (tabData.logs.length === 0) {
    emptyState.classList.add('visible');
  } else {
    emptyState.classList.remove('visible');
    tabData.logs.forEach(log => appendLog(log));
  }
}

function appendLog(log) {
  const container = document.getElementById('log-container');
  const emptyState = document.getElementById('empty-state');
  emptyState.classList.remove('visible');

  let logContent = container.querySelector('.log-content');
  if (!logContent) {
    logContent = document.createElement('div');
    logContent.className = 'log-content';
    container.appendChild(logContent);
  }

  const row = document.createElement('div');

  if (log.type === 'navigation') {
    row.className = 'nav-row';
    row.textContent = `Navigated to ${log.url}`;
  } else {
    row.className = 'log-row';

    // Tag Pill
    const tagPill = document.createElement('div');
    tagPill.className = `tag-pill`;
    if (log.type === 'gtm-false') {
       tagPill.textContent = 'GTM-false';
    } else {
       tagPill.textContent = log.tagType;
    }
    
    // Apply category color based on keywords
    const categoryClass = getEventCategoryClass(tagPill.textContent);
    tagPill.classList.add(categoryClass);
    
    tagPill.title = tagPill.textContent;
    row.appendChild(tagPill);

    // Platform
    const platformDiv = document.createElement('div');
    platformDiv.className = 'platform';
    const initial = (log.platform || '?').charAt(0);
    platformDiv.innerHTML = `<span class="platform-icon">${initial}</span> ${log.platform}`;
    row.appendChild(platformDiv);

    // Parameters
    const paramDiv = document.createElement('div');
    paramDiv.className = 'parameter';
    
    let paramText = '';
    if (log.type === 'gtm-false') {
      paramText = 'GTM-false';
    } else if (log.parameters) {
      if (log.platform === 'Google Tag Manager') {
         paramText = log.parameters.id || '';
      } else if (log.platform === 'GA4' || log.platform === 'Google Ads') {
         paramText = `${log.parameters.tid}`; // Primarily display TID
      } else if (log.platform === 'Meta Pixel') {
         paramText = `${log.parameters.id}`; // Primarily display ID
      } else if (log.platform === 'MF') {
         paramText = `${log.parameters.sid}`; // Primarily display SID
      } else if (log.platform === 'Taboola') {
         paramText = `${log.parameters.id}`; // Primarily display ID
      } else if (log.platform === 'Dcard') {
         paramText = `${log.parameters.pixel}`; // Primarily display pixel ID
      } else if (log.platform === 'Line') {
         paramText = `${log.parameters.t_id}`; // Primarily display t_id
      }
    }
    paramDiv.textContent = paramText;
    paramDiv.title = paramText;
    row.appendChild(paramDiv);

    // Timestamp
    const tsDiv = document.createElement('div');
    tsDiv.className = 'timestamp';
    const dateObj = new Date(log.timestamp);
    tsDiv.textContent = dateObj.toLocaleString('zh-TW', { hour12: true });
    row.appendChild(tsDiv);
  }

  logContent.appendChild(row);
  container.scrollTop = container.scrollHeight;
}

document.getElementById('clear-btn').addEventListener('click', async () => {
   if (!currentTabId) return;
   const data = await chrome.storage.local.get(currentTabId.toString());
   const tabData = data[currentTabId] || { logs: [], currentLoadGtmFound: false };
   tabData.logs = [];
   await chrome.storage.local.set({ [currentTabId.toString()]: tabData });
   renderFullState();
});

/**
 * Determines the CSS class for the event tag based on keywords.
 * Case-insensitive matching.
 */
function getEventCategoryClass(eventName) {
  if (!eventName) return 'category-default';
  
  const name = eventName.toLowerCase();
  
  // 1. Initialization: GTM Init or config
  if (name.includes('gtm init') || name.includes('config')) {
    return 'category-init';
  }
  
  // 2. Page View: page_view or PageView (exactly, case-insensitive)
  if (name === 'page_view' || name === 'pageview') {
    return 'category-pageview';
  }
  
  // 3. Conversion: Submit or purchase
  if (name.includes('submit') || name.includes('purchase')) {
    return 'category-conversion';
  }
  
  // 4. Custom/Interaction: Event, view or click
  if (name.includes('event') || name.includes('view') || name.includes('click')) {
    return 'category-interaction';
  }
  
  // Default gray
  return 'category-default';
}

init();
