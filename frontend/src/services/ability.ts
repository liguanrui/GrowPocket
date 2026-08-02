import { request } from './api';

// 维度在本年级的发展层级：主轴 / 次轴 / 蓄势（影响 UI 展示与加分约束）
export type FocusLevel = 'primary' | 'secondary' | 'latent';

export interface AbilityDimension {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  research_src: string;
  sort_order: number;
}

export interface ChildAbilityScore {
  dimension_id: number;
  score: number;
  dimension_code: string;
  dimension_name: string;
  dimension_color: string;
  // 后端 Task A4 派生字段（children handler 追加）；未上线时前端用 fallback 映射
  focus_level?: FocusLevel;
  // V3.1 模块 B：精通 5 星（0-5），后端返回；缺失时前端按 score 兜底
  mastery_stars?: number;
}

export async function getAbilities(): Promise<AbilityDimension[]> {
  return request<AbilityDimension[]>({
    method: 'GET',
    url: '/abilities',
  });
}

export async function getChildScores(childId: number): Promise<ChildAbilityScore[]> {
  return request<ChildAbilityScore[]>({
    method: 'GET',
    url: `/abilities/scores/${childId}`,
  });
}

export async function getGrowthIndex(childId: number): Promise<number> {
  const res = await request<{ growth_index: number }>({
    method: 'GET',
    url: `/abilities/growth-index/${childId}`,
  });
  return res.growth_index;
}
