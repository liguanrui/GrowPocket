import { request } from './api';

// 成长周期
export interface GrowthCycle {
  id: number;
  family_id: number;
  child_id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed';
  created_at?: string;
  updated_at?: string;
}

// 阶段目标
export interface Goal {
  id: number;
  cycle_id: number;
  family_id: number;
  child_id: number;
  dimension_id: number;
  target_score: number;
  created_at?: string;
  updated_at?: string;
}

// 维度目标进度
export interface DimensionProgress {
  dimension_id: number;
  dimension_name: string;
  dimension_code: string;
  target_score: number;
  current_score: number;
  progress: number; // 0-100
}

// 当前周期返回结构
export interface CurrentCycleResult {
  cycle: GrowthCycle | null;
  goals: Goal[];
  progress: DimensionProgress[];
}

// 查询当前周期
export async function getCurrentCycle(childId: number): Promise<CurrentCycleResult> {
  return request<CurrentCycleResult>({
    method: 'GET',
    url: `/growth-cycles/current/${childId}`,
  });
}

// 设置阶段目标
export async function setGoal(
  cycleId: number,
  childId: number,
  dimensionId: number,
  targetScore: number,
): Promise<Goal> {
  return request<Goal>({
    method: 'POST',
    url: `/growth-cycles/${cycleId}/goals`,
    data: {
      child_id: childId,
      dimension_id: dimensionId,
      target_score: targetScore,
    },
  });
}

// 创建成长周期
export async function createCycle(
  childId: number,
  name: string,
  startDate: string,
  endDate: string,
): Promise<GrowthCycle> {
  return request<GrowthCycle>({
    method: 'POST',
    url: '/growth-cycles',
    data: {
      child_id: childId,
      name,
      start_date: startDate,
      end_date: endDate,
    },
  });
}

// 更新成长周期（时间区间、名称）
export async function updateCycle(
  cycleId: number,
  name: string,
  startDate: string,
  endDate: string,
): Promise<GrowthCycle> {
  return request<GrowthCycle>({
    method: 'PUT',
    url: `/growth-cycles/${cycleId}`,
    data: {
      name,
      start_date: startDate,
      end_date: endDate,
    },
  });
}
