import { request } from './api';
import { PaginatedResponse } from './tasks';

export interface RedeemItem {
  id: number;
  familyId: number;
  name: string;
  description?: string;
  points: number;
  image?: string;
  category: 0 | 1 | 2; // 0=物质 1=体验 2=其他
  stock: number;
  created_at: string;
  updated_at: string;
}

export interface RedeemRecord {
  id: number;
  childId: number;
  childName: string;
  itemId: number;
  itemName: string;
  itemImage?: string;
  points: number;
  created_at: string;
}

export interface CreateItemInput {
  name: string;
  description?: string;
  points: number;
  image?: string;
  category: 0 | 1 | 2;
  stock: number;
}

export async function createItem(input: CreateItemInput): Promise<RedeemItem> {
  return request<RedeemItem>({
    method: 'POST',
    url: '/redeem/items',
    data: input,
  });
}

export async function getItems(params?: {
  category?: number;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<RedeemItem>> {
  const p = params || {};
  return request<PaginatedResponse<RedeemItem>>({
    method: 'GET',
    url: '/redeem/items',
    params: {
      ...(p.category !== undefined ? { category: p.category } : {}),
      page: p.page || 1,
      page_size: p.pageSize || 20,
    },
  });
}

export async function getItem(id: number): Promise<RedeemItem> {
  return request<RedeemItem>({
    method: 'GET',
    url: `/redeem/items/${id}`,
  });
}

export async function updateItem(id: number, input: Partial<CreateItemInput>): Promise<RedeemItem> {
  return request<RedeemItem>({
    method: 'PUT',
    url: `/redeem/items/${id}`,
    data: input,
  });
}

export async function deleteItem(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/redeem/items/${id}`,
  });
}

export async function redeem(itemId: number, childId: number): Promise<{ new_balance: number; redeem: RedeemRecord }> {
  return request<{ new_balance: number; redeem: RedeemRecord }>({
    method: 'POST',
    url: '/redeems',
    data: { item_id: itemId, child_id: childId },
  });
}

export async function getRedeems(
  childId: number,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<RedeemRecord>> {
  return request<PaginatedResponse<RedeemRecord>>({
    method: 'GET',
    url: '/redeems',
    params: { child_id: childId, page, page_size: pageSize },
  });
}
