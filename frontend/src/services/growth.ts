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
