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
  hwansanDiff?: number; // 환산 주스탯 증가량(현재 무기 대비 착용 시). 무기 검색 + 넥슨 키 있을 때만 채워짐
  finalDamagePct?: number; // 최종뎀 % 증가 (착용 시 총 딜 상승률, maplescouter "최종뎀 상승량"과 대응). 넥슨 키 있을 때만
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
