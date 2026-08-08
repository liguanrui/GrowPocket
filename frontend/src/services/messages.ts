import { request } from './api';

export type SystemMessageType =
  | 'activity_join_success'
  | 'activity_new_signup'
  | 'activity_full'
  | 'activity_completed'
  | 'activity_published'
  | 'activity_tip'
  | string;

export interface SystemMessage {
  id: number;
  family_id: number;
  user_id: number;
  type: SystemMessageType;
  title: string;
  content: string;
  related_type?: string;
  related_id?: number;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export async function fetchMessages(params?: {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
}): Promise<{ items: SystemMessage[]; total: number }> {
  return request({
    url: '/messages',
    method: 'GET',
    params: {
      page: params?.page || 1,
      page_size: params?.page_size || 30,
      ...(params?.unread_only ? { unread_only: 1 } : {}),
    },
  });
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await request<{ count: number }>({
    url: '/messages/unread-count',
    method: 'GET',
  });
  return res?.count || 0;
}

export async function markMessageRead(id: number): Promise<void> {
  await request({
    url: `/messages/${id}/read`,
    method: 'POST',
  });
}

export async function markAllMessagesRead(): Promise<void> {
  await request({
    url: '/messages/read-all',
    method: 'POST',
  });
}
