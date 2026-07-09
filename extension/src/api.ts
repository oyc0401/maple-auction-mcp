import { NO_SESSION_MSG, type BridgeReply, type FetchCommand } from '@maple/shared';

// api.mskr.nexon.com은 실제 웹 거래소가 보내는 클라이언트 식별 헤더를 요구한다.
// 이게 없으면 서버가 426(Upgrade Required)로 튕긴다(쿠키가 유효해도). docs/API.md의 "필수/주요 요청 헤더" 참고.
// origin/referer는 fetch가 설정 금지(forbidden header)라 못 넣지만, 확장은 host 권한으로 CORS를 우회하므로
// 서버측 게이트를 통과시키는 x-platform / x-device-id / accept만 실어주면 된다.
let DEVICE_ID = '';
function deviceId(): string {
  if (!DEVICE_ID) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    DEVICE_ID = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }
  return DEVICE_ID;
}
export function nexonHeaders(hasBody = false): Record<string, string> {
  const h: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    'x-platform': 'PC_WEB',
    'x-device-id': deviceId(),
    // 이게 없으면 서버가 426(Upgrade Required)로 튕긴다. 웹 거래소가 보내는 실측값(2026-07-09).
    'x-client-version': '1.0.1',
  };
  if (hasBody) h['Content-Type'] = 'application/json';
  return h;
}

export async function executeFetch(cmd: FetchCommand, fetchFn: typeof fetch = fetch): Promise<BridgeReply> {
  try {
    const res = await fetchFn(cmd.url, {
      method: cmd.method,
      credentials: 'include',
      headers: nexonHeaders(cmd.body != null),
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

// 발견 체인(실측): GET /accounts → GET /accounts/{id}/gameWorlds/{w}/characters
// 여러 계정·월드에 캐릭터가 있으면 최고 레벨 캐릭터를 선택한다.
// web-token 세션은 옥션 페이지만 만들 수 있다(확장 SW의 POST /auth/web-token/session은 401 {code:5}로 항상 실패,
// 실측 2026-07-10). 게다가 세션은 단일 활성이라 확장이 세션을 만들면 사용자가 열어둔 옥션 탭을 로그아웃시킨다.
// 그래서 확장은 세션 생성을 시도하지 않고, 페이지가 만든 세션 쿠키에 얹혀서만 동작한다.
export async function discoverIdentity(fetchFn: typeof fetch = fetch): Promise<BridgeReply> {
  try {
    const accRes = await fetchFn(`${AUTH_BASE}/accounts`, { credentials: 'include', headers: nexonHeaders() });
    if (!accRes.ok) {
      const apiCode = ((await accRes.json().catch(() => null)) as { code?: number } | null)?.code;
      const suffix = apiCode != null ? ` (HTTP ${accRes.status}, API code ${apiCode})` : ` (HTTP ${accRes.status})`;
      return { id: '', ok: false, code: 'NO_IDENTITY', status: accRes.status, error: NO_SESSION_MSG + suffix };
    }
    const { accounts } = (await accRes.json()) as { accounts?: { accountId: number }[] };
    if (!accounts?.length) {
      return { id: '', ok: false, code: 'NO_IDENTITY', error: NO_SESSION_MSG };
    }

    const found: FoundCharacter[] = [];
    for (const acc of accounts) {
      await Promise.allSettled(
        WORLD_CANDIDATES.map(async (worldId) => {
          const r = await fetchFn(`${AUTH_BASE}/accounts/${acc.accountId}/gameWorlds/${worldId}/characters`, {
            credentials: 'include',
            headers: nexonHeaders(),
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
    return { id: '', ok: false, code: 'NO_IDENTITY', error: `계정 발견 실패: ${String(e)}. ${NO_SESSION_MSG}` };
  }
}
