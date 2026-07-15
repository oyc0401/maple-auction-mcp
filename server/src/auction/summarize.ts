import type {
  AuctionItem,
  AuctionOptionEntry,
  AuctionPotential,
  AuctionSearchResponse,
} from './item.js';
import { ROYAL_LABEL_BY_VALUE, PET_GRADE_BY_VALUE } from '../constants.js';

// 요약에 노출하는 스탯 키와 라벨 (user_equip의 stat 줄과 동일 표기·순서). 방어력·MP는 제외, 공격력·HP 포함.
const ITEM_STAT_LABELS: [key: string, label: string][] = [
  ['str', 'STR'], ['dex', 'DEX'], ['int', 'INT'], ['luk', 'LUK'],
  ['all', '올스탯%'], ['mhp', 'HP'], ['pad', '공격력'], ['mad', '마력'],
  ['bdr', '보공%'], ['dam', '뎀%'], ['imdr', '방무%'],
];

// 합산 스탯 한 줄: "LUK+272 DEX+170 공격력+649 보공%+40" (0은 생략 = 미표기는 0, 전부 0이면 null)
function statLine(total: Record<string, unknown> | undefined, labels: [key: string, label: string][]): string | null {
  if (!total) return null;
  const parts = labels
    .map(([k, label]) => {
      const v = Number(total[k] ?? 0);
      return v ? `${label}+${v}` : null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

// 값 없는(null/undefined) 필드는 응답에서 뺀다 — 매물당 고정으로 나가던 null 줄 제거 (토큰 절약).
// 시세(SOLD 구분)·소비템(수량) 판단에 쓰이는 status·quantity 등 항상 유의미한 필드는 값이 있으므로 남는다.
function omitEmpty<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null)) as T;
}

