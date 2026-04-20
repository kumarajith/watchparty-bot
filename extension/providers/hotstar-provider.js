/**
 * Hotstar/Disney+ video provider.
 * Uses the standard <video> element for playback.
 * Overrides getTitle() to scrape from the on-screen player overlay.
 */
class HotstarProvider extends BaseVideoProvider {
  constructor() {
    super('hotstar');
  }

  /**
   * Scrapes the title from Hotstar's player overlay.
   * For series: "Show Name — S1 E2 Episode Title"
   * For movies: "Movie Name"
   * Falls back to document.title if elements are missing.
   * @returns {string}
   */
  getTitle() {
    const titleEl = document.querySelector('h1[class*="ON_IMAGE"]');
    if (!titleEl) return document.title;

    const title = titleEl.textContent.trim();
    const episodeEl = titleEl.closest('.flex')?.parentElement?.querySelector('p');
    const episode = episodeEl?.textContent.trim();

    return episode ? `${title} — ${episode}` : title;
  }
}
