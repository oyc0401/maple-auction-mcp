interface PotentialBlock {
  grade: number;
  entries: { grade: number; text: string }[];
  description: string;
}

// 요약에 항상 노출하는 스탯(0이어도 표기). 방어력·MP는 제외, 공격력·HP 포함.
const STAT_KEYS = ['str', 'dex', 'int', 'luk', 'all', 'pad', 'mad', 'mhp', 'dam', 'bdr', 'imdr'] as const;

export interface ItemSummary {
  id: string;
  name: string;
  price: number; // 개당 가격 (메소)
  quantity: number;
  starforce: number;
  scroll: string | null; // 주문서 강화: "강화 8회 (남은 횟수 0 / 복구가능 1 / 총 9)"
  powerDiff: number | null; // 전투력 증가량 (착용 시). 착용 불가 시 null
  finalStat: Record<string, number> | null; // 최종 합산 스탯 (고정 키, 0도 표기)
  exOption: string | null; // 추가옵션 항목 (예: "마력 +33 / INT +40 / ...")
  potential: string | null;
  additional: string | null;
  exceptional: string | null; // 익셉셔널 강화 내역
  soul: string | null; // 소울: "이름 / 옵션"
  tradeDesc: string | null; // 거래 관련: "장착 시 교환 불가 · (가위: 7 / 10)"
  seedRingLevel?: number; // 특수 스킬 반지 레벨 (반지 전용, 가격 결정 요소). 반지 아니거나 0이면 생략
  status: string; // 매물 상태: ON_SALE 판매중 / SOLD 판매완료 등
  tradeDate: string | null; // 판매 완료 시각(시세·찜의 팔린 매물). 판매중이면 null
  endDate: string; // 판매 등록 만료 시각(판매중 기준). 시세(SOLD)에선 판매시각은 tradeDate를 볼 것
  wishlist: number;
  isMyWorld: boolean; // 내 월드 매물 여부. false면 구매 시 가격의 10% 메이플포인트 수수료
  isAmazingHyperUpgradeUsed: boolean; // 놀라운 장비강화 주문서(놀장) 사용 여부
}

export interface SearchSummary {
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  searchKey: string;
  items: ItemSummary[];
}

// 잠재: "레전드리: 공격력 +12% / ..." (등급명만 접두, 없으면 null)
// description "잠재능력 : 레전드리" → 마지막 " : " 뒤 등급명만 사용.
function potentialLine(p?: PotentialBlock): string | null {
  if (!p || p.grade === 0 || !p.entries?.length) return null;
  const grade = p.description.split(' : ').pop() ?? p.description;
  return `${grade}: ${p.entries.map((e) => e.text).join(' / ')}`;
}

// 추가옵션 항목: "마력 +33 / INT +40 / ..." (내역 없으면 null)
function exOptionLine(ex?: { entries?: { text: string }[] }): string | null {
  if (!ex?.entries?.length) return null;
  return ex.entries.map((e) => e.text).join(' / ');
}

// 익셉셔널 강화: "INT +30 / 마력 +15" (내역 없으면 null)
function exceptionalLine(ex?: { entries?: { text: string }[] }): string | null {
  if (!ex?.entries?.length) return null;
  return ex.entries.map((e) => e.text).join(' / ');
}

// 소울: "이름 / 옵션" (미장착이면 null)
function soulLine(s?: { soulName?: string | null; optionText?: string | null }): string | null {
  if (!s?.soulName) return null;
  return s.optionText ? `${s.soulName} / ${s.optionText}` : s.soulName;
}

// 주문서 강화: "강화 8회 (남은 횟수 0 / 복구가능 1 / 총 9)" (정보 없으면 null)
function scrollLine(s?: { current: number; remaining: number; failure: number; max: number }): string | null {
  if (!s) return null;
  return `강화 ${s.current}회 (남은 횟수 ${s.remaining} / 복구가능 ${s.failure} / 총 ${s.max})`;
}

// 거래 설명 배열을 한 줄로 (내부 "n / m" 슬래시와 겹치지 않게 · 로 연결). 없으면 null.
// "가위 사용 잔여 횟수 :" 는 "가위:" 로 축약.
function tradeLine(desc?: string[]): string | null {
  if (!desc?.length) return null;
  return desc.join(' · ').replace('가위 사용 잔여 횟수 :', '가위:');
}

