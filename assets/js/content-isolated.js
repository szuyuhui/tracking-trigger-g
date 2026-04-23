window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.type === 'TIKTOK_EVENT') {
    chrome.runtime.sendMessage(event.data);
  }
});
