import { request } from './api';
import type { Task } from './tasks';

export interface ParentTaskTemplate {
  id: number;
  family_id: number;
  title: string;
  description: string;
  category: string;
  min_age: number;
  max_age: number;
  estimated_days: number;
  key_milestones: string;
  is_system: boolean;
  created_at: string;
  template_type: string;
  [key: string]: unknown; // 兼容 TaskTemplate 返回的多余字段
}

// 获取年龄段适配的预设主题任务模板
export async function getPresetTemplates(age: number): Promise<ParentTaskTemplate[]> {
  return request<ParentTaskTemplate[]>({
    method: 'GET',
    url: '/parent-task-templates/preset',
    params: { age },
  });
}

// 创建自定义主题任务模板
export async function createCustomTemplate(data: {
  child_id: number;
  title: string;
  description: string;
  category: string;
  estimated_days: number;
}): Promise<ParentTaskTemplate> {
  return request<ParentTaskTemplate>({
    method: 'POST',
    url: '/parent-task-templates/custom',
    data,
  });
}

// 创建主题任务（父任务）
// body: child_id + cycle_id + template_id（基于模板）或 child_id + cycle_id + title/description/estimated_days/category（自定义）
// cycle_id 用于关联 goal，后端会自动在 goals 表建立 goal_type=parent_task 记录
export async function createParentTask(data: {
  child_id: number;
  cycle_id?: number;
  template_id?: number;
  title?: string;
  description?: string;
  estimated_days?: number;
  category?: string;
}): Promise<Task> {
  return request<Task>({
    method: 'POST',
    url: '/tasks/parent',
    data,
  });
}

// 删除主题任务（父任务）及其子任务和 goal 关联
export async function deleteParentTask(parentTaskId: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/tasks/parent/${parentTaskId}`,
  });
}

// 为主题任务生成子任务
export async function generateChildren(parentTaskId: number): Promise<void> {
  return request<void>({
    method: 'POST',
    url: `/tasks/parent/${parentTaskId}/generate-children`,
  });
}

// 推进下一批子任务
export async function advanceBatch(parentTaskId: number): Promise<void> {
  return request<void>({
    method: 'POST',
    url: `/tasks/parent/${parentTaskId}/advance-batch`,
  });
}

// 获取主题任务的子任务列表
export async function getChildren(parentTaskId: number): Promise<Task[]> {
  return request<Task[]>({
    method: 'GET',
    url: `/tasks/${parentTaskId}/children`,
  });
}

// 获取子任务对应的主题任务（父任务）
export async function getParent(taskId: number): Promise<Task> {
  return request<Task>({
    method: 'GET',
    url: `/tasks/${taskId}/parent`,
  });
}
