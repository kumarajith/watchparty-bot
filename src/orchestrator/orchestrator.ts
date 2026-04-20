import type { PlayerProvider, PlayerSession, PlaybackState } from '../providers/types.js';

export class Orchestrator {
  private providers: PlayerProvider[];
  private activeSessionId: string | null = null;
  private manualOverride = false;
  private sessions: PlayerSession[] = [];

  constructor(providers: PlayerProvider[]) {
    this.providers = providers;
  }

  async discoverAll(): Promise<PlayerSession[]> {
    const results = await Promise.all(
      this.providers.map((p) => p.discover().catch(() => [] as PlayerSession[]))
    );
    this.sessions = results.flat();

    // Clear manual override if the selected session is gone
    if (this.manualOverride && this.activeSessionId) {
      const stillExists = this.sessions.some((s) => s.sessionId === this.activeSessionId);
      if (!stillExists) {
        this.activeSessionId = null;
        this.manualOverride = false;
      }
    }

    return this.sessions;
  }

  async getActiveSession(): Promise<PlayerSession | null> {
    const sessions = await this.discoverAll();
    if (sessions.length === 0) return null;

    // 1. Manual override — stick with it if still alive
    if (this.manualOverride && this.activeSessionId) {
      const found = sessions.find((s) => s.sessionId === this.activeSessionId);
      if (found) return found;
      // Manual target disconnected, fall through to auto
      this.manualOverride = false;
      this.activeSessionId = null;
    }

    // 2. Single session — use it
    if (sessions.length === 1) {
      this.activeSessionId = sessions[0].sessionId;
      return sessions[0];
    }

    // 3. Prefer playing (not paused)
    const playing = sessions.filter((s) => !s.state.paused);
    if (playing.length === 1) {
      this.activeSessionId = playing[0].sessionId;
      return playing[0];
    }
    if (playing.length > 1) {
      // 4. Multiple playing — most recently updated
      const sorted = playing.sort((a, b) => b.lastUpdated - a.lastUpdated);
      this.activeSessionId = sorted[0].sessionId;
      return sorted[0];
    }

    // 5. All paused — most recently updated
    const sorted = sessions.sort((a, b) => b.lastUpdated - a.lastUpdated);
    this.activeSessionId = sorted[0].sessionId;
    return sorted[0];
  }

  setActiveSession(sessionId: string): void {
    this.activeSessionId = sessionId;
    this.manualOverride = true;
  }

  getSessions(): PlayerSession[] {
    return this.sessions;
  }

  async play(): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) throw new Error('No active playback session');
    const provider = this.findProvider(session.provider);
    await provider.play(session.sessionId);
  }

  async pause(): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) throw new Error('No active playback session');
    const provider = this.findProvider(session.provider);
    await provider.pause(session.sessionId);
  }

  async seek(seconds: number): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) throw new Error('No active playback session');
    const provider = this.findProvider(session.provider);
    await provider.seek(session.sessionId, seconds);
  }

  async seekRelative(delta: number): Promise<void> {
    const session = await this.getActiveSession();
    if (!session) throw new Error('No active playback session');
    const provider = this.findProvider(session.provider);
    await provider.seekRelative(session.sessionId, delta);
  }

  async getActiveState(): Promise<PlaybackState | null> {
    const session = await this.getActiveSession();
    if (!session) return null;
    const provider = this.findProvider(session.provider);
    return provider.getState(session.sessionId);
  }

  private findProvider(name: string): PlayerProvider {
    const provider = this.providers.find((p) => p.name === name);
    if (!provider) throw new Error(`Provider not found: ${name}`);
    return provider;
  }
}
