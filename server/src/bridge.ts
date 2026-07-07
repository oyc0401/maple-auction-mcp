import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { BRIDGE_PORT, type BridgeCommand, type BridgeReply } from '@maple/shared';

export class Bridge {
  private wss: WebSocketServer;
  private conn: WebSocket | null = null;
  private pending = new Map<string, { resolve: (r: BridgeReply) => void; timer: NodeJS.Timeout }>();

  constructor(port: number = BRIDGE_PORT) {
    this.wss = new WebSocketServer({
      port,
      host: '127.0.0.1',
      // CSWSH 방지: 브라우저 웹페이지(http/https origin)의 접속을 거부한다.
      // 확장 SW는 chrome-extension:// origin, node 클라이언트(테스트/e2e)는 origin 없음.
      verifyClient: ({ origin }) => !origin || origin.startsWith('chrome-extension://'),
    });
    // 포트 충돌(EADDRINUSE) 등이 uncaught로 프로세스를 죽이지 않게 한다.
    this.wss.on('error', (err) => {
      process.stderr.write(`[bridge] WebSocketServer error: ${err.message}\n`);
    });
    this.wss.on('connection', (ws) => {
      this.conn?.close();
      this.conn = ws;
      ws.on('error', () => ws.close());
      ws.on('message', (raw) => this.onMessage(raw.toString()));
      ws.on('close', () => {
        if (this.conn === ws) this.conn = null;
      });
    });
  }

  get connected(): boolean {
    return this.conn !== null && this.conn.readyState === WebSocket.OPEN;
  }

  private onMessage(raw: string): void {
    let msg: BridgeReply;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg.id) return; // keepalive 등 id 없는 메시지는 무시
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve(msg);
  }

  request(cmd: Omit<BridgeCommand, 'id'>, timeoutMs = 15000): Promise<BridgeReply> {
    if (!this.connected) {
      return Promise.resolve({
        id: '',
        ok: false,
        code: 'DISCONNECTED',
        error: '크롬 확장이 연결되어 있지 않습니다. 크롬이 실행 중이고 Maple Auction Bridge 확장이 켜져 있는지 확인하세요.',
      });
    }
    const id = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ id, ok: false, code: 'TIMEOUT', error: `확장 응답 시간 초과 (${timeoutMs}ms)` });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      this.conn!.send(JSON.stringify({ ...cmd, id }));
    });
  }

  close(): Promise<void> {
    for (const [, p] of this.pending) clearTimeout(p.timer);
    this.pending.clear();
    this.conn?.close();
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }
}
