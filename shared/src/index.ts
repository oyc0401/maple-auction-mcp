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
  method: 'GET' | 'POST';
  body?: unknown;
}

export interface DiscoverCommand {
  id: string;
  type: 'discover';
}

export type BridgeCommand = FetchCommand | DiscoverCommand;

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
