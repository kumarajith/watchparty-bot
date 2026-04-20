/**
 * Content script for Hotstar / Disney+.
 * Instantiates HotstarProvider, sends periodic state updates,
 * and listens for playback commands from the background service worker.
 */
(function () {
  const provider = new HotstarProvider();

  // Heartbeat: send current playback state every 2 seconds
  setInterval(function () {
    var state = provider.getState();
    if (state !== null) {
      chrome.runtime.sendMessage({ type: 'state', data: state });
    }
  }, 2000);

  // Listen for playback commands forwarded from the background script
  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.type !== 'command') return;

    switch (msg.action) {
      case 'play':
        provider.play();
        break;
      case 'pause':
        provider.pause();
        break;
      case 'seek':
        provider.seek(msg.value);
        break;
      case 'seekRelative':
        provider.seekRelative(msg.value);
        break;
      case 'getState':
        sendResponse(provider.getState());
        return true;
    }
  });
})();
