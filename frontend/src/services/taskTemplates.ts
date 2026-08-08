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
  min_age: number;
  max_age: number;
  difficulty: string;
  frequency: string;
  estimated_time: number;
  tags: string;
  is_system: boolean;
  ability_dimension_id: number;
  master_title: string;
  is_customized: boolean;
  share_status: string;
  template_type: string;      // daily/habit/parent
  estimated_days?: number;    // 仅 parent
  key_milestones?: string;    // 仅 parent JSON
}

export interface CreateTaskTemplateParams {
  title: string;
  description?: string;
  points: number;
  icon?: string;
  category?: string;
  sort_order?: number;
  min_age?: number;
  max_age?: number;
  estimated_time?: number;
  difficulty?: string;
  frequency?: string;
  tags?: string;
  ability_dimension_id?: number;
  template_type?: string;
  estimated_days?: number;
  key_milestones?: string;
}

export interface UpdateTaskTemplateParams {
  title?: string;
  description?: string;
  points?: number;
  icon?: string;
  category?: string;
  sort_order?: number;
  is_active?: boolean;
  min_age?: number;
  max_age?: number;
  estimated_time?: number;
  difficulty?: string;
  frequency?: string;
  tags?: string;
  ability_dimension_id?: number;
  template_type?: string;
  estimated_days?: number;
  key_milestones?: string;
}

export interface TemplateFilter {
  dimension_id?: number;
  is_system?: boolean;
  age?: number;
  category?: string;
  template_type?: string;
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

export async function listTaskTemplates(filter?: TemplateFilter): Promise<TaskTemplate[]> {
  const params: Record<string, string> = {};
  if (filter?.dimension_id) params.dimension_id = String(filter.dimension_id);
  if (filter?.is_system !== undefined) params.is_system = String(filter.is_system);
  if (filter?.age) params.age = String(filter.age);
  if (filter?.category) params.category = filter.category;
  if (filter?.template_type) params.template_type = filter.template_type;
  return request<TaskTemplate[]>({
    method: 'GET',
    url: '/task-templates',
    params,
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

// B 恢复系统默认模板
export async function resetSystemTemplate(title: string): Promise<void> {
  return request<void>({
    method: 'POST',
    url: '/task-template-actions/reset',
    params: { title },
  });
}

export async function restoreAllSystemTemplates(): Promise<{ restored: number }> {
  return request<{ restored: number }>({
    method: 'POST',
    url: '/task-template-actions/restore-all',
  });
}

// C 按维度批量启停
export async function batchToggleByDimension(
  dimension_id: number,
  is_active: boolean,
): Promise<{ affected: number }> {
  return request<{ affected: number }>({
    method: 'POST',
    url: '/task-template-actions/batch-toggle',
    data: { dimension_id, is_active },
  });
}

// C 多选批量启停
export async function batchToggleByIDs(
  ids: number[],
  is_active: boolean,
): Promise<{ affected: number }> {
  return request<{ affected: number }>({
    method: 'POST',
    url: '/task-template-actions/batch-toggle-ids',
    data: { ids, is_active },
  });
}

// D 模板广场
export async function shareToPlaza(id: number): Promise<TaskTemplate> {
  return request<TaskTemplate>({
    method: 'POST',
    url: `/task-templates/${id}/share`,
  });
}

export interface PlazaList {
  list: TaskTemplate[];
  total: number;
  page: number;
  size: number;
}

export async function listPlaza(
  dimension_id?: number,
  page = 1,
  size = 20,
): Promise<PlazaList> {
  const params: Record<string, string> = { page: String(page), size: String(size) };
  if (dimension_id) params.dimension_id = String(dimension_id);
  return request<PlazaList>({
    method: 'GET',
    url: '/task-template-plaza',
    params,
  });
}

export async function importFromPlaza(id: number): Promise<TaskTemplate> {
  return request<TaskTemplate>({
    method: 'POST',
    url: `/task-template-plaza/${id}/import`,
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

export const ABILITY_DIMENSION_OPTIONS = [
  { value: 1, label: '生活自理', icon: '👕', color: '#3B82F6' },
  { value: 2, label: '独立自主', icon: '🔑', color: '#8B5CF6' },
  { value: 3, label: '动手实践', icon: '🔧', color: '#10B981' },
  { value: 4, label: '学习认知', icon: '📚', color: '#F59E0B' },
  { value: 5, label: '社交情感', icon: '🤝', color: '#EC4899' },
  { value: 6, label: '身心健康', icon: '💪', color: '#EF4444' },
];

export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '简单', color: '#10B981' },
  { value: 'medium', label: '中等', color: '#F59E0B' },
  { value: 'hard', label: '挑战', color: '#EF4444' },
];

export const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'once', label: '单次' },
];

export function getDimensionLabel(id: number): string {
  return ABILITY_DIMENSION_OPTIONS.find((d) => d.value === id)?.label ?? '';
}

export function getDimensionIcon(id: number): string {
  return ABILITY_DIMENSION_OPTIONS.find((d) => d.value === id)?.icon ?? '⭐';
}

export function getDifficultyLabel(val: string): string {
  return DIFFICULTY_OPTIONS.find((d) => d.value === val)?.label ?? val;
}

export function getDifficultyColor(val: string): string {
  return DIFFICULTY_OPTIONS.find((d) => d.value === val)?.color ?? '#999';
}

export const TEMPLATE_TYPE_OPTIONS = [
  { value: 'daily', label: '日常任务', icon: '📋', color: '#3B82F6' },
  { value: 'habit', label: '习惯养成', icon: '🔥', color: '#F59E0B' },
  { value: 'parent', label: '主题任务', icon: '🎯', color: '#8B5CF6' },
];

export function getTemplateTypeLabel(val: string): string {
  return TEMPLATE_TYPE_OPTIONS.find((d) => d.value === val)?.label ?? '日常任务';
}

export function getTemplateTypeIcon(val: string): string {
  return TEMPLATE_TYPE_OPTIONS.find((d) => d.value === val)?.icon ?? '📋';
}

export function getTemplateTypeColor(val: string): string {
  return TEMPLATE_TYPE_OPTIONS.find((d) => d.value === val)?.color ?? '#3B82F6';
}
