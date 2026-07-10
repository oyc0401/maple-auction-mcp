import type { WireFetchCommand, WireReply } from '@maple/shared';

// ===== 이 파일이 확장의 전부다: 서버가 구성한 fetch를 실행하는 배관 =====
// API 지식(헤더 이름·값, 엔드포인트, 발견 플로우, 안내문)은 전부 MCP 서버(npm)에 있다.
// 여기 남는 것은 바뀌지 않는 보안 불변식뿐 — 그래서 웹스토어 재심사가 필요 없다.
//
// 보안 불변식:
// 1. https + 허용 호스트만 실행 (manifest host_permissions와 동일 범위, 그 외 확대 금지):
//    - *.nexon.com    — 거래소 API. 넥슨 로그인 세션 쿠키로 호출
//    - *.maplescouter.com — 공개 환산 계산기. 서버 직접 fetch가 Cloudflare 봇 차단(403)되어 브라우저 경유가 필요
// 2. 쿠키 비접촉 — credentials:'include'로 브라우저가 붙일 뿐, 값을 읽거나 전송하지 않는다
// 3. 헤더는 서버가 구성 — Cookie/Origin/Referer 등 금지 헤더는 브라우저 fetch가 원천 차단
// 4. 응답은 상태 코드 + 원문 텍스트만 — 해석(JSON 파싱·안내문)은 서버 몫

const ALLOWED_HOSTS = ['nexon.com', 'maplescouter.com'];

function allowed(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

export async function executeFetch(cmd: WireFetchCommand, fetchFn: typeof fetch = fetch): Promise<WireReply> {
  if (!allowed(cmd.url)) {
    return { id: cmd.id, ok: false, code: 'FORBIDDEN_URL', error: `허용되지 않은 URL: ${cmd.url}` };
  }
  try {
    const res = await fetchFn(cmd.url, {
      method: cmd.method,
      credentials: 'include',
      headers: cmd.headers,
      body: cmd.body,
    });
    const bodyText = await res.text();
    if (!res.ok) {
      return { id: cmd.id, ok: false, code: 'HTTP_ERROR', status: res.status, error: `HTTP ${res.status}`, bodyText };
    }
    return { id: cmd.id, ok: true, status: res.status, bodyText };
  } catch (e) {
    return { id: cmd.id, ok: false, code: 'NETWORK', error: String(e) };
  }
}
