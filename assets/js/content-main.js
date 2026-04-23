(function() {
  function hookTikTok() {
    const ttq = window.ttq;
    if (!ttq || ttq._hooked) return;
    ttq._hooked = true;

    // Interface for tracking: ttq.track(event, data, options)
    const originalTrack = ttq.track;
    if (typeof originalTrack === 'function') {
      ttq.track = function(event, data, options) {
        const sdkid = data?.pixel_code || ttq.instance?.pixelCode || 'unknown';
        window.postMessage({
          type: 'TIKTOK_EVENT',
          event: event,
          event_id: data?.event_id || '-',
          sdkid: sdkid
        }, '*');
        return originalTrack.apply(this, arguments);
      };
    }

    // Interface for buffering: ttq.push(['track', event, data])
    const originalPush = ttq.push;
    if (typeof originalPush === 'function') {
      ttq.push = function() {
        const args = Array.from(arguments);
        if (args[0] === 'track') {
          window.postMessage({
            type: 'TIKTOK_EVENT',
            event: args[1],
            event_id: args[2]?.event_id || '-',
            sdkid: args[2]?.pixel_code || 'unknown'
          }, '*');
        }
        return originalPush.apply(this, arguments);
      };
    }
  }

  // Initial check
  if (window.ttq) {
    hookTikTok();
  }

  // Monitor for ttq being added to window
  let timer = setInterval(() => {
    if (window.ttq) {
      hookTikTok();
      if (window.ttq._hooked && typeof window.ttq.track === 'function') {
        clearInterval(timer);
      }
    }
  }, 500);

  // Safety clear after 10 seconds
  setTimeout(() => clearInterval(timer), 10000);
})();