// 최종 스탯 블록을 고정 키로 정규화 (없는 값은 0). stat 자체가 없으면 null.
function fixedStat(stat?: Record<string, number>): Record<string, number> | null {
  if (!stat) return null;
  const out: Record<string, number> = {};
  for (const k of STAT_KEYS) out[k] = stat[k] ?? 0;
  return out;
}

export function summarizeItem(item: any): ItemSummary {
  const tt = item.toolTip ?? {};
  const ui = tt.upgradeInfo ?? {};
  return {
    id: item._id,
    name: item.itemName,
    price: Number(item.pricePerItem),
    quantity: item.quantity,
    starforce: item.starforce,
    scroll: scrollLine(ui.scroll),
    powerDiff: item.attackPowerDiff ?? null,
    finalStat: fixedStat(tt.stat),
    exOption: exOptionLine(ui.exOption),
    potential: potentialLine(ui.potential),
    additional: potentialLine(ui.additionalPotential),
    exceptional: exceptionalLine(tt.exceptionalUpgrade),
    soul: soulLine(tt.soulWeapon),
    tradeDesc: tradeLine(tt.tradeDesc),
    ...(item.seedRingLevel ? { seedRingLevel: item.seedRingLevel } : {}),
    status: item.status,
    tradeDate: item.tradeDate ?? null,
    endDate: item.endDate,
    wishlist: item.wishlistCount,
    isMyWorld: item.isMyWorld !== false,
    isAmazingHyperUpgradeUsed: tt.isAmazingHyperUpgradeUsed === true,
  };
}

// 스카우터(userEquipData) 합산 스탯 중 노출할 키와 라벨. %성 옵션은 라벨에 % 표기.
const EQUIP_STAT_LABELS: [key: string, label: string][] = [
  ['str', 'STR'], ['dex', 'DEX'], ['int', 'INT'], ['luk', 'LUK'],
  ['all_stat', '올스탯%'], ['max_hp', 'HP'], ['max_hp_rate', 'HP%'],
  ['attack_power', '공격력'], ['magic_power', '마력'],
  ['boss_damage', '보공%'], ['damage', '뎀%'], ['ignore_monster_armor', '방무%'],
  ['equipment_level_decrease', '착제감'],
];

// 착용 장비 합산 스탯 한 줄: "LUK+272 DEX+170 공격력+649 보공%+40" (0은 생략, 전부 0이면 null)
function equipStatLine(total?: Record<string, string | number>): string | null {
  if (!total) return null;
  const parts = EQUIP_STAT_LABELS
    .map(([k, label]) => {
      const v = Number(total[k] ?? 0);
      return v ? `${label}+${v}` : null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

// 잠재/에디 줄 배열: "레전드리: 줄 / 줄" (등급 없으면 null)
function scouterPotentialLine(grade: unknown, lines: (string | null)[] | undefined): string | null {
  const g = typeof grade === 'string' && grade ? grade : null;
  const body = (lines ?? []).filter(Boolean).join(' / ');
  if (!g || !body) return null;
  return `${g}: ${body}`;
}

// maplescouter userEquipData 항목 1개 → 착용 장비 상세 요약 (user_equip slot 지정 응답)
export function summarizeScouterEquip(e: any): Record<string, unknown> {
  const out: Record<string, unknown> = {
    slot: e.slot,
    name: e.name,
    starforce: Number(e.starforce) || 0,
    scroll: Number(e.scroll_upgrade) ? `강화 ${Number(e.scroll_upgrade)}회` : null,
    stat: equipStatLine(e.totalOption),
    potential: scouterPotentialLine(e.potential_grade, e.potential_option_1),
    additional: scouterPotentialLine(e.additional_potential_grade, e.additional_potential_option_1),
    soul: e.soul_name ? `${e.soul_name}${e.soul_option ? ` / ${e.soul_option}` : ''}` : null,
  };
  if (e.cuttable_count != null && String(e.cuttable_count) !== '') out.cuttable = Number(e.cuttable_count);
  if (Number(e.ring_level)) out.ringLevel = Number(e.ring_level);
  return out;
}

export function summarizeSearch(resp: any): SearchSummary {
  if (resp == null || typeof resp !== 'object') {
    throw new Error('거래소 응답이 비어 있거나 형식이 올바르지 않습니다.');
  }
  return {
    total: resp.total,
    page: resp.page,
    totalPages: resp.totalPages,
    hasNext: resp.hasNext,
    searchKey: resp.searchKey,
    items: (resp.items ?? []).map(summarizeItem),
  };
}
