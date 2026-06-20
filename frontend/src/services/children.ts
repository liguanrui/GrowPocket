import { request } from './api';

export interface Child {
  id: number;
  familyId: number;
  role: 'child';
  nickname: string;
  avatar?: string;
  gender?: 0 | 1;
  birthday?: string;
  balance: number;
  created_at?: string;
  updated_at?: string;
}

export interface AddChildInput {
  nickname: string;
  gender?: 0 | 1;
  birthday?: string;
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

export async function updateChild(id: number, input: Partial<AddChildInput> & { avatar?: string }): Promise<Child> {
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

export async function updateFamilyName(name: string): Promise<{ id: number; name: string }> {
  return request<{ id: number; name: string }>({
    method: 'PUT',
    url: '/family/name',
    data: { name },
  });
}
