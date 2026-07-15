import { describe, expect, it } from 'vitest';
import {
  calculateSetEffects,
  countEquipmentSets,
  setOfItem,
} from './setSimulation.js';

describe('setSimulation', () => {
  it('장비 이름으로 방어구와 장신구의 세트를 판별한다', () => {
    expect(setOfItem('앱솔랩스 나이트케이프')).toBe('앱솔랩스');
    expect(setOfItem('하이네스 워리어헬름')).toBe('루타비스');
    expect(setOfItem('몽환의 벨트')).toBe('칠흑의 보스');
    expect(setOfItem('가디언 엔젤 링')).toBe('보스 장신구');
    expect(setOfItem('여명의 가디언 엔젤 링')).toBe('여명의 보스');
    expect(setOfItem('여명 전환 데이브레이크 펜던트')).toBe('여명의 보스');
    expect(setOfItem('일반 가죽 모자')).toBeNull();
  });

  it('장착 아이템 이름으로 세트별 피스 수를 센다', () => {
    expect(
      countEquipmentSets([
        '앱솔랩스 나이트케이프',
        '앱솔랩스 나이트슈즈',
        '앱솔랩스 나이트숄더',
        '일반 모자',
      ])
    ).toEqual({ 앱솔랩스: 3 });
  });

  it('럭키 아이템은 3피스 이상이며 해당 부위를 포함하는 세트에 1피스를 더한다', () => {
    expect(
      countEquipmentSets([
        '앱솔랩스 나이트케이프',
        '앱솔랩스 나이트슈즈',
        '앱솔랩스 나이트숄더',
        '카오스 벨룸의 헬름',
      ])
    ).toEqual({ 앱솔랩스: 4 });
  });

  it('여명 전환 여부를 별도 옵션 없이 아이템 이름으로 구분한다', () => {
    expect(
      countEquipmentSets([
        '여명의 가디언 엔젤 링',
        '여명 전환 데이브레이크 펜던트',
        '데아 시두스 이어링',
      ])
    ).toEqual({ '여명의 보스': 2, '보스 장신구': 1 });
  });

  it('럭키 아이템이 여러 개여도 가장 우선순위가 높은 하나만 적용한다', () => {
    expect(
      countEquipmentSets([
        '앱솔랩스 나이트케이프',
        '앱솔랩스 나이트슈즈',
        '앱솔랩스 나이트숄더',
        '카오스 벨룸의 헬름',
        '스칼렛 링',
      ])
    ).toEqual({ 앱솔랩스: 4 });
  });

  it('럭키 아이템 부위가 세트 구성에 없으면 피스를 추가하지 않는다', () => {
    expect(
      countEquipmentSets([
        '하이네스 워리어헬름',
        '이글아이 워리어아머',
        '트릭스터 워리어팬츠',
        '스칼렛 이어링',
      ])
    ).toEqual({ 루타비스: 3 });
  });

  it('현재 피스 수 이하의 단계별 세트효과를 누적한다', () => {
    expect(calculateSetEffects({ 앱솔랩스: 3 })).toEqual({
      앱솔랩스: {
        올스탯: 30,
        공격력: 40,
        마력: 40,
        보공: 20,
      },
    });
  });
});
