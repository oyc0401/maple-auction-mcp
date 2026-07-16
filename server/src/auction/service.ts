import {
  buildCreateBody,
  parseItemId,
  type SearchParams,
  type Sort,
  type GetLimit,
} from './mapping.js';
import { DISCONNECTED_MSG } from '@maple/shared';
import {
  NO_SESSION_MSG,
  WISHLIST_MAX,
  type AuctionReply,
  type Identity,
  type MapleAuctionApi,
} from './api.js';
import { summarizeSearch, summarizeItem, summarizeNexonEquip, type SearchSummary } from './summarize.js';
import { listCharacters as listAccountCharacters, discoverIdentity, type CharacterInfo } from './characters.js';
import { getAuctionEquipmentSlots } from '../damage/auctionEquipmentSlot.js';
import type { AuctionItem, AuctionSearchResponse } from './item.js';
import { isAuctionItemWearable } from '../damage/auctionWearable.js';
import { getStatsAfterEquipmentReplacement } from '../damage/equipmentReplacement.js';
import { getFinalDamageChangeRate } from '../damage/finalDamage.js';
import { getEquipmentSlot, type EquipmentSlot } from '../damage/equipmentSlot.js';
import { getAuctionItemStats } from '../damage/stat/gear.js';
import { worldName } from './constants.js';
import { nexonApiKey } from '../nexon/index.js';
import type {
  LoadCharacterSnapshot,
  RefreshCharacterSnapshot,
} from '../characterSnapshot.js';

// 키 설정은 MCP 서버 등록을 다시 해야 해서 AI가 대신 해줄 수 없다 — 사용자가 직접 할 일임을 명시한다
// (주체를 안 밝히면 AI가 자기 일로 해석해 코드/설정 디버깅에 빠진다. shared의 DISCONNECTED_MSG 주석 참고).
const NEXON_KEY_GUIDE =
  '넥슨 오픈 API 키가 설정되지 않았습니다. 사용자에게 아래 2단계를 안내하세요 (AI가 대신 할 수 없음). ' +
  '1) https://openapi.nexon.com 에서 로그인 후 API 키 발급(무료). ' +
  '2) 터미널에서 유저 스코프로 재등록: ' +
  'claude mcp remove maple-auction && claude mcp add --scope user maple-auction -- npx -y maple-auction-mcp --api-key 발급받은키 ' +
  '(Claude Desktop은 claude_desktop_config.json의 args에 "--api-key", "발급받은키" 추가. ' +
  'NEXON_DEVELOPER_KEY 환경변수도 가능. 재등록 후 클라이언트 재시작 필요.) ' +
  '일반 경매장 검색은 키 없이도 동작합니다.';

function nexonOpenApiStatus(): Record<string, unknown> {
  if (nexonApiKey()) return { configured: true };
  return {
    configured: false,
    degradedResults:
      '키가 없는 동안 장비 검색 결과에서 finalDamageChangeRate(최종 데미지 증감률)가 통째로 빠진다. ' +
      '빠진 자리를 전투력(powerDiff)으로 대신하면 비교가 왜곡된다 — 전투력 공식은 방무를 반영하지 않아 ' +
      '방무 매물이 저평가되고 보공 매물이 과대평가된다. user_equip(착용 장비)·refresh_character도 함께 막힌다.',
    setup: {
      issueUrl: 'https://openapi.nexon.com',
      claudeCode:
        'claude mcp remove maple-auction && claude mcp add --scope user maple-auction -- npx -y maple-auction-mcp --api-key 발급받은키',
      claudeDesktop: 'claude_desktop_config.json의 args에 "--api-key", "발급받은키" 추가',
      environmentVariable: 'NEXON_DEVELOPER_KEY',
      afterSetup: '재등록 후 MCP 클라이언트를 재시작해야 적용됩니다.',
    },
    note: NEXON_KEY_GUIDE,
  };
}

