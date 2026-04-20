/**
 * Amazon Prime Video provider.
 * Overrides getVideo() to handle multiple <video> elements by selecting
 * the one with the longest duration (the main feature video).
 * Overrides getTitle() to strip the "Prime Video: " prefix from document.title
 * and append episode info from the player subtitle element when available.
 */
class PrimeProvider extends BaseVideoProvider {
  constructor() {
    super('prime');
  }

  /**
   * Returns the primary video element.
   * If multiple <video> elements exist, picks the one with the longest duration.
   * @returns {HTMLVideoElement|null}
   */
  getVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];

    // Pick the video with the longest duration
    return videos.reduce((best, current) => {
      return (current.duration || 0) > (best.duration || 0) ? current : best;
    }, videos[0]);
  }

  /**
   * Scrapes the title from Prime Video.
   * Strips "Prime Video: " / "Amazon.xx: " prefix from document.title.
   * For series, appends episode info from the player subtitle element.
   * @returns {string}
   */
  getTitle() {
    const raw = document.title;
    const title = raw.replace(/^(Prime Video:\s*|Amazon\.\w+:\s*|Watch\s+)/i, '').trim();

    const subtitleEl = document.querySelector('.atvwebplayersdk-subtitle-text');
    const subtitle = subtitleEl?.textContent.trim();

    return subtitle ? `${title} — ${subtitle}` : title;
  }
}
