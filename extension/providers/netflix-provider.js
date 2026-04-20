/**
 * Netflix video provider (content script world).
 * Netflix's video element is locked behind their internal cadmium API,
 * which is accessed by netflix-cadmium.js running in the MAIN world.
 * This provider communicates with it via window.postMessage.
 *
 * Netflix API uses MILLISECONDS — conversion to/from seconds happens here.
 */
class NetflixProvider extends BaseVideoProvider {
  constructor() {
    super('netflix');
    /** @type {Map<string, { resolve: Function, reject: Function }>} */
    this._pending = new Map();
    /** @type {string|null} Last successfully scraped title (survives overlay hide) */
    this._lastTitle = null;
    this._listenForResponses();
  }

  /**
   * Scrapes the title from Netflix's player overlay (content script context).
   * For series: "Show Name — E1 Episode Title"
   * For movies: "Movie Name"
   * Falls back to document.title if the element is missing (e.g. during intro).
   * @returns {string}
   */
  getTitle() {
    const titleEl = document.querySelector('[data-uia="video-title"]');
    if (!titleEl) return this._lastTitle || document.title;

    const children = titleEl.children;
    let title;
    if (children.length === 0) {
      title = titleEl.textContent.trim();
    } else {
      // Series: <h4>Show</h4><span>E1</span><span>Episode Title</span>
      const parts = Array.from(children).map(el => el.textContent.trim()).filter(Boolean);
      const show = parts[0];
      const rest = parts.slice(1).join(' ');
      title = rest ? `${show} — ${rest}` : show;
    }

    if (title) this._lastTitle = title;
    return title || this._lastTitle || document.title;
  }

  /**
   * Generates a unique request ID.
   * @returns {string}
   */
  _generateId() {
    return 'wp_' + Math.random().toString(36).slice(2) + '_' + Date.now();
  }

  /**
   * Listens for postMessage responses from the injected page script
   * and resolves the matching pending Promise.
   */
  _listenForResponses() {
    window.addEventListener('message', (event) => {
      if (!event.data || event.data.type !== 'WATCHPARTY_RESP') return;
      const { id, data } = event.data;
      const pending = this._pending.get(id);
      if (pending) {
        this._pending.delete(id);
        pending.resolve(data);
      }
    });
  }

  /**
   * Sends a command to the injected page script and returns a Promise.
   * @param {string} action
   * @param {number} [value]
   * @returns {Promise<any>}
   */
  _sendCommand(action, value) {
    return new Promise((resolve, reject) => {
      const id = this._generateId();
      this._pending.set(id, { resolve, reject });

      // Timeout after 5 seconds to prevent memory leaks
      setTimeout(() => {
        if (this._pending.has(id)) {
          this._pending.delete(id);
          resolve(null);
        }
      }, 5000);

      window.postMessage({ type: 'WATCHPARTY_CMD', id, action, value }, '*');
    });
  }

  /**
   * Returns the current playback state as a Promise.
   * Overlays the DOM-scraped title onto the page script response.
   * @returns {Promise<{ currentTime: number, duration: number, paused: boolean, title: string, source: string }|null>}
   */
  getState() {
    return this._sendCommand('getState').then((state) => {
      if (state) {
        state.title = this.getTitle();
      }
      return state;
    });
  }

  /**
   * Plays the video.
   * @returns {Promise<void>}
   */
  play() {
    return this._sendCommand('play');
  }

  /**
   * Pauses the video.
   * @returns {Promise<void>}
   */
  pause() {
    return this._sendCommand('pause');
  }

  /**
   * Seeks to an absolute position in seconds.
   * @param {number} seconds
   * @returns {Promise<void>}
   */
  seek(seconds) {
    return this._sendCommand('seek', seconds);
  }

  /**
   * Seeks relative to the current position.
   * Gets current time first, then seeks to currentTime + delta.
   * @param {number} delta - Seconds to seek forward (positive) or backward (negative)
   * @returns {Promise<void>}
   */
  seekRelative(delta) {
    return this.getState().then((state) => {
      if (state) {
        return this.seek(state.currentTime + delta);
      }
    });
  }
}
