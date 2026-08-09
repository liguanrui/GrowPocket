import { request } from './api';

export interface Child {
  id: number;
  family_id: number;
  familyId?: number;
  role: 'child';
  nickname: string;
  avatar?: string;
  gender?: 0 | 1;
  birthday?: string | null;
  grade?: number | null; // 手动覆盖值，展示时优先 derived_grade
  grade_overridden?: boolean;
  age?: number | null;
  hobbies?: string; // JSON 数组字符串
  balance: number;
  created_at?: string;
  updated_at?: string;
  // 后端派生字段（滚动计算，前端直接用）
  derived_age?: number;
  derived_grade?: number;
  is_birthday_today?: boolean;
}

export interface AddChildInput {
  nickname: string;
  gender?: 0 | 1;
  birthday?: string;
  grade?: number;
  grade_overridden?: boolean;
  age?: number;
  hobbies?: string; // JSON 数组字符串
}

export async function getChildren(): Promise<Child[]> {
  return request<Child[]>({
    method: 'GET',
    url: '/children',
  });
}

export async function getChild(id: number): Promise<Child> {
  return request<Child>({
    method: 'GET',
    url: `/children/${id}`,
  });
}

export async function addChild(input: AddChildInput): Promise<Child> {
  return request<Child>({
    method: 'POST',
    url: '/children',
    data: input,
  });
}

export async function updateChild(id: number, input: Partial<AddChildInput> & { avatar?: string; grade_overridden?: boolean }): Promise<Child> {
  return request<Child>({
    method: 'PUT',
    url: `/children/${id}`,
    data: input,
  });
}

export async function deleteChild(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/children/${id}`,
  });
}

export async function updateFamilyName(name: string): Promise<{ id: number; name: string; share_code?: string }> {
  return request<{ id: number; name: string; share_code?: string }>({
    method: 'PUT',
    url: '/family/name',
    data: { name },
  });
}

export interface FamilyInfo {
  id: number;
  name: string;
  share_code: string;
  child_count: number;
  is_active: boolean;
}

export async function getFamily(): Promise<FamilyInfo> {
  return request<FamilyInfo>({
    method: 'GET',
    url: '/family',
  });
}

export async function regenerateShareCode(): Promise<FamilyInfo> {
  return request<FamilyInfo>({
    method: 'POST',
    url: '/family/share-code/regenerate',
  });
}
