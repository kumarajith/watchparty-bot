/**
 * Netflix cadmium API bridge (runs in MAIN world via manifest.json).
 *
 * This script executes in the page's main context — NOT the content script
 * sandbox — so it can access netflix.appContext and the cadmium video player.
 *
 * Communicates with netflix-provider.js (content world) via window.postMessage.
 */
(function() {
  function getPlayer() {
    try {
      var videoPlayer = netflix.appContext.state.playerApp.getAPI().videoPlayer;
      var sessionIds = videoPlayer.getAllPlayerSessionIds();
      if (!sessionIds || sessionIds.length === 0) return null;
      return videoPlayer.getVideoPlayerBySessionId(sessionIds[0]);
    } catch (e) {
      return null;
    }
  }

  window.addEventListener('message', function(event) {
    if (!event.data || event.data.type !== 'WATCHPARTY_CMD') return;

    var id = event.data.id;
    var action = event.data.action;
    var value = event.data.value;
    var player = getPlayer();

    if (action === 'getState') {
      if (!player) {
        window.postMessage({ type: 'WATCHPARTY_RESP', id: id, data: null }, '*');
        return;
      }
      try {
        var currentTimeMs = player.getCurrentTime();
        var durationMs = player.getDuration();
        var paused = player.isPaused();
        window.postMessage({
          type: 'WATCHPARTY_RESP',
          id: id,
          data: {
            currentTime: currentTimeMs / 1000,
            duration: durationMs / 1000,
            paused: paused,
            title: document.title,
            source: 'netflix'
          }
        }, '*');
      } catch (e) {
        window.postMessage({ type: 'WATCHPARTY_RESP', id: id, data: null }, '*');
      }
      return;
    }

    if (!player) return;

    try {
      if (action === 'play') {
        player.play();
      } else if (action === 'pause') {
        player.pause();
      } else if (action === 'seek') {
        // value is in seconds — convert to ms for Netflix API
        player.seek(value * 1000);
      }
    } catch (e) {
      // Silently ignore playback control errors
    }

    window.postMessage({ type: 'WATCHPARTY_RESP', id: id, data: null }, '*');
  });
})();