function errorText(reply: Extract<AuctionReply, { ok: false }>): string {
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

// MCP 도구 뒤의 애플리케이션 서비스 — 세션 상태(신원·캐시)와 유스케이스를 소유한다.
// 반환 규약: 실패는 한국어 안내 문자열, 성공은 요약 객체 (mcp.ts가 text()로 감싼다).
export class AuctionService {
  private identity: (Identity & { characterName?: string }) | null = null;
  private characters: CharacterInfo[] | null = null;
  private readonly bodyCache = new Map<string, { body: ReturnType<typeof buildCreateBody>; sold: boolean; category?: string }>();
  // 동일 조건(body+sold) → 살아있는 searchKey. 같은 조건 재검색을 POST 없이 재사용해 검색 횟수를 구조적으로 아낀다.
  // (searchKey는 조건만 저장하므로 GET 결과는 항상 실시간 — 재사용해도 낡은 데이터가 아니다)
  private readonly conditionCache = new Map<string, string>();
  constructor(
    private api: MapleAuctionApi,
    private loadCharacterSnapshot: LoadCharacterSnapshot,
    private refreshCharacterSnapshot: RefreshCharacterSnapshot = loadCharacterSnapshot
  ) {}

  private async summarizeSearchWithDamage(
    data: AuctionSearchResponse
  ): Promise<SearchSummary & { finalDamageNote?: string }> {
    const summary = summarizeSearch(data);
    // 부위는 매물 JSON만으로 정한다 — 검색 조건을 보면 이름만으로 검색했을 때 슬롯을 잃는다.
    const rawItems = data.items ?? [];
    const slotsByItem = rawItems.map(getAuctionEquipmentSlots);
    if (!slotsByItem.some((slots) => slots?.length)) return summary;

    const characterName = this.identity?.characterName;
    if (!characterName) {
      return {
        ...summary,
        finalDamageNote: '현재 캐릭터 이름을 알 수 없어 최종 데미지 증감률을 계산하지 못했습니다.',
      };
    }

    try {
      const character = await this.loadCharacterSnapshot(characterName);
      const items = summary.items.map((item, index) => {
        const slots = slotsByItem[index];
        if (!slots?.length) return item;
        const raw = rawItems[index];
        // 못 입는 장비의 증감률은 의미가 없다 — 카데나에게 마법사 스태프가 +26%로 뜨던 버그.
        if (!raw || !isAuctionItemWearable(raw, character.job)) return item;
        const stat = getAuctionItemStats(raw, character.level);
        const finalDamageChangeRate: Partial<Record<EquipmentSlot, number>> = {};
        for (const slot of slots) {
          if (!character.stats.장비?.[slot]) continue;
          const changedStats = getStatsAfterEquipmentReplacement(character.stats, {
            slot,
            name: item.name,
            stat,
          });
          finalDamageChangeRate[slot] = getFinalDamageChangeRate(
            { job: character.job, level: character.level, stats: character.stats },
            changedStats
          );
        }
        return Object.keys(finalDamageChangeRate).length
          ? { ...item, finalDamageChangeRate }
          : item;
      });
      return { ...summary, items };
    } catch (error) {
      if ((error as Error).message.includes('NEXON_DEVELOPER_KEY')) {
        return { ...summary, finalDamageNote: NEXON_KEY_GUIDE };
      }
      return {
        ...summary,
        finalDamageNote: `최종 데미지 증감률 계산 실패: ${(error as Error).message}`,
      };
    }
  }

  private async ensureIdentity(): Promise<Identity | string> {
    if (this.identity) return this.identity;
    const found = await discoverIdentity(this.api);
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
    const dl = await this.api.getDailyLimit();
    return dl.ok ? ((dl.data as any)?.search?.remaining ?? null) : null;
  }

  // 계정 잔액(메소·메이플포인트=메포) 조회. 무료 GET. 실패하면 null.
  // 실측(2026-07-11): 타월드 거래는 메소로 결제하고 메포로 크로스월드 수수료를 뗀다 — 둘 다 노출한다.
  private async fetchBalance(id: Identity): Promise<{ meso: number; maplePoint: number } | null> {
    const r = await this.api.getBalance(id);
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
      const reused = await this.api.getSearchPage(existingKey, { page: 1, limit: 20, sort: 'PRICE_PER_ITEM_ASC' }, id, sold);
      if (reused.ok) {
        const data = reused.data as any;
        const note = ['동일 조건의 기존 검색을 재사용 (검색 횟수 소진 없음)', this.searchNote(data?.total, params)].filter(Boolean).join(' / ');
        return { ...(await this.summarizeSearchWithDamage(data)), searchRemaining: await this.searchRemaining(), note };
      }
      this.conditionCache.delete(condKey);
    }

    const created = await this.api.createSearch(body, sold);
    if (!created.ok) return errorText(created);
    const data = created.data as any;
    if (data?.searchKey) {
      this.bodyCache.set(data.searchKey, { body, sold, category: params.category });
      this.conditionCache.set(condKey, data.searchKey);
    }
    const note = this.searchNote(data?.total, params);
    return { ...(await this.summarizeSearchWithDamage(data)), searchRemaining: await this.searchRemaining(), ...(note ? { note } : {}) };
  }

  async getPage(searchKey: string, page: number, limit: GetLimit, sort: Sort): Promise<unknown> {
    const id = await this.ensureIdentity();
    if (typeof id === 'string') return id;
    const q = { page, limit, sort };
    const cachedEntry = this.bodyCache.get(searchKey);
    const sold = cachedEntry?.sold ?? false;
    // 실측: 결과 500건 초과면 API가 전투력 정렬을 조용히 무시한다 — 정렬됐다고 믿고 읽는 오판 방지
    const pageResult = async (data: unknown) => {
      const summary = await this.summarizeSearchWithDamage(data as AuctionSearchResponse);
      const note =
        sort === 'ATTACK_POWER_DESC' && summary.total > 500
          ? '결과가 500건을 초과해 전투력 정렬이 적용되지 않음 (다른 정렬로 반환될 수 있음)'
          : undefined;
      return { ...summary, ...(note ? { note } : {}) };
    };
    const reply = await this.api.getSearchPage(searchKey, q, id, sold);
    if (reply.ok) {
      return await pageResult(reply.data);
    }

    // searchKey 만료 추정 → 캐시된 조건으로 재검색(POST) 후 해당 페이지 재조회 (라이브/시세 각각의 URL로)
    if (reply.code === 'HTTP_ERROR' && reply.status !== 403) {
      const cached = this.bodyCache.get(searchKey);
      if (cached) {
        const recreated = await this.api.createSearch(cached.body, cached.sold);
        const newKey: string | undefined = recreated.ok ? (recreated.data as any)?.searchKey : undefined;
        if (newKey) {
          this.bodyCache.set(newKey, cached);
          this.conditionCache.set(`${cached.sold ? 'sold' : 'live'}:${JSON.stringify(cached.body)}`, newKey);
          const retry = await this.api.getSearchPage(newKey, q, id, cached.sold);
          if (retry.ok) {
            return await pageResult(retry.data);
          }
        }
      }
    }
    return errorText(reply);
  }

  async userEquip(characterName?: string, slot?: string): Promise<unknown> {
    let name = characterName;
    if (!name) {
      const id = await this.ensureIdentity();
      if (typeof id === 'string') return id;
      name = this.identity?.characterName;
      if (!name) return '현재 캐릭터 이름을 알 수 없습니다. characterName을 지정하거나 set_character로 기준 캐릭터를 정하세요.';
    }
    let snapshot;
    try {
      snapshot = await this.loadCharacterSnapshot(name);
    } catch (error) {
      if ((error as Error).message.includes('NEXON_DEVELOPER_KEY')) return NEXON_KEY_GUIDE;
      return `넥슨 오픈 API 캐릭터 조회 실패: ${(error as Error).message}`;
    }
    const equips: any[] = snapshot.equipment.item_equipment ?? [];
    if (slot) {
      const e = equips.find((x) => x.item_equipment_slot === slot || getEquipmentSlot(x.item_equipment_slot) === slot);
      if (!e) return `slot "${slot}" 장비가 없습니다. 가능한 부위: ${equips.map((x) => getEquipmentSlot(x.item_equipment_slot) ?? x.item_equipment_slot).join(', ')}`;
      return { character: name, ...summarizeNexonEquip(e) };
    }
    return {
      character: name,
      class: snapshot.job,
      level: snapshot.level || undefined,
      items: equips.map((e) => ({
        slot: getEquipmentSlot(e.item_equipment_slot) ?? e.item_equipment_slot,
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
    const reply = await this.api.getRecentSold(id);
    if (!reply.ok) return errorText(reply);
    try {
      return summarizeSearch(reply.data as AuctionSearchResponse);
    } catch {
      return reply.data; // 응답 형태가 검색과 다르면 원본 반환
    }
  }

  // 찜 목록 개수·남은 슬롯을 조회한다(무료 GET). 실패 시 에러 문자열.
  private async wishlistState(id: Identity): Promise<{ count: number; remaining: number; items: AuctionItem[] } | string> {
    const reply = await this.api.getWishlist(id);
    if (!reply.ok) return errorText(reply);
    const items = (reply.data as { items?: AuctionItem[] } | null)?.items ?? [];
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
    const reply = await this.api.addWishlist(id, tradeSn, subIdx);
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
    const reply = await this.api.removeWishlist(id, tradeSn, subIdx);
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
    const result = await listAccountCharacters(this.api);
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
      const result = await listAccountCharacters(this.api);
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
    void this.refreshCharacterSnapshot(c.characterName).catch(() => undefined);
    return { switched: { world: c.worldName, name: c.characterName, level: c.level, characterId: c.characterId } };
  }

  async refreshCharacter(characterName?: string): Promise<unknown> {
    let name = characterName;
    if (!name) {
      const id = await this.ensureIdentity();
      if (typeof id === 'string') return id;
      name = this.identity?.characterName;
      if (!name) return '현재 캐릭터 이름을 알 수 없습니다. characterName을 지정하거나 set_character로 기준 캐릭터를 정하세요.';
    }

    try {
      const snapshot = await this.refreshCharacterSnapshot(name);
      return {
        refreshed: true,
        character: snapshot.name,
        class: snapshot.job,
        level: snapshot.level,
        equipmentCount: snapshot.equipment.item_equipment?.length ?? 0,
      };
    } catch (error) {
      if ((error as Error).message.includes('NEXON_DEVELOPER_KEY')) return NEXON_KEY_GUIDE;
      return `넥슨 오픈 API 캐릭터 재갱신 실패: ${(error as Error).message}`;
    }
  }

  async status(): Promise<unknown> {
    if (!this.api.connected) {
      return { connected: false, state: 'no_extension', nexonOpenApi: nexonOpenApiStatus(), note: DISCONNECTED_MSG };
    }
    const id = await this.ensureIdentity();
    if (typeof id === 'string') {
      return { connected: true, state: 'no_session', identity: null, nexonOpenApi: nexonOpenApiStatus(), note: id };
    }
    const characterName = this.identity?.characterName;
    if (characterName) {
      void this.refreshCharacterSnapshot(characterName).catch(() => undefined);
    }
    // identity는 캐시일 수 있으니 무료 GET으로 세션 생존을 실측한다.
    // 옥션 페이지가 다른 곳에서 새 세션을 만들면 이 세션은 소리 없이 죽는다(단일 활성).
    const dl = await this.api.getDailyLimit();
    if (!dl.ok) {
      return {
        connected: true,
        state: 'session_expired',
        identity: { ...id, worldName: worldName(id.worldId) },
        nexonOpenApi: nexonOpenApiStatus(),
        note: errorText(dl),
      };
    }
    return {
      connected: true,
      state: 'ready',
      identity: { ...id, worldName: worldName(id.worldId) },
      nexonOpenApi: nexonOpenApiStatus(),
      dailyLimit: dl.data,
      balance: await this.fetchBalance(id),
    };
  }
}
