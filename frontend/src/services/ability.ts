import { request } from './api';

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
