import { request } from './api';
import type { Task } from './tasks';

export interface TaskTemplate {
  id: number;
  family_id: number;
  title: string;
  description: string;
  points: number;
  icon: string;
  category: string;
  sort_order: number;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskTemplateParams {
  title: string;
  description?: string;
  points: number;
  icon?: string;
  category?: string;
  sort_order?: number;
}

export async function createTaskTemplate(
  params: CreateTaskTemplateParams,
): Promise<TaskTemplate> {
  return request<TaskTemplate>({
    method: 'POST',
    url: '/task-templates',
    data: params,
  });
}

export interface UpdateTaskTemplateParams {
  title?: string;
  description?: string;
  points?: number;
  icon?: string;
  category?: string;
  sort_order?: number;
  is_active?: boolean;
}

export async function updateTaskTemplate(
  id: number,
  params: UpdateTaskTemplateParams,
): Promise<TaskTemplate> {
  return request<TaskTemplate>({
    method: 'PUT',
    url: `/task-templates/${id}`,
    data: params,
  });
}

export async function deleteTaskTemplate(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/task-templates/${id}`,
  });
}

export async function listTaskTemplates(): Promise<TaskTemplate[]> {
  return request<TaskTemplate[]>({
    method: 'GET',
    url: '/task-templates',
  });
}

export async function getTaskTemplate(id: number): Promise<TaskTemplate> {
  return request<TaskTemplate>({
    method: 'GET',
    url: `/task-templates/${id}`,
  });
}

export async function createTaskFromTemplate(
  templateId: number,
  childId: number,
): Promise<Task> {
  return request<Task>({
    method: 'POST',
    url: `/task-templates/${templateId}/create-task`,
    data: { child_id: childId },
  });
}

export const ACHIEVEMENT_TYPE_OPTIONS = [
  { value: 1, label: '完成任务', icon: '✓', description: '完成指定数量的任务' },
  { value: 2, label: '模板任务', icon: '📋', description: '完成指定模板任务的数量' },
  { value: 3, label: '连续天数', icon: '🔥', description: '连续几天完成任务' },
  { value: 4, label: '累计积分', icon: '💰', description: '累计获得指定积分' },
];

export const TASK_CATEGORY_OPTIONS = [
  { value: '学习', icon: '📚', color: '#3B82F6' },
  { value: '家务', icon: '🧹', color: '#10B981' },
  { value: '行为习惯', icon: '😊', color: '#F59E0B' },
  { value: '运动', icon: '🏃', color: '#EF4444' },
  { value: '其他', icon: '⭐', color: '#8B5CF6' },
];
