import { request } from './api';

// 时间穿越调试 API（仅开发环境可用，后端 APP_ENV=development 时注册路由）

export interface DebugTimeInfo {
  current_time: string;
  is_virtual: boolean;
  real_time?: string;
  advanced_days?: number;
  was_virtual?: boolean;
}

// 查询当前时间状态（虚拟 / 真实）
export async function getDebugTime(): Promise<DebugTimeInfo> {
  return request<DebugTimeInfo>({ method: 'GET', url: '/debug/time' });
}

// 推进虚拟时间 N 天（后端会自动触发生成任务 + 过期父任务检查）
export async function advanceTime(days: number): Promise<DebugTimeInfo> {
  return request<DebugTimeInfo>({
    method: 'POST',
    url: '/debug/advance-time',
    data: { days },
    timeout: 60000,
  });
}

// 重置为真实时间
export async function resetTime(): Promise<DebugTimeInfo> {
  return request<DebugTimeInfo>({ method: 'POST', url: '/debug/reset-time' });
}
