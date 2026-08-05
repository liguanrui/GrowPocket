import { request } from './api';
import type { CycleLengthWeeks } from '../types';

// 成长周期（V1.3 统一目标入口：合并原 CycleGoalSetting 能力）
export interface GrowthCycle {
  id: number;
  family_id: number;
  child_id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed';
  // V1.3.1 目标字段（每维度独立提升分）
  cycle_length_weeks: CycleLengthWeeks;
  focus_dims: string; // JSON 数组字符串如 "[1,2]"，需 JSON.parse
  dim_targets: string; // V1.3.1 JSON map 字符串如 {"1":15,"3":10}，需 JSON.parse
  points_target: number; // V1.3.1 派生字段 = sum(dim_targets)，向后兼容
  points_target_grade: string; // G1-G6
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

// 阶段目标（旧表，兼容历史数据，不再写入）
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
  delta?: number; // V1.3.1 提升分（本周期目标增量）
  progress: number; // 0-100
}

// 当前周期返回结构
export interface CurrentCycleResult {
  cycle: GrowthCycle | null;
  goals: Goal[];
  progress: DimensionProgress[];
}

// V1.3.1 统一阶段目标入参（每维度独立目标提升分）
export interface SetGoalInput {
  child_id: number;
  cycle_length_weeks: CycleLengthWeeks;
  focus_dims: number[]; // 1-3 个重点维度（课程表加权用）
  dim_targets: Record<number, number>; // 维度ID → 提升分（如 {1:15, 3:10}），keys 必须 ⊆ focus_dims
  start_monday?: string; // yyyy-mm-dd, 可选，不传则默认下个周一
}

// 查询当前周期
export async function getCurrentCycle(childId: number): Promise<CurrentCycleResult> {
  return request<CurrentCycleResult>({
    method: 'GET',
    url: `/growth-cycles/current/${childId}`,
  });
}

// V1.3 查询当前阶段目标（从 GrowthCycle 读取，替代原 cycleGoal.ts 的 getGoal 空实现）
export async function getGoal(childId: number): Promise<{ cycle: GrowthCycle | null }> {
  return request<{ cycle: GrowthCycle | null }>({
    method: 'GET',
    url: `/growth-cycles/goal/${childId}`,
  });
}

// V1.3 统一阶段目标设置（合并原 cycleGoal.ts 的 setGoal）
// 规则：周期长度仅支持 1/2/3/4 周；设置成功后后端自动调用 CyclePlanService 生成课程表
// 注意：cycleId 参数保留是为了兼容 URL 路由 /growth-cycles/:id/goals，但后端实际以 child_id 查找 active 周期
export async function setGoal(cycleId: number, input: SetGoalInput): Promise<GrowthCycle> {
  return request<GrowthCycle>({
    method: 'POST',
    url: `/growth-cycles/${cycleId}/goals`,
    data: input,
  });
}

// V1.3 便捷方法：无需 cycleId，直接用 child_id 设置阶段目标
// 后端会自动查找或创建 active 成长周期
// 实现：先 getGoal 拿到 cycleId，没有则用 createCycle 创建一个占位周期再 setGoal
export async function setGoalByChildId(input: SetGoalInput): Promise<GrowthCycle> {
  // 1. 查当前 active 周期
  const { cycle } = await getGoal(input.child_id);
  if (cycle) {
    // 2a. 有 active 周期，直接 setGoal
    return setGoal(cycle.id, input);
  }
  // 2b. 无 active 周期，后端 SetGoal 会自动创建，直接调用 setGoal(0, input)
  // 后端 handler 不依赖 URL 里的 cycleId，以 child_id 查找/创建
  return setGoal(0, input);
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
