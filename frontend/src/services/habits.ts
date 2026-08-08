import { request } from './api';

export interface Habit {
  id: number;
  family_id: number;
  title: string;
  description: string;
  category: string;
  min_age: number;
  max_age: number;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  template_type: string;
  [key: string]: unknown; // 兼容 TaskTemplate 返回的多余字段
}

export interface HabitStats {
  streak_count: number;
  total_count: number;
  habit_goal: number;
  last_checkin_date: string | null;
  checkin_calendar: { date: string; completed: boolean }[]; // 最近21天
}

// 获取年龄段适配的预设习惯
export async function getPresetHabits(age: number): Promise<Habit[]> {
  return request<Habit[]>({
    method: 'GET',
    url: '/habits/preset',
    params: { age },
  });
}

// 创建自定义习惯
export async function createCustomHabit(data: {
  child_id: number;
  title: string;
  description: string;
  category: string;
}): Promise<Habit> {
  return request<Habit>({
    method: 'POST',
    url: '/habits/custom',
    data,
  });
}

// 获取当前周期绑定的习惯
export async function getActiveHabits(childId: number): Promise<Habit[]> {
  return request<Habit[]>({
    method: 'GET',
    url: '/habits/active',
    params: { child_id: childId },
  });
}

// 获取习惯统计（连续/累计/目标/打卡日历）
export async function getHabitStats(habitId: number): Promise<HabitStats> {
  return request<HabitStats>({
    method: 'GET',
    url: `/habits/${habitId}/stats`,
  });
}
