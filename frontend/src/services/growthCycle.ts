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
  goal_type?: 'dimension' | 'habit' | 'parent_task' | string;
  habit_id?: number | null;
  parent_task_id?: number | null;
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

// 批量设置阶段目标（不传 target_score，仅勾选维度）
export interface BatchGoalItem {
  goal_type: string;
  dimension_id?: number;
  habit_id?: number;
  parent_task_id?: number;
}

export async function setGoalsBatch(data: {
  cycle_id: number;
  child_id: number;
  goals: BatchGoalItem[];
}): Promise<void> {
  return request<void>({
    method: 'POST',
    url: '/growth/goals/batch',
    data,
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

// 周期累计统计（本周期累计完成任务数、积分、关注维度、剩余天数等）
export interface CycleStats {
  completed_task_count: number;
  total_points_earned: number;
  focus_dim_names: string[];
  days_remaining: number;
  cycle_name: string;
  cycle_start: string;
  cycle_end: string;
}

// 查询指定儿童当前周期的累计统计
export async function getCycleStats(childId: number): Promise<CycleStats> {
  return request<CycleStats>({
    method: 'GET',
    url: '/growth-cycles/cycle-stats',
    params: { child_id: childId },
  });
}
