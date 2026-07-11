import { DISCONNECTED_MSG, NO_SESSION_MSG, type BridgeReply, type Identity } from '@maple/shared';
import {
  buildCreateBody,
  buildPageUrl,
  parseItemId,
  buildWishlistGetUrl,
  buildWishlistBody,
  buildWishlistDeleteUrl,
  buildBalanceUrl,
  SEARCH_URL,
  SOLD_SEARCH_URL,
  RECENT_SOLD_URL,
  DAILY_LIMIT_URL,
  WISHLIST_URL,
  WISHLIST_MAX,
  type SearchParams,
  type Sort,
  type GetLimit,
} from './mapping.js';
import { summarizeSearch, summarizeItem, summarizeNexonEquip } from './summarize.js';
import { listCharacters as listAccountCharacters, discoverIdentity, type CharacterInfo } from './characters.js';
import { categoryToSlots, slotLabel } from './hwansan2/index.js';
import { collectCharacter, nexonApiKey, type CharacterCollected } from './damage/nexon.js';
import { buildCombatStats, type CombatStats } from './damage/combat.js';
import { swapDamageDelta } from './damage/delta.js';
import { worldName } from './constants.js';
import type { BridgeLike } from './nexon.js';

const NEXON_KEY_GUIDE =
  '넥슨 오픈 API 키가 설정되지 않아 이 도구를 쓸 수 없습니다. https://openapi.nexon.com 에서 키를 발급받아 ' +
  'MCP 설정의 실행 인자에 --api-key <키> 를 추가하거나 NEXON_DEVELOPER_KEY 환경변수로 지정하세요. (검색 도구는 키 없이 정상 동작)';

function errorText(reply: Extract<BridgeReply, { ok: false }>): string {
  const apiCode = (reply.data as { code?: number } | null)?.code;
  // 401/403 = 세션 문제. 세션은 옥션 페이지만 만들 수 있으므로(shared의 NO_SESSION_MSG 주석 참고)
  // nxlogin이 아니라 옥션 페이지로 안내한다. 구버전 확장이 보낸 낡은 안내문도 여기서 최신 안내로 덮인다.
  if (reply.status === 401 || reply.status === 403) {
    return NO_SESSION_MSG + (apiCode != null ? ` (HTTP ${reply.status}, API code ${apiCode})` : '');
  }
  // 구버전 확장은 상태 코드 없이 nxlogin 로그인 안내를 보낸다 — 그 안내로는 세션이 생기지 않으므로 덮는다.
  if (reply.error.includes('nxlogin')) return NO_SESSION_MSG;
  // 실측(2026-07-10): 결과가 너무 많으면 422 + code 4040으로 검색 자체를 거부한다 (검색 횟수 소진 없음).
  if (reply.status === 422 && apiCode === 4040) {
    return '검색 결과가 너무 많아 거래소가 검색을 거부했습니다 (검색 횟수 소진 없음). 하위 분류(subCategory)나 키워드로 범위를 좁혀 다시 검색하세요.';
  }
  const suffix = apiCode != null ? ` (API code ${apiCode})` : '';
  return `요청 실패 (${reply.code}): ${reply.error}${suffix}`;
}

const RAW_ITEM_CACHE_MAX = 300;

// MCP 도구 뒤의 애플리케이션 서비스 — 세션 상태(신원·캐시)와 유스케이스를 소유한다.
// 반환 규약: 실패는 한국어 안내 문자열, 성공은 요약 객체 (mcp.ts가 text()로 감싼다).
export class AuctionService {
  private identity: (Identity & { characterName?: string }) | null = null;
  private characters: CharacterInfo[] | null = null;
  private readonly bodyCache = new Map<string, { body: ReturnType<typeof buildCreateBody>; sold: boolean; category?: string }>();
  // 동일 조건(body+sold) → 살아있는 searchKey. 같은 조건 재검색을 POST 없이 재사용해 검색 횟수를 구조적으로 아낀다.
  // (searchKey는 조건만 저장하므로 GET 결과는 항상 실시간 — 재사용해도 낡은 데이터가 아니다)
  private readonly conditionCache = new Map<string, string>();
  // 원본 매물 캐시(id → 원본 + 검색 카테고리). item_hwansan이 단일 매물의 부위별 Δ환산을
  // 온디맨드로 계산할 때 쓴다. 검색·페이지 조회가 지날 때마다 채워지고, 상한 초과 시 오래된 것부터 버린다.
  private readonly rawItemCache = new Map<string, { raw: any; category?: string }>();
  constructor(private bridge: BridgeLike) {}

