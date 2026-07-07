export const BRIDGE_PORT = 29171;
export const API_BASE = 'https://api.mskr.nexon.com/v1/market/web/items';

export interface Identity {
  worldId: number;
  accountId: number;
  characterId: number;
}

export interface FetchCommand {
  id: string;
  type: 'fetch';
  url: string;
  method: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

export interface DiscoverCommand {
  id: string;
  type: 'discover';
}

export type BridgeCommand = FetchCommand | DiscoverCommand;

// Omit은 유니온에 분배되지 않으므로(id 제거 시 url 등이 사라짐) 명시적으로 분배한 입력 타입
export type BridgeCommandInput = Omit<FetchCommand, 'id'> | Omit<DiscoverCommand, 'id'>;

export type BridgeErrorCode =
  | 'DISCONNECTED' // 확장 미연결 (서버가 생성)
  | 'TIMEOUT'      // 확장 응답 없음 (서버가 생성)
  | 'HTTP_ERROR'   // API가 4xx/5xx (확장이 생성)
  | 'NETWORK'      // fetch 자체 실패 (확장이 생성)
  | 'NO_IDENTITY'; // 계정 발견 실패 (확장이 생성)

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
