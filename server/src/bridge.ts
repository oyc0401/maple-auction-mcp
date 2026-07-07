import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { BRIDGE_PORT, type BridgeCommandInput, type BridgeReply } from '@maple/shared';

// promises 중 pred를 만족하는 첫 결과로 즉시 resolve, 하나도 없으면 null.
// (로그인된 확장을 찾는 즉시 반환해 느린/잠든 확장을 기다리지 않기 위함)
function firstMatch<T>(promises: Promise<T>[], pred: (t: T) => boolean): Promise<T | null> {
  return new Promise((resolve) => {
    let remaining = promises.length;
    if (!remaining) return resolve(null);
    for (const p of promises) {
      p.then(
        (v) => {
          if (pred(v)) resolve(v);
          else if (--remaining === 0) resolve(null);
        },
        () => {
          if (--remaining === 0) resolve(null);
        }
      );
    }
  });
}

export class Bridge {
  private wss: WebSocketServer;
  // 프로필마다 확장이 붙을 수 있으므로 연결을 전부 보유한다 (이전 연결을 끊지 않음).
  private conns = new Set<WebSocket>();
  // discover가 고른 "로그인된" 연결. 일반 요청(fetch/POST)은 여기로만 보낸다.
  private preferred: WebSocket | null = null;
  private pending = new Map<string, { resolve: (r: BridgeReply) => void; timer: NodeJS.Timeout }>();

  constructor(port: number = BRIDGE_PORT) {
    this.wss = new WebSocketServer({
      port,
      host: '127.0.0.1',
      // CSWSH 방지: 브라우저 웹페이지(http/https origin)의 접속을 거부한다.
      // 확장 SW는 chrome-extension:// origin, node 클라이언트(테스트/e2e)는 origin 없음.
      verifyClient: ({ origin }: { origin?: string }) => !origin || origin.startsWith('chrome-extension://'),
    });
    // 포트 충돌(EADDRINUSE) 등이 uncaught로 프로세스를 죽이지 않게 한다.
    this.wss.on('error', (err) => {
      process.stderr.write(`[bridge] WebSocketServer error: ${err.message}\n`);
    });
    this.wss.on('connection', (ws) => {
      this.conns.add(ws);
      ws.on('error', () => ws.close());
      ws.on('message', (raw) => this.onMessage(raw.toString()));
      ws.on('close', () => {
        this.conns.delete(ws);
        if (this.preferred === ws) this.preferred = null;
      });
    });
  }

  get connected(): boolean {
    for (const ws of this.conns) if (ws.readyState === WebSocket.OPEN) return true;
    return false;
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

  request(cmd: BridgeCommandInput, timeoutMs = 15000): Promise<BridgeReply> {
    if (!this.connected) {
      return Promise.resolve({
        id: '',
        ok: false,
        code: 'DISCONNECTED',
        error: '크롬 확장이 연결되어 있지 않습니다. 크롬이 실행 중이고 Maple Auction Bridge 확장이 켜져 있는지 확인하세요.',
      });
    }
    // discover는 모든 확장(프로필)에 뿌려 로그인된 쪽을 고른다. 나머지 요청은 그 연결로만.
    if (cmd.type === 'discover') return this.discover(cmd, timeoutMs);
    const target = this.target();
    if (!target) {
      return Promise.resolve({
        id: '',
        ok: false,
        code: 'DISCONNECTED',
        error: '크롬 확장이 연결되어 있지 않습니다. 크롬이 실행 중이고 Maple Auction Bridge 확장이 켜져 있는지 확인하세요.',
      });
    }
    return this.sendTo(target, cmd, timeoutMs);
  }

  // discover를 붙어있는 모든 확장에 보내고, 가장 먼저 identity를 준(=로그인된) 확장을 preferred로 고정한다.
  private async discover(cmd: BridgeCommandInput, timeoutMs: number): Promise<BridgeReply> {
    const conns = [...this.conns].filter((ws) => ws.readyState === WebSocket.OPEN);
    const results = conns.map((ws) => this.sendTo(ws, cmd, timeoutMs).then((r) => ({ ws, r })));
    const winner = await firstMatch(results, ({ r }) => r.ok && r.data != null);
    if (winner) {
      this.preferred = winner.ws;
      return winner.r;
    }
    // 로그인된 확장이 없음: 첫 응답(주로 NO_IDENTITY/TIMEOUT)을 그대로 돌려준다.
    const all = await Promise.all(results);
    return all[0].r;
  }

  // preferred가 살아있으면 그쪽, 없으면 가장 최근에 붙은 열린 연결로 폴백.
  private target(): WebSocket | null {
    if (this.preferred && this.preferred.readyState === WebSocket.OPEN) return this.preferred;
    let last: WebSocket | null = null;
    for (const ws of this.conns) if (ws.readyState === WebSocket.OPEN) last = ws;
    return last;
  }

  private sendTo(ws: WebSocket, cmd: BridgeCommandInput, timeoutMs: number): Promise<BridgeReply> {
    const id = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ id, ok: false, code: 'TIMEOUT', error: `확장 응답 시간 초과 (${timeoutMs}ms)` });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      ws.send(JSON.stringify({ ...cmd, id }));
    });
  }

  close(): Promise<void> {
    for (const [, p] of this.pending) clearTimeout(p.timer);
    this.pending.clear();
    for (const ws of this.conns) ws.close();
    this.conns.clear();
    this.preferred = null;
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }
}
