import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  BRIDGE_PORT,
  DISCONNECTED_MSG,
  PROTOCOL_VERSION,
  protocolMismatchMsg,
  type WireFetchCommand,
  type WireReply,
  type BridgeStatus,
} from '@maple/shared';

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

export class Broker {
  private wss: WebSocketServer;
  // 확장 연결들(origin chrome-extension://). 프로필마다 하나씩 붙을 수 있어 전부 보유.
  private extensions = new Set<WebSocket>();
  // fanout이 고른 로그인된 확장. 일반 요청은 여기로만.
  private preferred: WebSocket | null = null;
  // 확장별 hello로 보고된 프로토콜 버전. 미보고(hello 도입 전 dev 빌드/수신 전 찰나)는 차단하지 않는다.
  private extVersions = new Map<WebSocket, number>();
  // origin 없는 MCP 클라이언트 연결들(다중 세션).
  private clients = new Set<WebSocket>();
  private pending = new Map<string, { resolve: (r: WireReply) => void; timer: NodeJS.Timeout }>();
  // 서버 소켓 에러 훅. 단독 실행 시 EADDRINUSE 종료 처리에 사용(테스트에선 미설정).
  onServerError?: (err: NodeJS.ErrnoException) => void;

  constructor(port: number = BRIDGE_PORT) {
    this.wss = new WebSocketServer({
      port,
      host: '127.0.0.1',
      // CSWSH 방지: 브라우저 웹페이지(http/https origin)의 접속을 거부한다.
      // 확장 SW는 chrome-extension:// origin, node 클라이언트(테스트/MCP)는 origin 없음.
      verifyClient: ({ origin }: { origin?: string }) => !origin || origin.startsWith('chrome-extension://'),
    });
    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      process.stderr.write(`[broker] WebSocketServer error: ${err.message}\n`);
      this.onServerError?.(err);
    });
    this.wss.on('connection', (ws, req) => {
      const origin = req.headers.origin;
      if (origin && origin.startsWith('chrome-extension://')) {
        this.addExtension(ws);
      } else {
        this.addClient(ws);
      }
    });
  }

  private addExtension(ws: WebSocket): void {
    this.extensions.add(ws);
    this.broadcastStatus();
    ws.on('error', () => ws.close());
    ws.on('message', (raw) => this.onExtensionMessage(ws, raw.toString()));
    ws.on('close', () => {
      this.extensions.delete(ws);
      this.extVersions.delete(ws);
      if (this.preferred === ws) this.preferred = null;
      this.broadcastStatus();
    });
  }

  private addClient(ws: WebSocket): void {
    this.clients.add(ws);
    this.sendStatus(ws); // 접속 즉시 현재 상태 통지
    ws.on('error', () => ws.close());
    ws.on('message', (raw) => void this.onClientMessage(ws, raw.toString()));
    ws.on('close', () => this.clients.delete(ws));
  }

  // 클라이언트 메시지 = {...cmd, id: clientId}. request()로 감싸 응답에 clientId를 찍어 돌려준다.
  private async onClientMessage(ws: WebSocket, raw: string): Promise<void> {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.keepalive) return; // id 없는 keepalive 무시
    const clientId = msg.id;
    if (typeof clientId !== 'string') return;
    const { id: _omit, ...cmd } = msg;
    const reply = await this.request(cmd as unknown as Omit<WireFetchCommand, 'id'>);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ ...reply, id: clientId }));
    }
  }

  private sendStatus(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    const status: BridgeStatus = { type: 'bridgeStatus', extension: this.extConnected };
    ws.send(JSON.stringify(status));
  }

  private broadcastStatus(): void {
    for (const ws of this.clients) this.sendStatus(ws);
  }

  get extConnected(): boolean {
    for (const ws of this.extensions) if (ws.readyState === WebSocket.OPEN) return true;
    return false;
  }

  // hello로 보고된 버전이 서버와 다르면 불일치 에러, 호환(일치 또는 미보고)이면 null.
  private protocolError(ws: WebSocket): WireReply | null {
    const v = this.extVersions.get(ws);
    if (v === undefined || v === PROTOCOL_VERSION) return null;
    return { id: '', ok: false, code: 'PROTOCOL_MISMATCH', error: protocolMismatchMsg(v) };
  }

  private onExtensionMessage(ws: WebSocket, raw: string): void {
    let msg: WireReply;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if ((msg as unknown as { type?: string }).type === 'hello') {
      const v = (msg as unknown as { protocolVersion?: unknown }).protocolVersion;
      if (typeof v === 'number') this.extVersions.set(ws, v);
      return;
    }
    if (!msg.id) return; // keepalive 등 id 없는 메시지 무시
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve(msg);
  }

  request(cmd: Omit<WireFetchCommand, 'id'>, timeoutMs = 15000): Promise<WireReply> {
    if (!this.extConnected) {
      return Promise.resolve({ id: '', ok: false, code: 'DISCONNECTED', error: DISCONNECTED_MSG });
    }
    // fanout: 모든 확장(프로필)에 뿌려 첫 성공(=로그인된) 확장을 preferred로 고정. 나머지 요청은 그 연결로만.
    if (cmd.fanout) return this.fanout(cmd, timeoutMs);
    const target = this.target();
    if (!target) {
      return Promise.resolve({ id: '', ok: false, code: 'DISCONNECTED', error: DISCONNECTED_MSG });
    }
    const mismatch = this.protocolError(target);
    if (mismatch) return Promise.resolve(mismatch);
    return this.sendTo(target, cmd, timeoutMs);
  }

  // fanout fetch를 붙어있는 모든 확장에 보내고, 가장 먼저 성공 응답을 준(=로그인된) 확장을 preferred로 고정한다.
  // 프로토콜 불일치 확장은 후보에서 제외 — 전부 불일치면 그 안내를 그대로 돌려준다.
  private async fanout(cmd: Omit<WireFetchCommand, 'id'>, timeoutMs: number): Promise<WireReply> {
    const open = [...this.extensions].filter((ws) => ws.readyState === WebSocket.OPEN);
    const conns = open.filter((ws) => !this.protocolError(ws));
    if (!conns.length) {
      const first = open[0] && this.protocolError(open[0]);
      return first ?? { id: '', ok: false, code: 'DISCONNECTED', error: DISCONNECTED_MSG };
    }
    const results = conns.map((ws) => this.sendTo(ws, cmd, timeoutMs).then((r) => ({ ws, r })));
    const winner = await firstMatch(results, ({ r }) => r.ok);
    if (winner) {
      this.preferred = winner.ws;
      return winner.r;
    }
    // 성공한 확장이 없음(전원 미로그인 등): 첫 응답을 그대로 돌려준다.
    const all = await Promise.all(results);
    return all[0].r;
  }

  // preferred가 살아있으면 그쪽, 없으면 가장 최근에 붙은 열린 연결로 폴백.
  private target(): WebSocket | null {
    if (this.preferred && this.preferred.readyState === WebSocket.OPEN) return this.preferred;
    let last: WebSocket | null = null;
    for (const ws of this.extensions) if (ws.readyState === WebSocket.OPEN) last = ws;
    return last;
  }

  private sendTo(ws: WebSocket, cmd: Omit<WireFetchCommand, 'id'>, timeoutMs: number): Promise<WireReply> {
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
    for (const ws of this.extensions) ws.close();
    this.extensions.clear();
    for (const ws of this.clients) ws.close();
    this.clients.clear();
    this.preferred = null;
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }
}

export function startBroker(port: number = BRIDGE_PORT): Broker {
  return new Broker(port);
}

// `node dist/broker.js`로 직접 실행될 때만 기동. import될 땐 실행 안 함.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const broker = startBroker();
  broker.onServerError = (err) => {
    // 포트 충돌(다른 브로커가 이미 소유) → 경쟁에서 진 이 프로세스는 조용히 종료. 승자가 서빙.
    if (err.code === 'EADDRINUSE') process.exit(0);
  };
}
