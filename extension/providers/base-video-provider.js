/**
 * Abstract base class for video providers.
 * Provides common video control methods using the standard <video> element.
 */
class BaseVideoProvider {
  /**
   * @param {string} source - The provider source identifier ('hotstar', 'prime', 'netflix')
   */
  constructor(source) {
    this.source = source;
  }

  /**
   * Returns the video element, or null if not found.
   * @returns {HTMLVideoElement|null}
   */
  getVideo() {
    return document.querySelector('video') || null;
  }

  /**
   * Returns the title of the currently playing content.
   * Subclasses should override this to scrape from provider-specific DOM elements.
   * @returns {string}
   */
  getTitle() {
    return document.title;
  }

  /**
   * Returns the current playback state, or null if no video is present.
   * @returns {{ currentTime: number, duration: number, paused: boolean, title: string, source: string }|null}
   */
  getState() {
    const video = this.getVideo();
    if (!video) return null;
    return {
      currentTime: video.currentTime,
      duration: video.duration,
      paused: video.paused,
      title: this.getTitle(),
      source: this.source
    };
  }

  /**
   * Plays the video.
   */
  play() {
    this.getVideo()?.play();
  }

  /**
   * Pauses the video.
   */
  pause() {
    this.getVideo()?.pause();
  }

  /**
   * Seeks to an absolute position in seconds.
   * @param {number} seconds
   */
  seek(seconds) {
    const video = this.getVideo();
    if (video) {
      video.currentTime = seconds;
    }
  }

  /**
   * Seeks relative to the current position.
   * @param {number} delta - Seconds to seek forward (positive) or backward (negative)
   */
  seekRelative(delta) {
    const video = this.getVideo();
    if (video) {
      video.currentTime += delta;
    }
  }
}
