export const BRIDGE_PORT = 29171;

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

// ── 와이어 계층 (AuctionBridge ↔ 브로커 ↔ 확장) ─────────────────────
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
  bodyText: string; // 확장은 JSON 파싱하지 않는다 — 파싱 책임은 서버(AuctionBridge)
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

// 브로커 → MCP 클라이언트로 보내는 상태 통지(확장 연결 유무). id 없는 메시지.
export interface BridgeStatus {
  type: 'bridgeStatus';
  extension: boolean;
}

// 브로커가 클라이언트 소켓으로 보내는 메시지 = 요청 응답(WireReply) 또는 상태 통지.
export type BridgeServerMessage = WireReply | BridgeStatus;
