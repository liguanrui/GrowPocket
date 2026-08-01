import { request } from './api';
import type { Task } from './tasks';

// 能力维度变化（阶段回顾时生成）
export interface AbilityDelta {
  dimension_id: number;
  dimension_name: string;
  old_score: number;
  new_score: number;
  delta: number;
  target_score: number; // 阶段目标分（0 表示未设置目标）
}

export interface GrowthStory {
  id: number;
  cycle_id: number;
  family_id: number;
  child_id: number;
  title: string; // 故事标题
  content: string; // 故事正文（Markdown 文本）
  ability_summary: string; // 能力提升摘要 JSON 字符串（AbilityDelta[]）
  photo_urls: string; // 精选相册 JSON 字符串
  created_at: string;
}

// 成长故事列表响应
export interface ListStoriesResponse {
  items: GrowthStory[];
  total: number;
  page: number;
  page_size: number;
}

// 成长周期
export interface GrowthCycle {
  id: number;
  family_id: number;
  child_id: number;
  start_date: string;
  end_date?: string;
  status: number; // 1=进行中, 2=已结束
  [key: string]: any;
}

// 当前周期返回结构
export interface CurrentCycleResponse {
  cycle: GrowthCycle;
  goals: any[];
  progress: any;
}

// 生成成长故事（AI 调用可能耗时较长，放宽超时）
export async function generateStory(cycleId: number, childId: number, childName?: string): Promise<GrowthStory> {
  return request<GrowthStory>({
    method: 'POST',
    url: `/growth-stories/${cycleId}`,
    data: { child_id: childId, child_name: childName },
    timeout: 120000,
  });
}

// 查询成长故事
export async function getStory(cycleId: number): Promise<GrowthStory> {
  return request<GrowthStory>({
    method: 'GET',
    url: `/growth-stories/${cycleId}`,
  });
}

// 查询儿童所有成长故事历史（按时间倒序）
export async function listStories(
  childId: number,
  page = 1,
  pageSize = 20,
): Promise<ListStoriesResponse> {
  return request<ListStoriesResponse>({
    method: 'GET',
    url: '/growth-stories',
    params: { child_id: childId, page, page_size: pageSize },
  });
}

// 查询周期内所有已完成任务（子任务时间线）
export async function getCycleTasks(cycleId: number): Promise<Task[]> {
  return request<Task[]>({
    method: 'GET',
    url: `/growth-stories/${cycleId}/tasks`,
  });
}

// 查询当前周期
export async function getCurrentCycle(childId: number): Promise<CurrentCycleResponse> {
  return request<CurrentCycleResponse>({
    method: 'GET',
    url: `/growth-cycles/current/${childId}`,
  });
}

// 解析 ability_summary JSON
export function parseAbilitySummary(summary: string): AbilityDelta[] {
  try {
    const parsed = JSON.parse(summary);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 解析 photo_urls JSON
export function parsePhotoUrls(photos: string): string[] {
  try {
    const parsed = JSON.parse(photos);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
