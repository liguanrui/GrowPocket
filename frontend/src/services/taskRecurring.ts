import { request } from './api';
import type { TaskRecurringConfig, TaskFrequency } from '../types';

export interface CreateRecurringConfigParams {
  templateId?: number;
  childId: number;
  title: string;
  description?: string;
  points: number;
  frequency?: TaskFrequency;
  weekDays?: string;
}

export async function createRecurringConfig(params: CreateRecurringConfigParams): Promise<TaskRecurringConfig> {
  return request<TaskRecurringConfig>({
    method: 'POST',
    url: '/task-recurring-configs',
    data: params,
  });
}

export async function listRecurringConfigs(): Promise<TaskRecurringConfig[]> {
  return request<TaskRecurringConfig[]>({
    method: 'GET',
    url: '/task-recurring-configs',
  });
}

export async function getRecurringConfig(id: number): Promise<TaskRecurringConfig> {
  return request<TaskRecurringConfig>({
    method: 'GET',
    url: `/task-recurring-configs/${id}`,
  });
}

export interface UpdateRecurringConfigParams {
  title?: string;
  description?: string;
  frequency?: TaskFrequency;
  weekDays?: string;
  points?: number;
  isActive?: boolean;
}

export async function updateRecurringConfig(id: number, params: UpdateRecurringConfigParams): Promise<TaskRecurringConfig> {
  return request<TaskRecurringConfig>({
    method: 'PUT',
    url: `/task-recurring-configs/${id}`,
    data: params,
  });
}

export async function deleteRecurringConfig(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/task-recurring-configs/${id}`,
  });
}

export async function generateRecurringTasks(): Promise<{ message: string }> {
  return request<{ message: string }>({
    method: 'POST',
    url: '/task-recurring-configs/generate',
  });
}
