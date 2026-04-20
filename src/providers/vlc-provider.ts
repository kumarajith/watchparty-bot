import type { PlayerProvider, PlayerSession, PlaybackState } from './types.js';

interface VlcStatusResponse {
  time: number;
  length: number;
  state: 'playing' | 'paused' | 'stopped';
  information?: {
    category?: {
      meta?: {
        filename?: string;
      };
    };
  };
}

export class VlcProvider implements PlayerProvider {
  readonly name = 'vlc';
  private baseUrl: string;
  private authHeader: string;
  private lastState: PlaybackState | null = null;
  private lastUpdated = 0;

  constructor(host: string, port: number, password: string) {
    this.baseUrl = `http://${host}:${port}`;
    this.authHeader = 'Basic ' + Buffer.from(`:${password}`).toString('base64');
  }

  async discover(): Promise<PlayerSession[]> {
    const state = await this.fetchState();
    if (!state) return [];
    this.lastState = state;
    this.lastUpdated = Date.now();
    return [
      {
        sessionId: 'vlc:0',
        provider: this.name,
        state,
        lastUpdated: this.lastUpdated,
      },
    ];
  }

  async play(_sessionId: string): Promise<void> {
    const state = await this.fetchState();
    if (state?.paused) {
      await this.sendCommand('pl_pause');
    }
  }

  async pause(_sessionId: string): Promise<void> {
    const state = await this.fetchState();
    if (state && !state.paused) {
      await this.sendCommand('pl_pause');
    }
  }

  async seek(_sessionId: string, seconds: number): Promise<void> {
    await this.sendCommand('seek', `${Math.floor(seconds)}`);
  }

  async seekRelative(_sessionId: string, delta: number): Promise<void> {
    const sign = delta >= 0 ? '+' : '';
    await this.sendCommand('seek', `${sign}${Math.floor(delta)}`);
  }

  async getState(_sessionId: string): Promise<PlaybackState | null> {
    const state = await this.fetchState();
    if (state) {
      this.lastState = state;
      this.lastUpdated = Date.now();
    }
    return state;
  }

  private async fetchState(): Promise<PlaybackState | null> {
    try {
      const res = await fetch(`${this.baseUrl}/requests/status.json`, {
        headers: { Authorization: this.authHeader },
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as VlcStatusResponse;
      if (data.state === 'stopped') return null;

      const filename = data.information?.category?.meta?.filename ?? 'Unknown';
      return {
        currentTime: data.time,
        duration: data.length,
        paused: data.state === 'paused',
        title: filename,
        source: 'vlc',
      };
    } catch {
      return null;
    }
  }

  private async sendCommand(command: string, val?: string): Promise<void> {
    try {
      const url = new URL(`${this.baseUrl}/requests/status.json`);
      url.searchParams.set('command', command);
      if (val !== undefined) url.searchParams.set('val', val);

      await fetch(url.toString(), {
        headers: { Authorization: this.authHeader },
        signal: AbortSignal.timeout(2000),
      });
    } catch (err) {
      console.error('[VLC] Command failed:', (err as Error).message);
    }
  }
}
