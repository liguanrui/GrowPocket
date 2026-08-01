import { request } from './api';
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

// 提交成果（上传照片或传照片URL）
export async function submitTask(id: number, photo: string): Promise<Task> {
  return request<Task>({
    method: 'PUT',
    url: `/tasks/${id}/submit`,
    data: { photo },
  });
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
