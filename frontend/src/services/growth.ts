import { request } from './api';
import { PaginatedResponse } from './tasks';

export interface AlbumPhoto {
  task_id: number;
  task_title: string;
  photo: string;
  points: number;
  created_at: string;
}

export interface TimelineEvent {
  type: 'task' | 'reward' | 'redeem' | 'manual';
  title: string;
  points: number;
  time: string;
}

export interface TimelineDay {
  date: string;
  events: TimelineEvent[];
}

export interface Achievement {
  id: number;
  family_id?: number;
  name: string;
  description: string;
  icon: string;
  icon_color?: string;
  type: number;
  target_value: number;
  points: number;
  is_custom?: boolean;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserAchievement {
  id: number;
  child_id: number;
  achievement_id: number;
  unlocked: boolean;
  unlocked_at?: string;
  current_value: number;
  Achievement: Achievement;
}

export async function getAlbum(
  childId: number,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<AlbumPhoto>> {
  return request<PaginatedResponse<AlbumPhoto>>({
    method: 'GET',
    url: '/growth/album',
    params: { child_id: childId, page, page_size: pageSize },
  });
}

export async function getTimeline(childId: number, days = 30): Promise<TimelineDay[]> {
  return request<TimelineDay[]>({
    method: 'GET',
    url: '/growth/timeline',
    params: { child_id: childId, days },
  });
}

export async function getAchievements(childId: number): Promise<UserAchievement[]> {
  return request<UserAchievement[]>({
    method: 'GET',
    url: '/achievements',
    params: { child_id: childId },
  });
}

export async function checkAndUnlock(childId: number): Promise<UserAchievement[]> {
  return request<UserAchievement[]>({
    method: 'POST',
    url: '/achievements/check',
    params: { child_id: childId },
  });
}

// ==================== 自定义勋章 CRUD ====================

export interface CreateAchievementParams {
  name: string;
  description: string;
  icon: string;
  icon_color?: string;
  type: number;
  target_value: number;
  points: number;
}

export async function createAchievement(params: CreateAchievementParams): Promise<Achievement> {
  return request<Achievement>({
    method: 'POST',
    url: '/achievements',
    data: params,
  });
}

export interface UpdateAchievementParams {
  name?: string;
  description?: string;
  icon?: string;
  icon_color?: string;
  type?: number;
  target_value?: number;
  points?: number;
}

export async function updateAchievement(
  id: number,
  params: UpdateAchievementParams,
): Promise<Achievement> {
  return request<Achievement>({
    method: 'PUT',
    url: `/achievements/${id}`,
    data: params,
  });
}

export async function deleteAchievement(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/achievements/${id}`,
  });
}