  private cacheRawItems(items: any[] | undefined, category?: string) {
    for (const it of items ?? []) {
      if (!it?._id) continue;
      this.rawItemCache.set(it._id, { raw: it, category });
      if (this.rawItemCache.size > RAW_ITEM_CACHE_MAX) {
        const oldest = this.rawItemCache.keys().next().value;
        if (oldest !== undefined) this.rawItemCache.delete(oldest);
      }
    }
  }

  private async ensureIdentity(): Promise<Identity | string> {
    if (this.identity) return this.identity;
    const found = await discoverIdentity(this.bridge);
    if (typeof found !== 'string') {
      this.identity = found;
      return this.identity;
    }
    const env = process.env.MAPLE_IDENTITY;
    if (env) {
      this.identity = JSON.parse(env) as Identity;
      return this.identity;
    }
    return `계정 정보를 찾지 못했습니다: ${found}`;
  }

  // 남은 일일 검색 생성 횟수 (GET, 무료). 실패하면 null.
  private async searchRemaining(): Promise<number | null> {
    const dl = await this.bridge.request({ type: 'fetch', url: DAILY_LIMIT_URL, method: 'GET' });
    return dl.ok ? ((dl.data as any)?.search?.remaining ?? null) : null;
  }

  // 계정 잔액(메소·메이플포인트=메포) 조회. 무료 GET. 실패하면 null.
  // 실측(2026-07-11): 타월드 거래는 메소로 결제하고 메포로 크로스월드 수수료를 뗀다 — 둘 다 노출한다.
  private async fetchBalance(id: Identity): Promise<{ meso: number; maplePoint: number } | null> {
    const r = await this.bridge.request({ type: 'fetch', url: buildBalanceUrl(id), method: 'GET' });
    if (!r.ok) return null;
    const d = r.data as { meso?: unknown; maplePoint?: unknown } | null;
    const meso = Number(d?.meso);
    const maplePoint = Number(d?.maplePoint);
    if (!Number.isFinite(meso) && !Number.isFinite(maplePoint)) return null;
    return { meso: Number.isFinite(meso) ? meso : 0, maplePoint: Number.isFinite(maplePoint) ? maplePoint : 0 };
  }

  // 결과 특성을 사실로 알려주는 note (행동 지시 아님) — 0건 소진, 무필터 장비 검색의 노작 편중.
  private searchNote(total: number, params: SearchParams): string | undefined {
    if (total === 0) return '조건에 맞는 매물이 0건 (검색 횟수는 소진됨)';
    const isEquip = params.category?.startsWith('WEAPON') || params.category?.startsWith('ARMOR');
    const narrowed =
      params.potentialGrade != null || params.additionalPotentialGrade != null ||
      params.potentialOptions?.length || params.additionalPotentialOptions?.length ||
      params.extraOptions?.length || params.scrollOptions?.length ||
      params.starforceMin != null || params.starforceMax != null ||
      params.priceMin != null || params.priceMax != null ||
      params.remainUpgradeCountMin != null || params.remainUpgradeCountMax != null ||
      params.cuttableCountMin != null || params.cuttableCountMax != null || params.uncuttable != null ||
      params.isBindedWhenEquipped != null || params.isExOptExtractable != null || params.isPotentialExtractable != null ||
      params.seedRingLevelMin != null || params.seedRingLevelMax != null;
    if (isEquip && !narrowed && total > 200) {
      return `필터 없는 장비 검색 ${total}건 — 대부분 노작(미강화·잠재 없음) 매물일 수 있음`;
    }
    return undefined;
  }

