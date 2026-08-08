import { request } from './api';
import type { ActionSuggestion } from '../components/ActionConfirmCard';

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  created_at: string;
  // AI 回复携带的可执行动作建议（Function Calling 产出，空数组或缺省表示无）
  suggested_actions?: ActionSuggestion[];
}

export interface ChatSession {
  id: number;
  family_id: number;
  child_id: number;
  user_id: number;
  role: string;
  mode?: string; // 对话模式：parent=家长代聊 / child=儿童本人
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
  // 后端 Function Calling 产出的动作建议（空时为 []）
  suggested_actions?: ActionSuggestion[];
}

export interface GetHistoryResponse {
  messages: ChatMessage[];
  session_id: number;
}

export type ChatMode = 'parent' | 'child';

export async function sendMessage(
  message: string,
  childId: number,
  sessionId?: number,
  mode?: ChatMode,
): Promise<SendMessageResponse> {
  return request<SendMessageResponse>({
    method: 'POST',
    url: '/chat/message',
    data: { message, child_id: childId, session_id: sessionId, mode },
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
export async function createSession(childId: number, mode?: ChatMode): Promise<ChatSession> {
  return request<ChatSession>({
    method: 'POST',
    url: '/chat/sessions',
    data: { child_id: childId, mode },
  });
}

// 获取指定会话的全部消息
export async function getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
  return request<ChatMessage[]>({
    method: 'GET',
    url: `/chat/sessions/${sessionId}/messages`,
  });
}

// 上报动作确认结果（用户确认 / 取消 / 失败时调用，供后端记录审计）
// result 取值：success / cancelled / failed
export async function confirmAction(
  messageId: number,
  action: string,
  params: Record<string, unknown>,
  result: string,
  apiResponse?: unknown,
): Promise<void> {
  return request<void>({
    method: 'POST',
    url: '/chat/message/confirm',
    data: {
      message_id: messageId,
      action,
      params,
      result,
      api_response: apiResponse,
    },
  });
}
