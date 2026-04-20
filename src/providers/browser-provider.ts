import type { PlayerProvider, PlayerSession, PlaybackState } from './types.js';
import type { WsServer, ExtensionStateMessage } from '../server/ws-server.js';

interface TabState {
  tabId: number;
  source: string;
  state: PlaybackState;
  lastUpdated: number;
}

const STALE_THRESHOLD_MS = 10_000;

export class BrowserProvider implements PlayerProvider {
  readonly name = 'browser';
  private tabs = new Map<number, TabState>();

  constructor(private wsServer: WsServer) {
    this.wsServer.onState((msg: ExtensionStateMessage) => {
      this.tabs.set(msg.tabId, {
        tabId: msg.tabId,
        source: msg.source,
        state: {
          currentTime: msg.data.currentTime,
          duration: msg.data.duration,
          paused: msg.data.paused,
          title: msg.data.title,
          source: msg.source,
        },
        lastUpdated: Date.now(),
      });
    });
  }

  async discover(): Promise<PlayerSession[]> {
    this.pruneStale();
    return Array.from(this.tabs.values()).map((tab) => ({
      sessionId: `browser:${tab.tabId}`,
      provider: this.name,
      state: tab.state,
      lastUpdated: tab.lastUpdated,
    }));
  }

  async play(sessionId: string): Promise<void> {
    this.wsServer.sendCommand({
      type: 'command',
      tabId: this.extractTabId(sessionId),
      action: 'play',
    });
  }

  async pause(sessionId: string): Promise<void> {
    this.wsServer.sendCommand({
      type: 'command',
      tabId: this.extractTabId(sessionId),
      action: 'pause',
    });
  }

  async seek(sessionId: string, seconds: number): Promise<void> {
    this.wsServer.sendCommand({
      type: 'command',
      tabId: this.extractTabId(sessionId),
      action: 'seek',
      value: seconds,
    });
  }

  async seekRelative(sessionId: string, delta: number): Promise<void> {
    this.wsServer.sendCommand({
      type: 'command',
      tabId: this.extractTabId(sessionId),
      action: 'seekRelative',
      value: delta,
    });
  }

  async getState(sessionId: string): Promise<PlaybackState | null> {
    const tabId = this.extractTabId(sessionId);
    const tab = this.tabs.get(tabId);
    return tab?.state ?? null;
  }

  private extractTabId(sessionId: string): number {
    const id = parseInt(sessionId.replace('browser:', ''), 10);
    if (isNaN(id)) throw new Error(`Invalid browser session ID: ${sessionId}`);
    return id;
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [tabId, tab] of this.tabs) {
      if (now - tab.lastUpdated > STALE_THRESHOLD_MS) {
        this.tabs.delete(tabId);
      }
    }
  }
}