  // POST: 세션 생성. 정렬·페이지 선택 없이 가격낮은순 10개만 반환한다. 더 보려면 getPage(GET).
  // sold=true면 판매 완료(시세) 검색. body는 동일하고 URL만 다르다.
  async search(params: SearchParams, sold = false): Promise<unknown> {
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return id;
    const body = buildCreateBody(params, id);

    // 동일 조건의 살아있는 검색이 있으면 POST(소진) 없이 재사용. 만료됐으면 지우고 새로 생성.
    const condKey = `${sold ? 'sold' : 'live'}:${JSON.stringify(body)}`;
    const existingKey = this.conditionCache.get(condKey);
    if (existingKey) {
      const reused = await this.bridge.request({
        type: 'fetch',
        url: buildPageUrl(existingKey, { page: 1, limit: 20, sort: 'PRICE_PER_ITEM_ASC' }, id, sold),
        method: 'GET',
      });
      if (reused.ok) {
        const data = reused.data as any;
        this.cacheRawItems(data?.items, params.category);
        const note = ['동일 조건의 기존 검색을 재사용 (검색 횟수 소진 없음)', this.searchNote(data?.total, params)].filter(Boolean).join(' / ');
        return { ...summarizeSearch(data), searchRemaining: await this.searchRemaining(), note };
      }
      this.conditionCache.delete(condKey);
    }

    const created = await this.bridge.request({ type: 'fetch', url: sold ? SOLD_SEARCH_URL : SEARCH_URL, method: 'POST', body });
    if (!created.ok) return errorText(created);
    const data = created.data as any;
    if (data?.searchKey) {
      this.bodyCache.set(data.searchKey, { body, sold, category: params.category });
      this.conditionCache.set(condKey, data.searchKey);
    }
    this.cacheRawItems(data?.items, params.category);
    const note = this.searchNote(data?.total, params);
    return { ...summarizeSearch(data), searchRemaining: await this.searchRemaining(), ...(note ? { note } : {}) };
  }

  async getPage(searchKey: string, page: number, limit: GetLimit, sort: Sort): Promise<unknown> {
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return id;
    const q = { page, limit, sort };
    const cachedEntry = this.bodyCache.get(searchKey);
    const sold = cachedEntry?.sold ?? false;
    // 실측: 결과 500건 초과면 API가 전투력 정렬을 조용히 무시한다 — 정렬됐다고 믿고 읽는 오판 방지
    const pageResult = (data: unknown) => {
      const summary = summarizeSearch(data);
      const note =
        sort === 'ATTACK_POWER_DESC' && summary.total > 500
          ? '결과가 500건을 초과해 전투력 정렬이 적용되지 않음 (다른 정렬로 반환될 수 있음)'
          : undefined;
      return { ...summary, ...(note ? { note } : {}) };
    };
    const reply = await this.bridge.request({ type: 'fetch', url: buildPageUrl(searchKey, q, id, sold), method: 'GET' });
    if (reply.ok) {
      this.cacheRawItems((reply.data as any)?.items, cachedEntry?.category);
      return pageResult(reply.data);
    }

    // searchKey 만료 추정 → 캐시된 조건으로 재검색(POST) 후 해당 페이지 재조회 (라이브/시세 각각의 URL로)
    if (reply.code === 'HTTP_ERROR' && reply.status !== 403) {
      const cached = this.bodyCache.get(searchKey);
      if (cached) {
        const searchUrl = cached.sold ? SOLD_SEARCH_URL : SEARCH_URL;
        const recreated = await this.bridge.request({ type: 'fetch', url: searchUrl, method: 'POST', body: cached.body });
        const newKey: string | undefined = recreated.ok ? (recreated.data as any)?.searchKey : undefined;
        if (newKey) {
          this.bodyCache.set(newKey, cached);
          this.conditionCache.set(`${cached.sold ? 'sold' : 'live'}:${JSON.stringify(cached.body)}`, newKey);
          const retry = await this.bridge.request({ type: 'fetch', url: buildPageUrl(newKey, q, id, cached.sold), method: 'GET' });
          if (retry.ok) {
            this.cacheRawItems((retry.data as any)?.items, cached.category);
            return pageResult(retry.data);
          }
        }
      }
    }
    return errorText(reply);
  }

  async itemDamage(itemId: string, slot?: string): Promise<unknown> {
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return id;
    return this.computeItemDamage(itemId, slot);
  }

  // 넥슨 캐릭터 조회(TTL 캐시)와 스왑 계산 캐시. CombatStats·스왑 결과는 collectCharacter 결과 객체에
  // 묶어(WeakMap) TTL 갱신 시 자동 무효화된다 (구 swap.ts 캐시 패턴).
  private readonly combatCache = new WeakMap<CharacterCollected, { cs: CombatStats; swaps: Map<string, ReturnType<typeof swapDamageDelta>> }>();

  private async loadCharacter(name: string): Promise<CharacterCollected | string> {
    if (!nexonApiKey()) return NEXON_KEY_GUIDE;
    try {
      return await collectCharacter(name);
    } catch (e) {
      return `넥슨 오픈 API 캐릭터 조회 실패: ${(e as Error).message}`;
    }
  }

  private combatOf(collected: CharacterCollected) {
    let entry = this.combatCache.get(collected);
    if (!entry) {
      entry = { cs: buildCombatStats(collected), swaps: new Map() };
      this.combatCache.set(collected, entry);
    }
    return entry;
  }