export interface ItemSummary {
  id: string;
  name: string;
  price: number; // 개당 가격 (메소)
  quantity: number;
  starforce: number;
  scroll?: string; // 주문서 강화: "강화 8회 (남은 횟수 0 / 복구가능 1 / 총 9)". 정보 없으면 생략
  powerDiff?: number; // 전투력 증가량 (착용 시). 착용 불가면 생략
  stat?: string; // 최종 합산 스탯 한 줄 "STR+30 … 보공%+30" (0인 스탯 생략 = 미표기는 0). 전부 0이면 생략
  exOption?: string; // 추가옵션 항목 (예: "마력 +33 / INT +40 / ...")
  potential?: string; // 잠재 없으면 생략
  additional?: string; // 에디셔널 없으면 생략
  exceptional?: string; // 익셉셔널 강화 내역. 없으면 생략
  soul?: string; // 소울: "이름 / 옵션". 미장착이면 생략
  tradeDesc?: string; // 거래 관련: "장착 시 교환 불가 · (가위: 7 / 10)". 비장비는 toolTip.tradeDescs 기반
  seedRingLevel?: number; // 특수 스킬 반지 레벨 (반지 전용, 가격 결정 요소). 반지 아니거나 0이면 생략
  timeLimit?: string; // 기간제 정보 (비장비·캐시). 없으면 생략
  gender?: string; // 착용 성별 "남"/"여" (코디·뷰티). NONE이면 생략
  label?: string; // 코디 라벨 등급(레드라벨 등) 또는 펫 등급(루나 스윗 등). 없으면 생략
  status: string; // 매물 상태: ON_SALE 판매중 / SOLD 판매완료(시세)
  tradeDate?: string; // 판매 완료 시각(시세·찜의 팔린 매물만). 판매중이면 생략
  endDate: string; // 판매 등록 만료 시각(판매중 기준). 시세(SOLD)에선 판매시각은 tradeDate를 볼 것
  wishlist: number;
  isMyWorld: boolean; // 내 월드 매물 여부. false면 구매 시 가격의 10% 메이플포인트 수수료
  isAmazingHyperUpgradeUsed?: boolean; // 놀라운 장비강화 주문서(놀장) 사용 시에만 true
  finalDamageChangeRate?: Record<string, number>;
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
function potentialLine(p?: AuctionPotential): string | null {
  if (!p || p.grade === 0 || !p.entries?.length) return null;
  const grade = p.description.split(' : ').pop() ?? p.description;
  return `${grade}: ${p.entries.map((e) => e.text).join(' / ')}`;
}

// 옵션 줄 배열: "마력 +33 / INT +40 / ..." (내역 없으면 null). 추가옵션·익셉셔널 강화 공용.
function optionEntryLine(ex?: { entries?: AuctionOptionEntry[] } | null): string | null {
  const body = (ex?.entries ?? []).map((e) => e.text).filter(Boolean).join(' / ');
  return body || null;
}

// 소울: "이름 / 옵션" (미장착이면 null)
function soulLine(s?: { soulName?: string | null; optionText?: string | null } | null): string | null {
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
function tradeLine(desc?: string[] | null): string | null {
  if (!desc?.length) return null;
  return desc.join(' · ').replace('가위 사용 잔여 횟수 :', '가위:');
}

export function summarizeItem(item: AuctionItem): ItemSummary {
  const tt = item.toolTip ?? {};
  const ui = tt.upgradeInfo ?? {};
  // 코디 라벨(레드라벨 등)과 펫 등급(루나 스윗 등)은 같은 자리(label)에 요약 — 동시에 붙는 아이템은 없다
  const label =
    (item.royalSpecialType ? ROYAL_LABEL_BY_VALUE[item.royalSpecialType] : null) ??
    (item.petGrade ? PET_GRADE_BY_VALUE[item.petGrade] : null);
  return omitEmpty({
    id: item._id,
    name: item.itemName,
    price: Number(item.pricePerItem),
    quantity: item.quantity,
    starforce: item.starforce,
    scroll: scrollLine(ui.scroll),
    powerDiff: item.attackPowerDiff ?? null, // 0은 유효한 값(현재 장비와 동급)이라 유지
    stat: statLine(tt.stat, ITEM_STAT_LABELS),
    exOption: optionEntryLine(ui.exOption),
    potential: potentialLine(ui.potential),
    additional: potentialLine(ui.additionalPotential),
    exceptional: optionEntryLine(tt.exceptionalUpgrade),
    soul: soulLine(tt.soulWeapon),
    tradeDesc: tradeLine(tt.tradeDesc ?? tt.tradeDescs), // 장비는 tradeDesc, 비장비(toolTipType 5)는 tradeDescs
    seedRingLevel: item.seedRingLevel || null,
    timeLimit: tt.timeLimit ?? null,
    gender: item.gender === 'MALE' ? '남' : item.gender === 'FEMALE' ? '여' : null,
    label,
    status: item.status,
    tradeDate: item.tradeDate ?? null,
    endDate: item.endDate,
    wishlist: item.wishlistCount,
    isMyWorld: item.isMyWorld !== false,
    isAmazingHyperUpgradeUsed: tt.isAmazingHyperUpgradeUsed === true ? true : null,
  }) as ItemSummary;
}

// 스카우터(userEquipData) 합산 스탯 중 노출할 키와 라벨. %성 옵션은 라벨에 % 표기.
const EQUIP_STAT_LABELS: [key: string, label: string][] = [
  ['str', 'STR'], ['dex', 'DEX'], ['int', 'INT'], ['luk', 'LUK'],
  ['all_stat', '올스탯%'], ['max_hp', 'HP'], ['max_hp_rate', 'HP%'],
  ['attack_power', '공격력'], ['magic_power', '마력'],
  ['boss_damage', '보공%'], ['damage', '뎀%'], ['ignore_monster_armor', '방무%'],
  ['equipment_level_decrease', '착제감'],
];


// 잠재/에디 줄 배열: "레전드리: 줄 / 줄" (등급 없으면 null)
function scouterPotentialLine(grade: unknown, lines: (string | null)[] | undefined): string | null {
  const g = typeof grade === 'string' && grade ? grade : null;
  const body = (lines ?? []).filter(Boolean).join(' / ');
  if (!g || !body) return null;
  return `${g}: ${body}`;
}

// maplescouter userEquipData 항목 1개 → 착용 장비 상세 요약 (구 user_equip — 참고용 보존)
export function summarizeScouterEquip(e: any): Record<string, unknown> {
  const out: Record<string, unknown> = {
    slot: e.slot,
    name: e.name,
    starforce: Number(e.starforce) || 0,
    scroll: Number(e.scroll_upgrade) ? `강화 ${Number(e.scroll_upgrade)}회` : null,
    stat: statLine(e.totalOption, EQUIP_STAT_LABELS),
    potential: scouterPotentialLine(e.potential_grade, e.potential_option_1),
    additional: scouterPotentialLine(e.additional_potential_grade, e.additional_potential_option_1),
    soul: e.soul_name ? `${e.soul_name}${e.soul_option ? ` / ${e.soul_option}` : ''}` : null,
  };
  if (e.cuttable_count != null && String(e.cuttable_count) !== '') out.cuttable = Number(e.cuttable_count);
  if (Number(e.ring_level)) out.ringLevel = Number(e.ring_level);
  return out;
}

// 넥슨 오픈 API item-equipment 항목 1개 → 착용 장비 상세 요약 (user_equip slot 지정 응답).
// item_total_option 키는 스카우터 totalOption과 동일(둘 다 넥슨 분해옵션) → EQUIP_STAT_LABELS 재사용.
export function summarizeNexonEquip(e: any): Record<string, unknown> {
  const pot = (grade: unknown, lines: (string | null | undefined)[]) =>
    scouterPotentialLine(grade, lines.filter((l): l is string => typeof l === 'string' && !!l));
  const out: Record<string, unknown> = {
    slot: e.item_equipment_slot === '펜던트' ? '펜던트1' : e.item_equipment_slot,
    name: e.item_name,
    starforce: Number(e.starforce) || 0,
    scroll: Number(e.scroll_upgrade) ? `강화 ${Number(e.scroll_upgrade)}회` : null,
    stat: statLine(e.item_total_option, EQUIP_STAT_LABELS),
    potential: pot(e.potential_option_grade, [e.potential_option_1, e.potential_option_2, e.potential_option_3]),
    additional: pot(e.additional_potential_option_grade, [e.additional_potential_option_1, e.additional_potential_option_2, e.additional_potential_option_3]),
    soul: e.soul_name ? `${e.soul_name}${e.soul_option ? ` / ${e.soul_option}` : ''}` : null,
  };
  if (e.cuttable_count != null && String(e.cuttable_count) !== '') out.cuttable = Number(e.cuttable_count);
  if (Number(e.special_ring_level)) out.ringLevel = Number(e.special_ring_level);
  return out;
}

export function summarizeSearch(resp: AuctionSearchResponse): SearchSummary {
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
