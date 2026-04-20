export interface PlaybackState {
  currentTime: number;
  duration: number;
  paused: boolean;
  title: string;
  source: string;
}

export interface PlayerSession {
  sessionId: string;
  provider: string;
  state: PlaybackState;
  lastUpdated: number;
}

export interface PlayerProvider {
  name: string;
  discover(): Promise<PlayerSession[]>;
  play(sessionId: string): Promise<void>;
  pause(sessionId: string): Promise<void>;
  seek(sessionId: string, seconds: number): Promise<void>;
  seekRelative(sessionId: string, delta: number): Promise<void>;
  getState(sessionId: string): Promise<PlaybackState | null>;
}