  // 단일 매물의 부위별 최종 데미지 증감률(D_after/D_before − 1)을 계산한다.
  // 원본 매물은 직전 검색(search/getPage)이 rawItemCache에 넣어둔 것을 쓴다. 에러는 안내 문자열로 반환.
  private async computeItemDamage(itemId: string, onlySlot?: string): Promise<unknown> {
    const entry = this.rawItemCache.get(itemId);
    if (!entry) {
      return '해당 매물의 원본을 찾을 수 없습니다. 먼저 search_weapon / search_armor / get_page 로 이 매물을 조회한 뒤 그 id로 다시 호출하세요.';
    }
    const slots = categoryToSlots(entry.category);
    if (!slots) {
      return '이 매물은 증감률 비교 대상(장비)이 아니거나 카테고리를 알 수 없습니다. search_weapon / search_armor 로 조회한 매물의 id를 사용하세요.';
    }
    let targetSlots = slots;
    if (onlySlot) {
      targetSlots = slots.filter((s) => slotLabel(s) === onlySlot || s === onlySlot);
      if (!targetSlots.length) {
        return `slot "${onlySlot}" 는 이 매물의 착용 부위가 아닙니다. 가능한 부위: ${slots.map(slotLabel).join(', ')}`;
      }
    }
    const name = this.identity?.characterName;
    if (!name) {
      return '현재 캐릭터 이름을 알 수 없어 증감률을 계산할 수 없습니다. set_character 로 기준 캐릭터를 지정하세요.';
    }
    const collected = await this.loadCharacter(name);
    if (typeof collected === 'string') return collected;
    const { cs, swaps } = this.combatOf(collected);

    const bySlot: Record<string, number> = {};
    const unknown = new Set<string>();
    for (const slot of targetSlots) {
      const key = `${slot}:${itemId}`;
      let r = swaps.get(key);
      if (r === undefined) {
        try { r = swapDamageDelta(collected, cs, slot, entry.raw); } catch { r = null; }
        swaps.set(key, r);
      }
      if (r) {
        bySlot[slotLabel(slot)] = r.delta380;
        for (const u of r.unknown) unknown.add(u);
      }
    }
    return {
      id: itemId,
      name: entry.raw?.itemName ?? null,
      character: name,
      deltaPct: bySlot, // 부위별 최종 데미지 증감률 % (보스 방어율 380% 기준)
      ...(cs.notes.length ? { notes: cs.notes } : {}),
      ...(unknown.size ? { unknown: [...unknown] } : {}),
    };
  }

  async userEquip(characterName?: string, slot?: string): Promise<unknown> {
    let name = characterName;
    if (!name) {
      const id = await this.ensureIdentity();
      if (typeof id === 'string') return id;
      name = this.identity?.characterName;
      if (!name) return '현재 캐릭터 이름을 알 수 없습니다. characterName을 지정하거나 set_character로 기준 캐릭터를 정하세요.';
    }
    const collected = await this.loadCharacter(name);
    if (typeof collected === 'string') return collected;
    const equips: any[] = collected.raw.equip?.item_equipment ?? [];
    if (slot) {
      const e = equips.find((x) => x.item_equipment_slot === slot || slotLabel(x.item_equipment_slot) === slot);
      if (!e) return `slot "${slot}" 장비가 없습니다. 가능한 부위: ${equips.map((x) => slotLabel(x.item_equipment_slot)).join(', ')}`;
      return { character: name, ...summarizeNexonEquip(e) };
    }
    return {
      character: name,
      class: collected.final.characterClass,
      level: collected.final.level || undefined,
      items: equips.map((e) => ({
        slot: slotLabel(e.item_equipment_slot),
        name: e.item_name,
        star: Number(e.starforce) || undefined,
        pot: (e.potential_option_grade as string) || undefined,
        add: (e.additional_potential_option_grade as string) || undefined,
      })),
    };
  }

  async recentSold(): Promise<unknown> {
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return id;
    const body = { worldId: id.worldId, accountId: id.accountId, characterId: id.characterId };
    const reply = await this.bridge.request({ type: 'fetch', url: RECENT_SOLD_URL, method: 'POST', body });
    if (!reply.ok) return errorText(reply);
    try {
      return summarizeSearch(reply.data);
    } catch {
      return reply.data; // 응답 형태가 검색과 다르면 원본 반환
    }
  }

