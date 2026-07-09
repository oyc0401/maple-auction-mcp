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
  // 읽기전용 GET /accounts 를 먼저 시도한다. 브라우저(퍼스트파티)가 이미 세션을 세팅한 정상 케이스에선
  // 여기서 끝나 web-token/session POST 를 아예 타지 않는다.
  // 그 POST 는 세션 토큰을 회전시키는데, 확장(chrome-extension:// 오리진)에서 쏘면 새 쿠키가
  // 크로스사이트/파티션 컨텍스트에서 유실돼 기존 로그인이 풀린다(로그아웃). 그래서 최후수단으로만 쓴다.
  let accRes = await bridge.request({ type: 'fetch', url: `${AUTH_BASE}/accounts`, method: 'GET' });
  if (!accRes.ok && accRes.status === 401) {
    // 세션 미형성(401)일 때만 토큰 교환을 시도한다.
    await bridge.request({ type: 'fetch', url: `${AUTH_BASE}/auth/web-token/session`, method: 'POST' });
    accRes = await bridge.request({ type: 'fetch', url: `${AUTH_BASE}/accounts`, method: 'GET' });
  }
  if (!accRes.ok) {
    const code = accRes.ok ? '' : `[HTTP ${accRes.status ?? '?'}${accRes.code ? '/' + accRes.code : ''}] `;
    return `${code}넥슨 계정 조회에 실패했습니다. 사용자에게 크롬에서 https://nxlogin.nexon.com/auth/login 로그인 상태를 확인해달라고 안내하고 대기하세요.`;
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
