import { randomBytes } from 'node:crypto';
import type { BridgeErrorCode, WireFetchCommand, WireReply } from '@maple/shared';

export const MAPLE_AUCTION_API_BASE = 'https://api.mskr.nexon.com/v1';
const ITEM_API_BASE = `${MAPLE_AUCTION_API_BASE}/market/web/items`;
const SEARCH_URL = `${ITEM_API_BASE}/searches/tool-tip`;
const SOLD_SEARCH_URL = `${ITEM_API_BASE}/searches/sold/tool-tip`;
const RECENT_SOLD_URL = `${ITEM_API_BASE}/searches/sold/recent`;
const DAILY_LIMIT_URL = `${MAPLE_AUCTION_API_BASE}/market/web/daily-limit`;
const WISHLIST_URL = `${MAPLE_AUCTION_API_BASE}/market/web/wishlists`;
const AUTH_BASE = MAPLE_AUCTION_API_BASE;
export const WISHLIST_MAX = 50;

export interface Identity {
  worldId: number;
  accountId: number;
  characterId: number;
}

export interface AuctionCommandInput {
  type: 'fetch';
  url: string;
  method: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  fanout?: boolean;
}

export interface AuctionOk {
  id: string;
  ok: true;
  status?: number;
  data?: unknown;
}

export interface AuctionErr {
  id: string;
  ok: false;
  code: BridgeErrorCode;
  error: string;
  status?: number;
  data?: unknown;
}

export type AuctionReply = AuctionOk | AuctionErr;

export const NO_SESSION_MSG =
  '거래소 세션이 없거나 만료되었습니다. 넥슨 로그인만으로는 세션이 생기지 않고, 다른 곳에서 새 세션이 생기면 이전 세션은 무효가 됩니다. ' +
  '사용자에게 크롬에서 https://auction.maplestory.nexon.com 을 열거나 새로고침하라고 안내하고(로그인 페이지가 나오면 로그인), ' +
  '완료됐다고 하면 다시 요청하세요.';

// ===== 메이플 옥션 API 지식의 단일 소유처 =====
// 확장(웹스토어 심사 필요)에 있던 헤더 구성이 여기로 왔다.
// 넥슨이 x-client-version을 올리거나 헤더를 바꾸면 이 파일만 고치고 npm 릴리스하면 끝.

// api.mskr.nexon.com은 실제 웹 거래소가 보내는 클라이언트 식별 헤더를 요구한다.
// 이게 없으면 쿠키가 유효해도 426(Upgrade Required)으로 튕긴다. 실측값: docs/API.md.
// origin/referer는 브라우저 fetch가 설정 금지라 확장 쪽에서 못 싣지만, 확장의 host 권한이
// CORS를 우회하므로 x-platform / x-device-id / x-client-version / accept만으로 게이트를 통과한다.
const DEVICE_ID = randomBytes(16).toString('hex');

export function auctionHeaders(hasBody = false): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    'x-platform': 'PC_WEB',
    'x-device-id': DEVICE_ID,
    // 이게 없으면 426. 웹 거래소가 보내는 실측값(2026-07-09).
    'x-client-version': '1.0.1',
  };
  if (hasBody) h['Content-Type'] = 'application/json';
  return h;
}

// mcp.ts·characters.ts가 소비하는 내부 API. (mcp.ts에 있던 것을 이동 — 순환 import 방지)
export interface AuctionTransport {
  readonly connected: boolean;
  request(cmd: AuctionCommandInput, timeoutMs?: number): Promise<AuctionReply>;
  close?(): Promise<void>;
}

// 와이어 프레임을 나르는 전송 계층 (구현: bridge.ts의 Bridge)
export interface WireTransport {
  readonly connected: boolean;
  request(cmd: Omit<WireFetchCommand, 'id'>, timeoutMs?: number): Promise<WireReply>;
  close?(): Promise<void>;
}

// 내부 API(객체 바디, 파싱된 data) ↔ 와이어 v2(헤더 포함, 문자열 바디, 원문 응답)의 단일 변환점.
// 도구 구현부(mcp.ts)는 와이어 형식을 모른다 — 프로토콜이 바뀌면 여기만 고친다.
export class AuctionBridge implements AuctionTransport {
  constructor(private transport: WireTransport) {}

  get connected(): boolean {
    return this.transport.connected;
  }

  async request(cmd: AuctionCommandInput, timeoutMs?: number): Promise<AuctionReply> {
    const hasBody = cmd.body != null;
    const wire: Omit<WireFetchCommand, 'id'> = {
      type: 'fetch',
      url: cmd.url,
      method: cmd.method,
      headers: { ...auctionHeaders(hasBody), ...(cmd.headers ?? {}) },
      ...(hasBody ? { body: JSON.stringify(cmd.body) } : {}),
      ...(cmd.fanout ? { fanout: true } : {}),
    };
    const w = await this.transport.request(wire, timeoutMs);
    // 구버전 확장의 res.json().catch(()=>null)과 동일한 관용: 비JSON은 null
    const data = w.bodyText != null ? parseJson(w.bodyText) : undefined;
    return w.ok
      ? { id: w.id, ok: true, status: w.status, data }
      : { id: w.id, ok: false, code: w.code, error: w.error, status: w.status, data };
  }

