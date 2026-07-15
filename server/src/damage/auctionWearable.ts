import type { AuctionItem } from '../auction/item.js';
import { getJobClass } from './stat/job.js';

// 착용 가능 여부도 검색 필터가 아니라 매물 JSON으로만 판단한다.
// reqJob은 직업군까지만 말하고, 같은 직업군 안의 예외는 unwearableJobNames가 따로 준다
// (실측: 아케인셰이드 스태프 reqJob="마법사", unwearableJobNames=["키네시스","일리움","라라","레테"]).
export function isAuctionItemWearable(item: Pick<AuctionItem, 'toolTip'>, job: string): boolean {
  const reqJob = item.toolTip?.reqJob;
  if (!reqJob) return true; // 직업 제한 없는 장신구 등
  if (reqJob !== getJobClass(job)) return false;
  return !(item.toolTip?.unwearableJobNames ?? []).includes(job);
}
