import type { Identity } from '@maple/shared';
import type { BridgeLike } from './mcp.js';
import { KNOWN_WORLD_IDS, worldName } from './constants.js';

const AUTH_BASE = 'https://api.mskr.nexon.com/v1';

export interface CharacterInfo extends Identity {
  characterName: string;
  level: number;
  worldName: string;
}

// 계정의 모든 캐릭터를 월드별로 조회한다 (검색 횟수 소진 없음 — 전부 인증 API GET).
// 확장의 discover와 같은 체인이지만 서버에서 수행해 전체 목록을 얻는다.
export async function listCharacters(bridge: BridgeLike): Promise<CharacterInfo[] | string> {
  await bridge.request({ type: 'fetch', url: `${AUTH_BASE}/auth/web-token/session`, method: 'POST' });
  const accRes = await bridge.request({ type: 'fetch', url: `${AUTH_BASE}/accounts`, method: 'GET' });
  if (!accRes.ok) {
    return '넥슨 계정 조회에 실패했습니다. 크롬에서 https://nxlogin.nexon.com/auth/login 로그인 상태를 확인하세요.';
  }
  const accounts = ((accRes.data as any)?.accounts ?? []) as { accountId: number }[];
  if (!accounts.length) return '이 넥슨 계정에 메이플 계정이 없습니다.';

  const found: CharacterInfo[] = [];
  for (const acc of accounts) {
    const replies = await Promise.all(
      KNOWN_WORLD_IDS.map(async (worldId) => ({
        worldId,
        reply: await bridge.request({
          type: 'fetch',
          url: `${AUTH_BASE}/accounts/${acc.accountId}/gameWorlds/${worldId}/characters`,
          method: 'GET',
        }),
      }))
    );
    for (const { worldId, reply } of replies) {
      if (!reply.ok) continue; // 캐릭터 없는 월드는 500
      const chars = ((reply.data as any)?.characters ?? []) as {
        characterId: number;
        characterName: string;
        level?: number;
      }[];
      for (const c of chars) {
        found.push({
          worldId,
          worldName: worldName(worldId),
          accountId: acc.accountId,
          characterId: c.characterId,
          characterName: c.characterName,
          level: c.level ?? 0,
        });
      }
    }
  }
  if (!found.length) return '이 넥슨 계정에서 메이플 캐릭터를 찾지 못했습니다.';
  found.sort((a, b) => b.level - a.level);
  return found;
}
