export const BRIDGE_PORT = 29171;
export const API_BASE = 'https://api.mskr.nexon.com/v1/market/web/items';

// 확장↔서버 WS 프로토콜 버전. 메시지 형태가 "깨지는" 변경에만 +1 (아티팩트 버전과 무관).
// 확장과 서버는 배포 채널이 달라(웹스토어 자동 vs npm 수동) 버전 스큐가 상시 상태다 —
// 스큐를 막을 수 없으니 감지해서 명확한 안내로 실패시키는 것이 이 상수의 역할.
export const PROTOCOL_VERSION = 2;

// 확장 → 브로커: WS 접속 직후 1회 보내는 인사. 프로토콜 호환성 판정 근거.
// (이 메시지를 안 보내는 연결은 hello 도입 전 dev 빌드 또는 수신 전 찰나 — 차단하지 않는다)
export interface ExtensionHello {
  type: 'hello';
  protocolVersion: number;
  extensionVersion?: string; // manifest 버전 (진단용)
}

export interface Identity {
  worldId: number;
  accountId: number;
  characterId: number;
}

// ── 내부 계층 (서버 코드 ↔ NexonBridge) ─────────────────────────────
// body는 객체, 헤더 없음. NexonBridge가 와이어로 변환한다.
export interface BridgeCommandInput {
  type: 'fetch';
  url: string;
  method: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  // 요청별 추가 헤더 (예: 구매의 x-transaction-key). nexonHeaders 위에 병합된다.
  headers?: Record<string, string>;
  // 브로커가 모든 확장(프로필)에 뿌려 첫 성공 응답을 preferred로 고정 (구 discover 대체)
  fanout?: boolean;
}

// ── 와이어 계층 (NexonBridge ↔ 브로커 ↔ 확장) ───────────────────────
// 헤더 전체와 직렬화된 바디를 서버가 구성한다. 확장은 실행만 한다.
export interface WireFetchCommand {
  id: string;
  type: 'fetch';
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  fanout?: boolean;
}

export interface WireOk {
  id: string;
  ok: true;
  status: number;
  bodyText: string; // 확장은 JSON 파싱하지 않는다 — 파싱 책임은 서버(NexonBridge)
}

export interface WireErr {
  id: string;
  ok: false;
  code: BridgeErrorCode;
  error: string;
  status?: number;
  bodyText?: string; // HTTP_ERROR일 때 응답 원문 (API code 추출용)
}

export type WireReply = WireOk | WireErr;

// 에러 텍스트는 사용자가 아니라 AI(MCP 클라이언트)가 읽는다. 다음 행동의 주체를 명시할 것:
// 주체 없는 "확인하세요"는 AI가 자기 일로 해석해 코드 디버깅에 빠진다.
export const DISCONNECTED_MSG =
  '크롬 확장이 연결되어 있지 않습니다. ' +
  '확장이 켜져 있다면 30초 내 자동 재연결되니 잠시 후 1회만 재시도하고, 그래도 실패하면 ' +
  '사용자에게 "크롬 실행 + Maple Auction Bridge 확장 활성화" 확인을 안내하고 대기하세요. ' +
  '확장 미설치 시 설치 주소: https://chromewebstore.google.com/detail/maple-auction-mcp/mdjabnokhboicgecmpnggabjfimelfjn';

// 실측(2026-07-10) 세션 모델: web-token 세션은 옥션 페이지 로드가 만들고(확장 SW의 POST는 401 {code:5}로 항상 실패),
// 단일 활성이라 새 세션이 생기면 이전 세션은 즉시 무효(401 {code:12}). 넥슨 SSO 로그인만으로는 세션이 생기지 않는다.
// 그래서 안내는 nxlogin이 아니라 옥션 페이지로 보낸다 — 페이지가 로그인 리다이렉트와 세션 생성을 모두 처리한다.
export const NO_SESSION_MSG =
  '거래소 세션이 없거나 만료되었습니다. 넥슨 로그인만으로는 세션이 생기지 않고, 다른 곳에서 새 세션이 생기면 이전 세션은 무효가 됩니다. ' +
  '사용자에게 크롬에서 https://auction.maplestory.nexon.com 을 열거나 새로고침하라고 안내하고(로그인 페이지가 나오면 로그인), ' +
  '완료됐다고 하면 다시 요청하세요.';

export type BridgeErrorCode =
  | 'DISCONNECTED'       // 확장 미연결 (서버가 생성)
  | 'TIMEOUT'            // 확장 응답 없음 (서버가 생성)
  | 'HTTP_ERROR'         // API가 4xx/5xx (확장이 생성)
  | 'NETWORK'            // fetch 자체 실패 (확장이 생성)
  | 'FORBIDDEN_URL'      // 허용목록(https + *.nexon.com) 위반 (확장이 생성)
  | 'NO_IDENTITY'        // 계정 발견 실패 (서버가 생성)
  | 'PROTOCOL_MISMATCH'; // 확장↔서버 프로토콜 버전 불일치 (서버가 생성)

// 프로토콜 불일치 안내문. 에러 텍스트 독자는 AI — 어느 쪽을 업데이트할지 명시한다.
export function protocolMismatchMsg(extVersion: number): string {
  return extVersion < PROTOCOL_VERSION
    ? `크롬 확장이 구버전입니다(프로토콜 v${extVersion} < 서버 v${PROTOCOL_VERSION}). 사용자에게 크롬 웹스토어에서 Maple Auction MCP 확장 업데이트(chrome://extensions → 개발자 모드 → 업데이트)를 안내하고 대기하세요.`
    : `MCP 서버가 구버전입니다(서버 프로토콜 v${PROTOCOL_VERSION} < 확장 v${extVersion}). 사용자에게 maple-auction MCP 서버 업데이트를 안내하고 대기하세요.`;
}

export interface BridgeOk {
  id: string;
  ok: true;
  status?: number;
  data?: unknown;
}

export interface BridgeErr {
  id: string;
  ok: false;
  code: BridgeErrorCode;
  error: string;
  status?: number;
  data?: unknown;
}

export type BridgeReply = BridgeOk | BridgeErr;

// 브로커 → MCP 클라이언트로 보내는 상태 통지(확장 연결 유무). id 없는 메시지.
export interface BridgeStatus {
  type: 'bridgeStatus';
  extension: boolean;
}

// 브로커가 클라이언트 소켓으로 보내는 메시지 = 요청 응답(WireReply) 또는 상태 통지.
export type BridgeServerMessage = WireReply | BridgeStatus;
