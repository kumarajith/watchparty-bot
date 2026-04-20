import { WebSocketServer, WebSocket } from 'ws';

export interface ExtensionStateMessage {
  type: 'state';
  tabId: number;
  source: string;
  data: {
    currentTime: number;
    duration: number;
    paused: boolean;
    title: string;
  };
}

export interface ExtensionCommandMessage {
  type: 'command';
  tabId: number | null;
  action: 'play' | 'pause' | 'seek' | 'seekRelative' | 'getState';
  value?: number;
}

type StateHandler = (msg: ExtensionStateMessage) => void;

export class WsServer {
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private stateHandler: StateHandler | null = null;

  start(port: number): void {
    this.wss = new WebSocketServer({ port });
    console.log(`[WS] Server listening on ws://localhost:${port}`);

    this.wss.on('connection', (ws) => {
      console.log('[WS] Extension connected');
      this.client = ws;

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as ExtensionStateMessage;
          if (msg.type === 'state' && this.stateHandler) {
            this.stateHandler(msg);
          }
        } catch {
          console.error('[WS] Failed to parse message');
        }
      });

      ws.on('close', () => {
        console.log('[WS] Extension disconnected');
        if (this.client === ws) this.client = null;
      });

      ws.on('error', (err) => {
        console.error('[WS] Connection error:', err.message);
      });
    });
  }

  onState(handler: StateHandler): void {
    this.stateHandler = handler;
  }

  sendCommand(cmd: ExtensionCommandMessage): void {
    if (!this.client || this.client.readyState !== WebSocket.OPEN) {
      console.warn('[WS] No extension connected, command dropped');
      return;
    }
    this.client.send(JSON.stringify(cmd));
  }

  get isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  close(): void {
    this.client?.close();
    this.wss?.close();
  }
}
