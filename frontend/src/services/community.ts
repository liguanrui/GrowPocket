import { request } from './api';

export type ShareType = 'text' | 'text_image' | 'text_task';

export interface CommunityShare {
  id: number;
  family_id: number;
  user_id: number;
  nickname: string;
  share_type: ShareType;
  content: string;
  photos?: string;
  photo_list?: string[];
  task_id?: number;
  task_title?: string;
  task_points?: number;
  child_name?: string;
  tag?: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface CommunityComment {
  id: number;
  share_id: number;
  family_id: number;
  user_id: number;
  nickname: string;
  content: string;
  created_at: string;
}

export interface CharityProject {
  id: number;
  title: string;
  icon: string;
  description: string;
  points_per_kg: number;
  created_at: string;
}

export type DonationStatus = 1 | 2 | 3;

export interface CharityDonation {
  id: number;
  family_id: number;
  child_id: number;
  child_name: string;
  project_id: number;
  project_title: string;
  weight: number;
  details?: string;
  contact_name?: string;
  contact_phone?: string;
  address?: string;
  photo?: string;
  points: number;
  status: DonationStatus;
  created_at: string;
  received_at?: string;
  completed_at?: string;
}

export interface CharityActivity {
  id: number;
  family_id: number;
  user_id: number;
  nickname: string;
  title: string;
  activity_type: number;
  description?: string;
  location?: string;
  event_time: string;
  max_participants: number;
  participants_count: number;
  points: number;
  organizer_points: number;
  status: number; // 1=招募中, 2=已结束
  created_at: string;
  updated_at: string;
}

export interface ActivityParticipant {
  id: number;
  activity_id: number;
  family_id: number;
  child_id: number;      // 参与的孩子ID
  child_name: string;    // 孩子姓名
  points_earned: number;
  completed: boolean;
  photo?: string;
  created_at: string;
  completed_at?: string;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page?: number;
  page_size?: number;
}

// ===== 社区分享 =====
export async function createShare(data: {
  share_type: ShareType;
  content: string;
  photos?: string[];
  task_id?: number;
  task_title?: string;
  task_points?: number;
  child_name?: string;
  tag?: string;
}): Promise<CommunityShare> {
  return request<CommunityShare>({
    url: '/community/shares',
    method: 'POST',
    data,
  });
}

export async function fetchShares(params: {
  page?: number;
  page_size?: number;
  sort?: 'latest' | 'popular';
}): Promise<ListResponse<CommunityShare>> {
  return request<ListResponse<CommunityShare>>({
    url: '/community/shares',
    method: 'GET',
    params,
  });
}

export async function fetchShare(id: number): Promise<CommunityShare> {
  return request<CommunityShare>({
    url: `/community/shares/${id}`,
    method: 'GET',
  });
}

export async function deleteShare(id: number): Promise<void> {
  return request<void>({
    url: `/community/shares/${id}`,
    method: 'DELETE',
  });
}

export async function toggleLike(shareId: number): Promise<{ liked: boolean; like_count: number }> {
  return request<{ liked: boolean; like_count: number }>({
    url: `/community/shares/${shareId}/like`,
    method: 'POST',
  });
}

export async function addComment(shareId: number, content: string): Promise<CommunityComment> {
  return request<CommunityComment>({
    url: `/community/shares/${shareId}/comments`,
    method: 'POST',
    data: { content },
  });
}

export async function fetchComments(shareId: number): Promise<ListResponse<CommunityComment>> {
  return request<ListResponse<CommunityComment>>({
    url: `/community/shares/${shareId}/comments`,
    method: 'GET',
  });
}

// ===== 公益项目 =====
export async function fetchCharityProjects(): Promise<ListResponse<CharityProject>> {
  return request<ListResponse<CharityProject>>({
    url: '/community/charity-projects',
    method: 'GET',
  });
}

export async function createDonation(projectId: number, data: {
  child_id: number;
  weight: number;
  details?: string;
  contact_name: string;
  contact_phone: string;
  address: string;
  photo?: string;
}): Promise<CharityDonation> {
  return request<CharityDonation>({
    url: `/community/charity-projects/${projectId}/donate`,
    method: 'POST',
    data,
  });
}

export async function fetchMyDonations(): Promise<ListResponse<CharityDonation>> {
  return request<ListResponse<CharityDonation>>({
    url: '/community/charity-projects/my',
    method: 'GET',
  });
}

// ===== 公益活动 =====
export async function createActivity(data: {
  title: string;
  activity_type: number;
  description?: string;
  location?: string;
  event_time: string;
  max_participants?: number;
  points?: number;
}): Promise<CharityActivity> {
  return request<CharityActivity>({
    url: '/community/activities',
    method: 'POST',
    data,
  });
}

export async function fetchActivities(params: {
  page?: number;
  page_size?: number;
  type?: number;
}): Promise<ListResponse<CharityActivity>> {
  return request<ListResponse<CharityActivity>>({
    url: '/community/activities',
    method: 'GET',
    params,
  });
}

export async function fetchActivity(id: number): Promise<{
  activity: CharityActivity;
  participants: ActivityParticipant[];
}> {
  return request<{ activity: CharityActivity; participants: ActivityParticipant[] }>({
    url: `/community/activities/${id}`,
    method: 'GET',
  });
}

export async function joinActivity(id: number, childId: number): Promise<ActivityParticipant> {
  return request<ActivityParticipant>({
    url: `/community/activities/${id}/join`,
    method: 'POST',
    params: { child_id: childId },
  });
}

export async function completeActivity(id: number, childId: number, photo?: string): Promise<{
  points_earned: number;
  success: boolean;
}> {
  return request<{ points_earned: number; success: boolean }>({
    url: `/community/activities/${id}/complete`,
    method: 'POST',
    data: { child_id: childId, photo: photo || '' },
  });
}

export async function deleteActivity(id: number): Promise<void> {
  return request<void>({
    url: `/community/activities/${id}`,
    method: 'DELETE',
  });
}

export async function fetchMyActivities(): Promise<ListResponse<CharityActivity>> {
  return request<ListResponse<CharityActivity>>({
    url: '/community/activities/my',
    method: 'GET',
  });
}
