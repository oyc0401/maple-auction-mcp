import type { BridgeReply, FetchCommand } from '@maple/shared';

export async function executeFetch(cmd: FetchCommand, fetchFn: typeof fetch = fetch): Promise<BridgeReply> {
  try {
    const res = await fetchFn(cmd.url, {
      method: cmd.method,
      credentials: 'include',
      headers: cmd.body != null ? { 'Content-Type': 'application/json' } : undefined,
      body: cmd.body != null ? JSON.stringify(cmd.body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { id: cmd.id, ok: false, code: 'HTTP_ERROR', status: res.status, error: `HTTP ${res.status}`, data };
    }
    return { id: cmd.id, ok: true, status: res.status, data };
  } catch (e) {
    return { id: cmd.id, ok: false, code: 'NETWORK', error: String(e) };
  }
}

const AUTH_BASE = 'https://api.mskr.nexon.com/v1';
export const LOGIN_GUIDE =
  '넥슨에 로그인되어 있지 않습니다. 크롬에서 https://nxlogin.nexon.com/auth/login 에 접속해 로그인한 뒤 다시 시도하세요.';

// 실측(2026-07-08): 존재하는 월드는 200 + characters[], 없는 월드는 500 {code:2}.
// 확정 월드 ID(웹 거래소 번들 실측): 0스카니아 1베라 3루나 4제니스 5크로아 10유니온 16엘리시움
// 29이노시스 43레드 44오로라 45에오스 46헬리오스 48챌린저스2 49챌린저스 50아케인 51노바 52챌린저스3 54챌린저스4
// + 신규 월드 대비 여유 범위를 함께 훑는다.
const WORLD_CANDIDATES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 29, 30,
  40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
];

interface FoundCharacter {
  worldId: number;
  accountId: number;
  characterId: number;
  characterName: string;
  level: number;
}

// 발견 체인(실측): POST /auth/web-token/session → GET /accounts → GET /accounts/{id}/gameWorlds/{w}/characters
// 여러 계정·월드에 캐릭터가 있으면 최고 레벨 캐릭터를 선택한다.
export async function discoverIdentity(fetchFn: typeof fetch = fetch): Promise<BridgeReply> {
  try {
    await fetchFn(`${AUTH_BASE}/auth/web-token/session`, { method: 'POST', credentials: 'include' });
    const accRes = await fetchFn(`${AUTH_BASE}/accounts`, { credentials: 'include' });
    if (!accRes.ok) {
      return { id: '', ok: false, code: 'NO_IDENTITY', status: accRes.status, error: LOGIN_GUIDE };
    }
    const { accounts } = (await accRes.json()) as { accounts?: { accountId: number }[] };
    if (!accounts?.length) {
      return { id: '', ok: false, code: 'NO_IDENTITY', error: LOGIN_GUIDE };
    }

    const found: FoundCharacter[] = [];
    for (const acc of accounts) {
      await Promise.allSettled(
        WORLD_CANDIDATES.map(async (worldId) => {
          const r = await fetchFn(`${AUTH_BASE}/accounts/${acc.accountId}/gameWorlds/${worldId}/characters`, {
            credentials: 'include',
          });
          if (!r.ok) return;
          const { characters } = (await r.json()) as {
            characters?: { characterId: number; characterName: string; level?: number }[];
          };
          for (const c of characters ?? []) {
            found.push({
              worldId,
              accountId: acc.accountId,
              characterId: c.characterId,
              characterName: c.characterName,
              level: c.level ?? 0,
            });
          }
        })
      );
    }

    if (!found.length) {
      return { id: '', ok: false, code: 'NO_IDENTITY', error: '이 넥슨 계정에서 메이플 캐릭터를 찾지 못했습니다.' };
    }
    found.sort((a, b) => b.level - a.level);
    const best = found[0];
    return {
      id: '',
      ok: true,
      data: {
        worldId: best.worldId,
        accountId: best.accountId,
        characterId: best.characterId,
        characterName: best.characterName,
      },
    };
  } catch (e) {
    return { id: '', ok: false, code: 'NO_IDENTITY', error: `계정 발견 실패: ${String(e)}. ${LOGIN_GUIDE}` };
  }
}
