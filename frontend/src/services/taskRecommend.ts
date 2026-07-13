import { request } from './api';
import type { RecommendedTask } from '../types';

export interface GetRecommendationsParams {
  childId: number;
  count?: number;
}

export async function getTaskRecommendations(params: GetRecommendationsParams): Promise<RecommendedTask[]> {
  const query = new URLSearchParams();
  query.set('child_id', String(params.childId));
  if (params.count) {
    query.set('count', String(params.count));
  }
  return request<RecommendedTask[]>({
    method: 'GET',
    url: `/task-recommendations?${query.toString()}`,
  });
}
