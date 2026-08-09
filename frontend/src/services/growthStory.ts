import { request } from './api';
import type { Task } from './tasks';

// 能力维度变化（阶段回顾时生成 —— 仅 cycle 类型）
export interface AbilityDelta {
  dimension_id: number;
  dimension_name: string;
  old_score: number;
  new_score: number;
  delta: number;
}

// 大师挑战验收评分（仅 project 类型 ability_summary 为此结构）
export interface ProjectAbilitySummary {
  participation_score: number; // 参与度 1-5
  application_score: number;   // 能力应用度 1-5
  quality_score: number;       // 成果满意度 1-5
  passed: boolean;             // 是否通过
  points_awarded: number;      // 稀有积分奖励
}

export type ParsedAbilitySummary =
  | { kind: 'cycle'; deltas: AbilityDelta[] }
  | { kind: 'project'; summary: ProjectAbilitySummary }
  | { kind: 'empty' };

export interface GrowthStory {
  id: number;
  cycle_id: number;
  family_id: number;
  child_id: number;
  title: string; // 故事标题
  content: string; // 故事正文（Markdown 文本）
  ability_summary: string; // 能力提升摘要 JSON 字符串：cycle→AbilityDelta[], project→ProjectAbilitySummary
  photo_urls: string; // 精选相册 JSON 字符串
  created_at: string;
  // V3.1 模块 B：故事类型 cycle（周期回顾）/ project（大师挑战）
  type?: string;
  // 大师挑战故事关联的实例 ID（仅 type=project 时有值）
  master_challenge_instance_id?: number | null;
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

// 查询成长故事（按 cycle_id）——仅适用于 cycle 类型
export async function getStory(cycleId: number): Promise<GrowthStory> {
  return request<GrowthStory>({
    method: 'GET',
    url: `/growth-stories/${cycleId}`,
  });
}

// 查询成长故事（按故事主键 ID）——支持 cycle 和 project 两种类型
export async function getStoryById(storyId: number): Promise<GrowthStory> {
  return request<GrowthStory>({
    method: 'GET',
    url: `/growth-stories/by-id/${storyId}`,
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

// 查询周期内所有已完成任务（子任务时间线）——仅 cycle 类型适用
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

// 统一解析 ability_summary：自动区分 cycle / project / empty
export function parseAbilitySummaryAny(summary: string, storyType?: string): ParsedAbilitySummary {
  if (!summary) return { kind: 'empty' };
  try {
    const parsed = JSON.parse(summary);
    // project 类型：优先按类型判断，其次按结构特征（有 passed 字段）
    if (storyType === 'project' || (parsed && typeof parsed === 'object' && 'passed' in parsed)) {
      return {
        kind: 'project',
        summary: {
          participation_score: Number(parsed.participation_score) || 0,
          application_score: Number(parsed.application_score) || 0,
          quality_score: Number(parsed.quality_score) || 0,
          passed: !!parsed.passed,
          points_awarded: Number(parsed.points_awarded) || 0,
        },
      };
    }
    // cycle 类型：数组结构
    if (Array.isArray(parsed)) {
      return { kind: 'cycle', deltas: parsed };
    }
    return { kind: 'empty' };
  } catch {
    return { kind: 'empty' };
  }
}

// 解析 ability_summary JSON（cycle 类型）——兼容旧调用，内部走 parseAbilitySummaryAny
export function parseAbilitySummary(summary: string): AbilityDelta[] {
  const parsed = parseAbilitySummaryAny(summary, 'cycle');
  return parsed.kind === 'cycle' ? parsed.deltas : [];
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
