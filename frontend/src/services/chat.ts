import { request } from './api';

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  created_at: string;
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
