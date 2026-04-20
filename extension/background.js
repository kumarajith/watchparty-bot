/**
 * Background Service Worker for Movie Night Controller.
 *
 * Responsibilities:
 * - Maintains a persistent WebSocket connection to the companion app (ws://localhost:9393)
 * - Routes state updates from content scripts to the WebSocket
 * - Routes commands from the WebSocket to the appropriate tab
 * - Auto-reconnects with exponential backoff on disconnect
 */

const WS_URL = 'ws://localhost:9393';

/** @type {WebSocket|null} */
let socket = null;

/** @type {number} Current reconnect delay in ms */
let reconnectDelay = 1000;

const MAX_RECONNECT_DELAY = 30000;

/**
 * Map of tabId → { source: string, data: object, lastUpdated: number }
 * Tracks which tabs currently have active video state.
 * @type {Map<number, { source: string, data: object, lastUpdated: number }>}
 */
const tabStates = new Map();

// ─── WebSocket Management ───────────────────────────────────────────────────

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(WS_URL);

  socket.addEventListener('open', function () {
    console.log('[MovieNight] WebSocket connected to', WS_URL);
    reconnectDelay = 1000; // reset backoff on successful connect
  });

  socket.addEventListener('message', function (event) {
    try {
      const msg = JSON.parse(event.data);
      handleServerCommand(msg);
    } catch (e) {
      console.warn('[MovieNight] Failed to parse WebSocket message:', event.data);
    }
  });

  socket.addEventListener('close', function () {
    console.log('[MovieNight] WebSocket closed. Reconnecting in', reconnectDelay, 'ms...');
    socket = null;
    scheduleReconnect();
  });

  socket.addEventListener('error', function (err) {
    console.warn('[MovieNight] WebSocket error:', err);
    // 'close' event will fire after 'error', so reconnect is handled there
  });
}

function scheduleReconnect() {
  setTimeout(function () {
    connectWebSocket();
  }, reconnectDelay);

  // Exponential backoff, capped at MAX_RECONNECT_DELAY
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

// ─── Command Routing (WebSocket → Tab) ──────────────────────────────────────

/**
 * Handles a command received from the WebSocket server and routes it
 * to the appropriate content script tab.
 * @param {{ type: string, tabId: number|null, action: string, value?: number }} msg
 */
function handleServerCommand(msg) {
  if (msg.type !== 'command') return;

  let targetTabId = msg.tabId;

  if (targetTabId === null || targetTabId === undefined) {
    // Find the most recently updated tab
    let latestTime = -1;
    tabStates.forEach(function (state, tabId) {
      if (state.lastUpdated > latestTime) {
        latestTime = state.lastUpdated;
        targetTabId = tabId;
      }
    });
  }

  if (targetTabId == null) {
    console.warn('[MovieNight] No active tab found for command:', msg);
    return;
  }

  chrome.tabs.sendMessage(targetTabId, {
    type: 'command',
    action: msg.action,
    value: msg.value
  }).catch(function (err) {
    console.warn('[MovieNight] Failed to send command to tab', targetTabId, ':', err.message);
    // Tab may have been closed or navigated away — clean up
    tabStates.delete(targetTabId);
  });
}

// ─── State Routing (Tab → WebSocket) ────────────────────────────────────────

/**
 * Handles messages from content scripts.
 * Forwards state updates to the WebSocket.
 */
chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (msg.type !== 'state') return;
  if (!sender.tab) return;

  const tabId = sender.tab.id;

  // Update local tab state tracking
  tabStates.set(tabId, {
    source: msg.data && msg.data.source,
    data: msg.data,
    lastUpdated: Date.now()
  });

  // Forward to WebSocket if connected
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'state',
      tabId: tabId,
      source: msg.data && msg.data.source,
      data: msg.data
    }));
  }
});

// ─── Tab Lifecycle ───────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(function (tabId) {
  if (tabStates.has(tabId)) {
    tabStates.delete(tabId);
    console.log('[MovieNight] Cleaned up state for closed tab', tabId);
  }
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

connectWebSocket();
