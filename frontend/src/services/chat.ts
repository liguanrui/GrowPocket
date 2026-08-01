import { request } from './api';

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  created_at: string;
}

export interface ChatSession {
  id: number;
  family_id: number;
  child_id: number;
  user_id: number;
  role: string;
  title: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface SendMessageResponse {
  reply: string;
  intent: string;
  session_id: number;
}

export interface GetHistoryResponse {
  messages: ChatMessage[];
  session_id: number;
}

export async function sendMessage(message: string, childId: number, sessionId?: number): Promise<SendMessageResponse> {
  return request<SendMessageResponse>({
    method: 'POST',
    url: '/chat/message',
    data: { message, child_id: childId, session_id: sessionId },
  });
}

export async function getChatHistory(childId: number): Promise<GetHistoryResponse> {
  return request<GetHistoryResponse>({
    method: 'GET',
    url: `/chat/history/${childId}`,
  });
}

// 获取儿童的会话列表（按最后消息时间倒序）
export async function getSessions(childId: number): Promise<ChatSession[]> {
  return request<ChatSession[]>({
    method: 'GET',
    url: '/chat/sessions',
    params: { child_id: childId },
  });
}

// 搜索会话（匹配标题或最后消息）
export async function searchSessions(childId: number, q: string): Promise<ChatSession[]> {
  return request<ChatSession[]>({
    method: 'GET',
    url: '/chat/sessions/search',
    params: { child_id: childId, q },
  });
}

// 主动新建会话
export async function createSession(childId: number): Promise<ChatSession> {
  return request<ChatSession>({
    method: 'POST',
    url: '/chat/sessions',
    data: { child_id: childId },
  });
}

// 获取指定会话的全部消息
export async function getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
  return request<ChatMessage[]>({
    method: 'GET',
    url: `/chat/sessions/${sessionId}/messages`,
  });
}
