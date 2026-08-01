import { request } from './api';

export interface GrowthStory {
  id: number;
  cycle_id: number;
  family_id: number;
  child_id: number;
  title: string; // 故事标题
  content: string; // 故事正文（Markdown 文本）
  ability_summary: string; // 能力提升摘要 JSON 字符串
  photo_urls: string; // 精选相册 JSON 字符串
  created_at: string;
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

// 查询当前周期
export async function getCurrentCycle(childId: number): Promise<CurrentCycleResponse> {
  return request<CurrentCycleResponse>({
    method: 'GET',
    url: `/growth-cycles/current/${childId}`,
  });
}

// 解析 ability_summary JSON
export function parseAbilitySummary(summary: string): Array<{ dimension: string; delta: number }> {
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
