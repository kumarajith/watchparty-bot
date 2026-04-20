/**
 * Content script for Netflix.
 * Instantiates NetflixProvider, sends periodic state updates,
 * and listens for playback commands from the background service worker.
 *
 * NOTE: NetflixProvider methods are Promise-based (postMessage bridge),
 * so heartbeat and getState handler use async/await or .then().
 */
(function () {
  const provider = new NetflixProvider();

  // Heartbeat: send current playback state every 2 seconds
  setInterval(function () {
    provider.getState().then(function (state) {
      if (state !== null) {
        chrome.runtime.sendMessage({ type: 'state', data: state });
      }
    });
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
        provider.getState().then(function (state) {
          sendResponse(state);
        });
        return true; // keep message channel open for async sendResponse
    }
  });
})();
