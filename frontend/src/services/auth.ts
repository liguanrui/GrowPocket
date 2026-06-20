import { request } from './api';

export interface AuthUser {
  id: number;
  nickname: string;
  role: 'parent' | 'child';
}

export interface AuthFamily {
  id: number;
  name: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  family: AuthFamily;
}

export async function register(nickname: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>({
    method: 'POST',
    url: '/auth/register',
    data: { nickname, password },
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