  // 찜 목록 개수·남은 슬롯을 조회한다(무료 GET). 실패 시 에러 문자열.
  private async wishlistState(id: Identity): Promise<{ count: number; remaining: number; items: unknown[] } | string> {
    const reply = await this.bridge.request({ type: 'fetch', url: buildWishlistGetUrl(id), method: 'GET' });
    if (!reply.ok) return errorText(reply);
    const items = ((reply.data as any)?.items ?? []) as unknown[];
    return { count: items.length, remaining: Math.max(0, WISHLIST_MAX - items.length), items };
  }

  async getWishlist(): Promise<unknown> {
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return id;
    const st = await this.wishlistState(id);
    if (typeof st === 'string') return st;
    return { count: st.count, remainingSlots: st.remaining, max: WISHLIST_MAX, items: st.items.map(summarizeItem) };
  }

  async addWishlist(itemId: string): Promise<unknown> {
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return id;
    const { tradeSn, subIdx } = parseItemId(itemId);
    const reply = await this.bridge.request({
      type: 'fetch',
      url: WISHLIST_URL,
      method: 'POST',
      body: buildWishlistBody(id, tradeSn, subIdx),
    });
    if (!reply.ok) return errorText(reply);
    const st = await this.wishlistState(id);
    return {
      added: true,
      tradeSn,
      subIdx,
      remainingSlots: typeof st === 'string' ? undefined : st.remaining,
      max: WISHLIST_MAX,
    };
  }

  async removeWishlist(itemId: string): Promise<unknown> {
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return id;
    const { tradeSn, subIdx } = parseItemId(itemId);
    const reply = await this.bridge.request({
      type: 'fetch',
      url: buildWishlistDeleteUrl(id, tradeSn, subIdx),
      method: 'DELETE',
    });
    if (!reply.ok) return errorText(reply);
    const st = await this.wishlistState(id);
    return {
      removed: true,
      tradeSn,
      subIdx,
      remainingSlots: typeof st === 'string' ? undefined : st.remaining,
      max: WISHLIST_MAX,
    };
  }

  async listCharacters(): Promise<unknown> {
    const result = await listAccountCharacters(this.bridge);
    if (typeof result === 'string') return result;
    this.characters = result;
    const current = this.identity?.characterId;
    return result.map((c) => ({
      world: c.worldName,
      name: c.characterName,
      level: c.level,
      characterId: c.characterId,
      current: c.characterId === current || undefined,
    }));
  }

  async setCharacter(characterName?: string, characterId?: number): Promise<unknown> {
    if (!characterName && !characterId) return 'characterName 또는 characterId를 지정하세요.';
    if (!this.characters) {
      const result = await listAccountCharacters(this.bridge);
      if (typeof result === 'string') return result;
      this.characters = result;
    }
    const matches = this.characters.filter(
      (c) => (characterId ? c.characterId === characterId : true) && (characterName ? c.characterName === characterName : true)
    );
    if (!matches.length) {
      return `일치하는 캐릭터가 없습니다. list_characters로 목록을 확인하세요.`;
    }
    if (matches.length > 1) {
      return {
        note: '이름이 여러 캐릭터와 일치합니다. characterId로 지정하세요.',
        candidates: matches.map((c) => ({ world: c.worldName, name: c.characterName, level: c.level, characterId: c.characterId })),
      };
    }
    const c = matches[0];
    this.identity = { worldId: c.worldId, accountId: c.accountId, characterId: c.characterId, characterName: c.characterName };
    return { switched: { world: c.worldName, name: c.characterName, level: c.level, characterId: c.characterId } };
  }

  async status(): Promise<unknown> {
    if (!this.bridge.connected) {
      return { connected: false, state: 'no_extension', note: DISCONNECTED_MSG };
    }
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return { connected: true, state: 'no_session', identity: null, note: id };
    // identity는 캐시일 수 있으니 무료 GET으로 세션 생존을 실측한다.
    // 옥션 페이지가 다른 곳에서 새 세션을 만들면 이 세션은 소리 없이 죽는다(단일 활성).
    const dl = await this.bridge.request({ type: 'fetch', url: DAILY_LIMIT_URL, method: 'GET' });
    if (!dl.ok) {
      return {
        connected: true,
        state: 'session_expired',
        identity: { ...id, worldName: worldName(id.worldId) },
        note: errorText(dl),
      };
    }
    return {
      connected: true,
      state: 'ready',
      identity: { ...id, worldName: worldName(id.worldId) },
      dailyLimit: dl.data,
      balance: await this.fetchBalance(id),
    };
  }
}
