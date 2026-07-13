// 스킬 패시브 → CharacterStats 스킬 파트. getSkill 하나로 차수별 블록·메용%·크리인포를 다 뽑는다.
// 값은 skill_effect(현재 레벨 수치)에서 파싱 — 스킬레벨 증가 효과로 만렙을 넘어도 반영된다.
// 등재 기준과 절차는 fill-job-passives 스킬 참고.

import { StatBlock } from "../stat-interface";
import { MapleJob } from "./skill-job";

interface SkillBlocks{
  스킬_0차  :StatBlock;
  스킬_1차:StatBlock;
  스킬_2차:StatBlock;
  스킬_3차:StatBlock;
  스킬_4차:StatBlock;
  스킬_하이퍼:StatBlock;
  스킬_5차:StatBlock;
}

export function getSkill(): SkillBlocks {



}
