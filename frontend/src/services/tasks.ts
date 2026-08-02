import api, { request } from './api';
import type { ApiResponse } from './api';
import * as growthService from './growth';

// 任务状态：1=进行中 2=待验收 3=已完成 4=已拒绝
export type TaskStatus = 1 | 2 | 3 | 4;

export interface Task {
  id: number;
  family_id: number;
  title: string;
  description?: string;
  points: number;
  status: TaskStatus;
  child_id: number;
  child_name?: string;
  created_by: number;
  photo?: string;
  deadline?: string;
  created_at: string;
  updated_at: string;
  category?: string;
  difficulty?: string;
  frequency?: string;
  recurring_id?: number;
  ability_dimension_id?: number;
  secondary_dimensions?: string; // JSON 如 "[2,5]"
  ai_generated?: boolean;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  points: number;
  childId: number;
  deadline?: string;
  status?: 1 | 3; // 1=进行中(默认)，3=直接创建为已完成(奖惩任务)
  photo?: string;
  abilityDimensionId?: number;
  secondaryDimensions?: number[]; // 次维度ID数组
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return request<Task>({
    method: 'POST',
    url: '/tasks',
    data: {
      title: input.title,
      description: input.description,
      points: input.points,
      child_id: input.childId,
      deadline: input.deadline,
      status: input.status,
      photo: input.photo,
      ability_dimension_id: input.abilityDimensionId,
      secondary_dimensions: input.secondaryDimensions ? JSON.stringify(input.secondaryDimensions) : undefined,
    },
  });
}

export async function getTasks(params?: {
  childId?: number;
  status?: TaskStatus;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<Task>> {
  const p = params || {};
  const qs: Record<string, string | number> = {};
  if (p.childId) qs.child_id = p.childId;
  if (p.status) qs.status = p.status;
  if (p.page) qs.page = p.page;
  if (p.pageSize) qs.page_size = p.pageSize;
  return request<PaginatedResponse<Task>>({
    method: 'GET',
    url: '/tasks',
    params: qs,
  });
}

export async function getTask(id: number): Promise<Task> {
  return request<Task>({
    method: 'GET',
    url: `/tasks/${id}`,
  });
}

export async function updateTask(id: number, input: Partial<CreateTaskInput>): Promise<Task> {
  return request<Task>({
    method: 'PUT',
    url: `/tasks/${id}`,
    data: {
      title: input.title,
      description: input.description,
      points: input.points,
      deadline: input.deadline,
    },
  });
}

export async function deleteTask(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/tasks/${id}`,
  });
}

// 上传成果媒体（图片或视频），返回可访问 URL
export async function uploadMedia(file: File): Promise<{ url: string; type: 'image' | 'video' }> {
  const form = new FormData();
  form.append('file', file);
  const response = await api.post<ApiResponse<{ url: string; type: 'image' | 'video' }>>(
    '/upload',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    },
  );
  const data = response.data?.data;
  if (!data?.url) throw new Error('上传失败');
  return data;
}

// 提交验收（photo 可选：图片/视频 URL，或空字符串表示无附件）
export async function submitTask(id: number, photo?: string): Promise<Task> {
  return request<Task>({
    method: 'PUT',
    url: `/tasks/${id}/submit`,
    data: { photo: photo || '' },
  });
}

export function isVideoMediaUrl(url?: string): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

// 家长验收
export async function reviewTask(id: number, approved: boolean, points?: number): Promise<Task> {
  const task = await request<Task>({
    method: 'PUT',
    url: `/tasks/${id}/review`,
    data: { approved, points: points || undefined },
  });

  if (approved && task.status === 3) {
    growthService.checkAndUnlock(task.child_id).catch(() => {});
  }

  return task;
}

// AI 任务审核（v3）
// action: confirm 确认 / adjust 调整 / reject 拒绝（删除）
export async function reviewAITask(
  id: number,
  action: 'confirm' | 'adjust' | 'reject',
  data?: { title?: string; points?: number; difficulty?: string }
): Promise<Task | { deleted: boolean }> {
  return request<Task | { deleted: boolean }>({
    method: 'PUT',
    url: `/tasks/${id}/ai-review`,
    data: { action, ...data },
  });
}

// 手动触发：为指定儿童生成今日 AI 任务
export async function generateAITasks(childId: number): Promise<{ tasks: Task[]; count: number }> {
  return request<{ tasks: Task[]; count: number }>({
    method: 'POST',
    url: '/tasks/ai-generate',
    data: { child_id: childId },
  });
}