  close(): Promise<void> {
    return this.transport.close?.() ?? Promise.resolve();
  }
}

interface SearchPageQuery {
  page: number;
  limit: 20 | 40 | 60;
  sort: string;
}

// 메이플 옥션 외부 API의 유일한 진입점.
// URL, HTTP 메서드, 쿼리스트링, 요청 바디 형태는 이 클래스 밖으로 새지 않는다.
export class MapleAuctionApi {
  constructor(private transport: AuctionTransport) {}

  get connected(): boolean {
    return this.transport.connected;
  }

  close(): Promise<void> {
    return this.transport.close?.() ?? Promise.resolve();
  }

  // 모든 요청의 단일 관문. 401(세션 죽음)이면 1회 자가복구를 시도한다:
  // 읽기 전용 /accounts를 fanout으로 전 확장에 뿌려 로그인된 확장을 브로커의
  // preferred로 재고정한 뒤, 원 요청을 재시도한다. 세션이 다른 크롬 프로필로
  // 옮겨간 경우(살아있는 preferred가 죽은 세션만 두드리는 갇힘)를 여기서 푼다.
  // 실패한 요청 자체를 fanout하면 안 된다 — 검색 POST(일일 한도 소진)·위시리스트
  // 쓰기가 확장 수만큼 복제된다. 프로브까지 실패하면(어느 확장에도 세션 없음)
  // 원래 에러를 그대로 반환한다 — errorText가 사용자 안내(NO_SESSION_MSG)로 바꾼다.
  private async send(cmd: AuctionCommandInput): Promise<AuctionReply> {
    const reply = await this.transport.request(cmd);
    if (reply.ok || reply.status !== 401 || cmd.fanout) return reply;
    const probe = await this.transport.request({ type: 'fetch', url: `${AUTH_BASE}/accounts`, method: 'GET', fanout: true });
    if (!probe.ok) return reply;
    return this.transport.request(cmd);
  }

  getAccounts(fanout = false): Promise<AuctionReply> {
    return this.send({
      type: 'fetch',
      url: `${AUTH_BASE}/accounts`,
      method: 'GET',
      ...(fanout ? { fanout: true } : {}),
    });
  }

  createWebSession(): Promise<AuctionReply> {
    return this.send({ type: 'fetch', url: `${AUTH_BASE}/auth/web-token/session`, method: 'POST' });
  }

  getWorldCharacters(accountId: number, worldId: number): Promise<AuctionReply> {
    return this.send({
      type: 'fetch',
      url: `${AUTH_BASE}/accounts/${accountId}/gameWorlds/${worldId}/characters`,
      method: 'GET',
    });
  }

  createSearch(body: unknown, sold = false): Promise<AuctionReply> {
    return this.send({ type: 'fetch', url: sold ? SOLD_SEARCH_URL : SEARCH_URL, method: 'POST', body });
  }

  getSearchPage(searchKey: string, query: SearchPageQuery, id: Identity, sold = false): Promise<AuctionReply> {
    const qs = new URLSearchParams({
      page: String(query.page),
      limit: String(query.limit),
      sortType: query.sort,
      accountId: String(id.accountId),
      characterId: String(id.characterId),
    });
    const segment = sold ? 'searches/sold' : 'searches';
    return this.send({
      type: 'fetch',
      url: `${ITEM_API_BASE}/${segment}/${encodeURIComponent(searchKey)}/tool-tip?${qs}`,
      method: 'GET',
    });
  }

  getDailyLimit(): Promise<AuctionReply> {
    return this.send({ type: 'fetch', url: DAILY_LIMIT_URL, method: 'GET' });
  }

  getBalance(id: Identity): Promise<AuctionReply> {
    return this.send({
      type: 'fetch',
      url: `${AUTH_BASE}/accounts/${id.accountId}/gameWorlds/${id.worldId}/balance`,
      method: 'GET',
    });
  }

  getRecentSold(id: Identity): Promise<AuctionReply> {
    return this.send({
      type: 'fetch',
      url: RECENT_SOLD_URL,
      method: 'POST',
      body: { worldId: id.worldId, accountId: id.accountId, characterId: id.characterId },
    });
  }

  getWishlist(id: Identity): Promise<AuctionReply> {
    const qs = new URLSearchParams({
      accountId: String(id.accountId),
      gameWorldId: String(id.worldId),
      characterId: String(id.characterId),
    });
    return this.send({ type: 'fetch', url: `${WISHLIST_URL}?${qs}`, method: 'GET' });
  }

  addWishlist(id: Identity, tradeSn: string, subIdx: number): Promise<AuctionReply> {
    return this.send({
      type: 'fetch',
      url: WISHLIST_URL,
      method: 'POST',
      body: { accountId: id.accountId, gameWorldId: id.worldId, tradeSn, subIdx },
    });
  }

  removeWishlist(id: Identity, tradeSn: string, subIdx: number): Promise<AuctionReply> {
    const qs = new URLSearchParams({
      accountId: String(id.accountId),
      gameWorldId: String(id.worldId),
      tradeSn,
      subIdx: String(subIdx),
    });
    return this.send({ type: 'fetch', url: `${WISHLIST_URL}?${qs}`, method: 'DELETE' });
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
