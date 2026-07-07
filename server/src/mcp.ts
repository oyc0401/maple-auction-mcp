import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BridgeCommand, BridgeReply, Identity } from '@maple/shared';
import { buildCreateBody, buildPageUrl, SEARCH_URL, DAILY_LIMIT_URL, SORTS, type SearchParams, type Sort, type GetLimit } from './mapping.js';
import { summarizeSearch } from './summarize.js';


export interface BridgeLike {
  readonly connected: boolean;
  request(cmd: Omit<BridgeCommand, 'id'>, timeoutMs?: number): Promise<BridgeReply>;
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 1) }] };
}

function errorText(reply: Extract<BridgeReply, { ok: false }>): string {
  if (reply.status === 403) {
    return '넥슨 로그인이 필요합니다. 크롬에서 https://nxlogin.nexon.com/auth/login 에 접속해 로그인한 뒤 다시 시도하세요.';
  }
  return `요청 실패 (${reply.code}): ${reply.error}`;
}

export function createServer(bridge: BridgeLike): McpServer {
  const server = new McpServer({ name: 'maple-auction', version: '0.1.0' });

  let identity: Identity | null = null;
  const bodyCache = new Map<string, ReturnType<typeof buildCreateBody>>();

  async function ensureIdentity(): Promise<Identity | string> {
    if (identity) return identity;
    const reply = await bridge.request({ type: 'discover' });
    if (reply.ok && reply.data) {
      identity = reply.data as Identity;
      return identity;
    }
    const env = process.env.MAPLE_IDENTITY;
    if (env) {
      identity = JSON.parse(env) as Identity;
      return identity;
    }
    return reply.ok
      ? '계정 정보를 찾지 못했습니다.'
      : `계정 정보를 찾지 못했습니다: ${errorText(reply)}`;
  }

  // 남은 일일 검색 생성 횟수 (GET, 무료). 실패하면 null.
  async function searchRemaining(): Promise<number | null> {
    const dl = await bridge.request({ type: 'fetch', url: DAILY_LIMIT_URL, method: 'GET' });
    return dl.ok ? ((dl.data as any)?.search?.remaining ?? null) : null;
  }

  // POST: 세션 생성. 정렬·페이지 선택 없이 가격낮은순 10개만 반환한다. 더 보려면 get_page(GET).
  async function runSearch(params: SearchParams) {
    const id = await ensureIdentity();
    if (typeof id === 'string') return text(id);
    const body = buildCreateBody(params, id);
    const created = await bridge.request({ type: 'fetch', url: SEARCH_URL, method: 'POST', body });
    if (!created.ok) return text(errorText(created));
    const data = created.data as any;
    if (data?.searchKey) bodyCache.set(data.searchKey, body);
    return text({ ...summarizeSearch(data), searchRemaining: await searchRemaining() });
  }

  server.registerTool(
    'search_items',
    {
      title: '거래소 아이템 검색 (세션 생성)',
      description:
        '메이플스토리 거래소에서 아이템을 검색한다. 가격 낮은순 10개(1페이지)와 searchKey를 반환한다. 더 많은 결과·다른 정렬·다음 페이지가 필요하면 이 searchKey로 get_page를 호출한다(get_page는 검색 횟수를 소진하지 않음). 이 검색 자체는 일일 검색 횟수를 1회 소진한다.',
      inputSchema: {
        keyword: z.string().describe('아이템 이름 검색어'),
        exactMatch: z.boolean().optional().describe('정확히 일치 (기본 false)'),
        category: z.string().optional().describe("카테고리. 검증된 값: 'WEAPON'"),
        potentialGrade: z.number().int().min(0).max(4).optional().describe('잠재등급: 0없음 1레어 2에픽 3유니크 4레전드리'),
      },
    },
    async (params) => runSearch(params as SearchParams)
  );

  server.registerTool(
    'get_page',
    {
      title: '검색 결과 페이지 조회 (정렬/페이지네이션)',
      description:
        'search_items가 반환한 searchKey로 원하는 정렬·페이지·크기의 결과를 조회한다. GET만 사용하므로 일일 검색 횟수를 소진하지 않는다. 응답의 hasNext가 true면 page를 늘려 다음 페이지를 볼 수 있다. 키가 만료됐으면 같은 조건으로 자동 재검색(이때만 검색 1회 소진).',
      inputSchema: {
        searchKey: z.string().describe('search_items 응답의 searchKey'),
        page: z.number().int().min(1).default(1).describe('페이지 번호 (1부터)'),
        limit: z
          .union([z.literal(20), z.literal(40), z.literal(60)])
          .default(20)
          .describe('페이지 크기. 20 / 40 / 60만 허용'),
        sort: z
          .enum(SORTS)
          .default('PRICE_PER_ITEM_ASC')
          .describe(
            'ITEM_NAME_ASC(이름순) / PRICE_PER_ITEM_ASC(개당 낮은가격) / PRICE_DESC(높은가격) / ATTACK_POWER_DESC(전투력증가량 높은순) / END_DATE_ASC(판매종료 임박순) / REGISTER_DATE_DESC(최신등록순)'
          ),
      },
    },
    async ({ searchKey, page, limit, sort }) => {
      const id = await ensureIdentity();
      if (typeof id === 'string') return text(id);
      const q = { page, limit: limit as GetLimit, sort: sort as Sort };
      const reply = await bridge.request({ type: 'fetch', url: buildPageUrl(searchKey, q, id), method: 'GET' });
      if (reply.ok) return text(summarizeSearch(reply.data));

      // searchKey 만료 추정 → 캐시된 조건으로 재검색(POST) 후 해당 페이지 재조회
      if (reply.code === 'HTTP_ERROR' && reply.status !== 403) {
        const cached = bodyCache.get(searchKey);
        if (cached) {
          const recreated = await bridge.request({ type: 'fetch', url: SEARCH_URL, method: 'POST', body: cached });
          const newKey: string | undefined = recreated.ok ? (recreated.data as any)?.searchKey : undefined;
          if (newKey) {
            bodyCache.set(newKey, cached);
            const retry = await bridge.request({ type: 'fetch', url: buildPageUrl(newKey, q, id), method: 'GET' });
            if (retry.ok) return text(summarizeSearch(retry.data));
          }
        }
      }
      return text(errorText(reply));
    }
  );

  server.registerTool(
    'get_status',
    {
      title: '연결 상태 확인',
      description: '크롬 확장 연결 및 넥슨 계정 상태를 확인한다.',
      inputSchema: {},
    },
    async () => {
      if (!bridge.connected) {
        return text('크롬 확장이 연결되어 있지 않습니다. 크롬이 실행 중이고 Maple Auction Bridge 확장이 켜져 있는지 확인하세요.');
      }
      const id = await ensureIdentity();
      if (typeof id === 'string') return text({ connected: true, identity: null, note: id });
      const dl = await bridge.request({ type: 'fetch', url: DAILY_LIMIT_URL, method: 'GET' });
      return text({ connected: true, identity: id, dailyLimit: dl.ok ? dl.data : undefined });
    }
  );

  return server;
}
