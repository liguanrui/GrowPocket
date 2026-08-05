import { request } from './api';
import type {
  CycleLengthWeeks,
  CyclePlan,
  CyclePlanPreviewResponse,
} from '../types';

// === 类型定义 ===
export interface LockCyclePlanRequest {
  lock_version: number;
  action: 'lock' | 'unlock';
  locked_by_parent_id: number;
}

export interface TaskAdjustRequest {
  instance_id: number;
  operation: 'lock' | 'replace' | 'add' | 'remove' | 'escalate_supervision';
  params?: Record<string, any>;
}

export interface ToggleThemeWeekRequest {
  theme_dim_id: number;
  position: 'week1' | 'week2' | 'week3' | 'week4';
  enable: boolean;
}

export interface ReplaceCandidate {
  id: number;
  title: string;
  description: string;
  points: number;
  difficulty: string;
  category: string;
  ability_dimension_id: number;
}

// === API 函数 ===

// 预览周期课程表
export async function preview(
  childId: number,
  startMonday: string,
  cycleLengthWeeks?: CycleLengthWeeks,
): Promise<CyclePlanPreviewResponse> {
  const params: Record<string, string> = {
    child_id: String(childId),
    start_monday: startMonday,
  };
  if (cycleLengthWeeks) params.cycle_length_weeks = String(cycleLengthWeeks);
  return request<CyclePlanPreviewResponse>({
    method: 'GET',
    url: '/cycle-plans/preview',
    params,
  });
}

// 锁版/解锁
export async function lock(
  planId: number,
  req: LockCyclePlanRequest,
): Promise<{ status: string; lock_version: number }> {
  return request({
    method: 'POST',
    url: `/cycle-plans/${planId}/lock`,
    data: req,
  });
}

// 重新生成(保留 locked=true 任务)
export async function regenerate(planId: number): Promise<CyclePlan> {
  return request<CyclePlan>({
    method: 'POST',
    url: `/cycle-plans/${planId}/regenerate`,
  });
}

// 5 类调整操作
export async function taskAdjust(planId: number, req: TaskAdjustRequest): Promise<CyclePlan> {
  return request<CyclePlan>({
    method: 'POST',
    url: `/cycle-plans/${planId}/task-adjust`,
    data: req,
  });
}

// 拉取替换候选(3 条)
export async function replaceCandidates(
  childId: number,
  taskId: number,
  date: string,
  dimensionId: number,
  difficulty: string,
): Promise<ReplaceCandidate[]> {
  return request<ReplaceCandidate[]>({
    method: 'GET',
    url: '/cycle-plans/replace-candidates',
    params: {
      child_id: String(childId),
      task_id: String(taskId),
      date,
      dimension_id: String(dimensionId),
      difficulty,
    },
  });
}

// 主题周开关 + 位置调整
export async function toggleThemeWeek(
  planId: number,
  req: ToggleThemeWeekRequest,
): Promise<CyclePlan> {
  return request<CyclePlan>({
    method: 'POST',
    url: `/cycle-plans/${planId}/toggle-theme-week`,
    data: req,
  });
}

// 导出周期计划 PDF(返回二进制)
export async function exportPdf(planId: number): Promise<Blob> {
  // 注意:这个接口返回的不是 ApiResponse 包装的 JSON,而是直接的 PDF 二进制
  // 需要绕过 request 工具函数,直接用 axios
  const api = (await import('./api')).default;
  const response = await api.get(`/cycle-plans/${planId}/export-pdf`, {
    responseType: 'blob',
  });
  return response.data;
}
