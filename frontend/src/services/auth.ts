import { request } from './api';

export interface AuthUser {
  id: number;
  nickname: string;
  role: 'parent' | 'child';
}

export interface AuthFamily {
  id: number;
  name: string;
  share_code?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  family: AuthFamily;
  has_children?: boolean;
  joined?: boolean;
}

export async function register(
  nickname: string,
  password: string,
  shareCode?: string,
): Promise<LoginResponse> {
  const data: Record<string, string> = { nickname, password };
  if (shareCode?.trim()) data.share_code = shareCode.trim().toUpperCase();
  return request<LoginResponse>({
    method: 'POST',
    url: '/auth/register',
    data,
  });
}

export async function login(nickname: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>({
    method: 'POST',
    url: '/auth/login',
    data: { nickname, password },
  });
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('currentFamily');
}
