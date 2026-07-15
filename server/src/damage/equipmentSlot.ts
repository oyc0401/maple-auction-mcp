import type { GearStats } from './stat-interface.js';

export type EquipmentSlot = Exclude<keyof GearStats, '칭호'>;

const EQUIPMENT_SLOT_MAP: Partial<Record<string, EquipmentSlot>> = {
  모자: '모자',
  얼굴장식: '얼굴장식',
  눈장식: '눈장식',
  귀고리: '귀고리',
  상의: '상의',
  한벌옷: '한벌옷',
  하의: '하의',
  신발: '신발',
  장갑: '장갑',
  망토: '망토',
  무기: '무기',
  보조무기: '보조무기',
  엠블렘: '엠블렘',
  반지1: '반지1',
  반지2: '반지2',
  반지3: '반지3',
  반지4: '반지4',
  펜던트: '펜던트',
  펜던트2: '펜던트2',
  벨트: '벨트',
  어깨장식: '어깨장식',
  '포켓 아이템': '포켓아이템',
  훈장: '훈장',
  뱃지: '뱃지',
  '기계 심장': '기계심장',
};

export function getEquipmentSlot(slot: string): EquipmentSlot | null {
  return EQUIPMENT_SLOT_MAP[slot] ?? null;
}
