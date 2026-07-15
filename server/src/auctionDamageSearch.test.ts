import { describe, expect, it, vi } from 'vitest';
import { AuctionService } from './auction.js';
import type { BridgeLike } from './nexon.js';
import type { ItemEquipmentRes } from './nexon/types.js';

describe('AuctionService 장비 검색 최종 데미지 자동 계산', () => {
  it('반지 매물 하나에 네 슬롯의 증감률을 함께 반환하고 0과 음수도 보존한다', async () => {
    const bridge: BridgeLike = {
      connected: true,
      request: vi.fn(async (command) => {
        if (command.url.includes('/daily-limit')) {
          return {
            id: 'daily',
            ok: true as const,
            status: 200,
            data: { search: { limit: 100, remaining: 99 } },
          };
        }
        return {
          id: 'search',
          ok: true as const,
          status: 201,
          data: {
            items: [
              {
                _id: 'ring:1',
                itemName: '새 링',
                quantity: 1,
                pricePerItem: '1000000000',
                starforce: 22,
                wishlistCount: 0,
                endDate: '2026-07-17T00:00:00.000Z',
                status: 'ON_SALE',
                toolTip: {
                  stat: { luk: 100, pad: 20 },
                  upgradeInfo: {
                    potential: { entries: [] },
                    additionalPotential: { entries: [] },
                  },
                },
              },
            ],
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            searchKey: 'ring-search',
          },
        };
      }),
    };
    const loadCharacterSnapshot = vi.fn(async () => ({
      name: '테스트캐릭터',
      job: '카데나',
      level: 270,
      stats: {
        기본: { 공격력: 100, 방무: [100] },
        AP: { LUK: 1000, DEX: 100, STR: 100 },
        장비: {
          반지1: { name: '현재 링1', stat: { LUK: 100, 공격력: 20 } },
          반지2: { name: '현재 링2', stat: { LUK: 50, 공격력: 10 } },
          반지3: { name: '현재 링3', stat: { LUK: 200, 공격력: 40 } },
          반지4: { name: '현재 링4', stat: { LUK: 100, 공격력: 20 } },
        },
        세트효과: {},
      },
      equipment: { item_equipment: [] } as unknown as ItemEquipmentRes,
    }));
    const service = new AuctionService(bridge, loadCharacterSnapshot);
    (service as unknown as { identity: unknown }).identity = {
      worldId: 5,
      accountId: 1,
      characterId: 2,
      characterName: '테스트캐릭터',
    };

    const result = (await service.search({
      category: 'ARMOR_ACCESSORY_RING',
    })) as {
      items: Array<{
        finalDamageChangeRate?: Record<string, number>;
      }>;
      damageCharacter?: unknown;
    };

    expect(loadCharacterSnapshot).toHaveBeenCalledOnce();
    expect(loadCharacterSnapshot).toHaveBeenCalledWith('테스트캐릭터');
    expect(result).not.toHaveProperty('damageCharacter');
    expect(result.items[0].finalDamageChangeRate).toEqual({
      반지1: 0,
      반지2: expect.any(Number),
      반지3: expect.any(Number),
      반지4: 0,
    });
    expect(result.items[0].finalDamageChangeRate?.반지2).toBeGreaterThan(0);
    expect(result.items[0].finalDamageChangeRate?.반지3).toBeLessThan(0);
  });

  it('소비 아이템 검색은 캐릭터를 조회하지 않고 증감률 필드를 만들지 않는다', async () => {
    const bridge: BridgeLike = {
      connected: true,
      request: vi.fn(async (command) => {
        if (command.url.includes('/daily-limit')) {
          return {
            id: 'daily',
            ok: true as const,
            status: 200,
            data: { search: { limit: 100, remaining: 99 } },
          };
        }
        return {
          id: 'search',
          ok: true as const,
          status: 201,
          data: {
            items: [
              {
                _id: 'consume:1',
                itemName: '영원한 환생의 불꽃',
                quantity: 1,
                pricePerItem: '10000000',
                starforce: 0,
                wishlistCount: 0,
                endDate: '2026-07-17T00:00:00.000Z',
                status: 'ON_SALE',
                toolTip: {},
              },
            ],
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            searchKey: 'consume-search',
          },
        };
      }),
    };
    const loadCharacterSnapshot = vi.fn();
    const service = new AuctionService(bridge, loadCharacterSnapshot);
    (service as unknown as { identity: unknown }).identity = {
      worldId: 5,
      accountId: 1,
      characterId: 2,
      characterName: '테스트캐릭터',
    };

    const result = (await service.search({ category: 'CONSUME_SCROLL_FLAME' })) as {
      items: Array<Record<string, unknown>>;
    };

    expect(loadCharacterSnapshot).not.toHaveBeenCalled();
    expect(result.items[0]).not.toHaveProperty('finalDamageChangeRate');
  });

  it('캐릭터 조회에 실패해도 경매장 아이템은 반환하고 실패 이유를 명시한다', async () => {
    const bridge: BridgeLike = {
      connected: true,
      request: vi.fn(async (command) => {
        if (command.url.includes('/daily-limit')) {
          return {
            id: 'daily',
            ok: true as const,
            status: 200,
            data: { search: { limit: 100, remaining: 99 } },
          };
        }
        return {
          id: 'search',
          ok: true as const,
          status: 201,
          data: {
            items: [
              {
                _id: 'weapon:1',
                itemName: '테스트 체인',
                quantity: 1,
                pricePerItem: '1000000000',
                starforce: 22,
                wishlistCount: 0,
                endDate: '2026-07-17T00:00:00.000Z',
                status: 'ON_SALE',
                toolTip: { stat: { luk: 100, pad: 500 } },
              },
            ],
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
            hasNext: false,
            searchKey: 'weapon-search',
          },
        };
      }),
    };
    const loadCharacterSnapshot = vi.fn(async () => {
      throw new Error('NEXON_DEVELOPER_KEY 미설정');
    });
    const service = new AuctionService(bridge, loadCharacterSnapshot);
    (service as unknown as { identity: unknown }).identity = {
      worldId: 5,
      accountId: 1,
      characterId: 2,
      characterName: '테스트캐릭터',
    };

    const result = (await service.search({
      category: 'WEAPON_ONE_HANDED_CHAIN',
    })) as {
      items: Array<Record<string, unknown>>;
      finalDamageNote?: string;
    };

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).not.toHaveProperty('finalDamageChangeRate');
    expect(result.finalDamageNote).toContain('--api-key YOUR_NEXON_API_KEY');
  });

  it('get_page로 가져온 장비에도 같은 증감률 필드를 붙인다', async () => {
    const bridge: BridgeLike = {
      connected: true,
      request: vi.fn(async () => ({
        id: 'page',
        ok: true as const,
        status: 200,
        data: {
          items: [
            {
              _id: 'glove:1',
              itemName: '테스트 장갑',
              quantity: 1,
              pricePerItem: '1000000000',
              starforce: 22,
              wishlistCount: 0,
              endDate: '2026-07-17T00:00:00.000Z',
              status: 'ON_SALE',
              toolTip: { stat: { luk: 200, pad: 30 } },
            },
          ],
          page: 2,
          limit: 20,
          total: 21,
          totalPages: 2,
          hasNext: false,
          searchKey: 'glove-search',
        },
      })),
    };
    const loadCharacterSnapshot = vi.fn(async () => ({
      name: '테스트캐릭터',
      job: '카데나',
      level: 270,
      stats: {
        기본: { 공격력: 100, 방무: [100] },
        AP: { LUK: 1000, DEX: 100, STR: 100 },
        장비: {
          장갑: { name: '현재 장갑', stat: { LUK: 100, 공격력: 20 } },
        },
        세트효과: {},
      },
      equipment: { item_equipment: [] } as unknown as ItemEquipmentRes,
    }));
    const service = new AuctionService(bridge, loadCharacterSnapshot);
    (service as unknown as { identity: unknown }).identity = {
      worldId: 5,
      accountId: 1,
      characterId: 2,
      characterName: '테스트캐릭터',
    };
    (
      service as unknown as {
        bodyCache: Map<
          string,
          { body: Record<string, unknown>; sold: boolean; category: string }
        >;
      }
    ).bodyCache.set('glove-search', {
      body: {},
      sold: false,
      category: 'ARMOR_ARMOR_GLOVE',
    });

    const result = (await service.getPage(
      'glove-search',
      2,
      20,
      'PRICE_PER_ITEM_ASC'
    )) as {
      items: Array<{
        finalDamageChangeRate?: Record<string, number>;
      }>;
    };

    expect(result.items[0].finalDamageChangeRate).toEqual({
      장갑: expect.any(Number),
    });
    expect(result.items[0].finalDamageChangeRate?.장갑).toBeGreaterThan(0);
  });
});
