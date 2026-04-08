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
       tagPill.classList.add('tag-GTM-false');
       tagPill.textContent = 'GTM-false';
    } else if (log.platform === 'Google Tag Manager') {
       tagPill.classList.add('tag-GTM');
       tagPill.textContent = log.tagType;
    } else if (log.platform === 'GA4') {
       tagPill.classList.add('tag-GA4');
       tagPill.textContent = log.tagType;
    } else if (log.platform === 'Google Ads') {
       tagPill.classList.add('tag-Ads');
       tagPill.textContent = log.tagType;
    } else if (log.platform === 'Meta Pixel') {
       tagPill.classList.add('tag-Pixel');
       tagPill.textContent = log.tagType;
    }
    tagPill.title = log.tagType;
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
         if (log.parameters.en && log.parameters.en !== '-') {
             paramText += ` | en: ${log.parameters.en}`;
         }
      } else if (log.platform === 'Meta Pixel') {
         paramText = `${log.parameters.id}`; // Primarily display ID
         if (log.parameters.ev && log.parameters.ev !== '-') {
             paramText += ` | ev: ${log.parameters.ev}`;
         }
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

  container.appendChild(row);
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

init();
