import { request } from './api';
import { PaginatedResponse } from './tasks';

export interface Transaction {
  id: number;
  childId: number;
  type: 0 | 1; // 0=收入 1=支出
  amount: number;
  reason: string;
  relatedId?: number;
  relatedType?: string;
  balanceAfter: number;
  created_at: string;
}

export interface BalanceResult {
  childId: number;
  child_name: string;
  balance: number;
}

export interface AdjustResult {
  childId: number;
  balance: number;
}

export interface TrendPoint {
  date: string;
  income: number;
  expense: number;
}

export interface MonthlyStats {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export async function getMonthlyStats(childId: number): Promise<MonthlyStats[]> {
  return request<MonthlyStats[]>({
    method: 'GET',
    url: '/score/monthly-stats',
    params: { child_id: childId },
  });
}

export async function getBalance(childId: number): Promise<{ child_id: number; child_name: string; balance: number }> {
  return request<{ child_id: number; child_name: string; balance: number }>({
    method: 'GET',
    url: '/score/balance',
    params: { child_id: childId },
  });
}

export async function getHistory(
  childId: number,
  page = 1,
  pageSize = 20,
  startDate?: string,
  endDate?: string,
): Promise<PaginatedResponse<Transaction>> {
  const params: Record<string, string | number> = { child_id: childId, page, page_size: pageSize };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  return request<PaginatedResponse<Transaction>>({
    method: 'GET',
    url: '/score/history',
    params,
  });
}

export async function addPoints(childId: number, points: number, title: string, description?: string, photo?: string): Promise<AdjustResult> {
  return request<AdjustResult>({
    method: 'POST',
    url: '/score/add',
    data: {
      child_id: childId,
      points,
      title,
      description,
      photo,
    },
  });
}

export async function deductPoints(childId: number, points: number, title: string, description?: string, photo?: string): Promise<AdjustResult> {
  return request<AdjustResult>({
    method: 'POST',
    url: '/score/deduct',
    data: {
      child_id: childId,
      points,
      title,
      description,
      photo,
    },
  });
}

export async function getTrend(childId: number, startDate: string, endDate: string): Promise<TrendPoint[]> {
  return request<TrendPoint[]>({
    method: 'GET',
    url: '/score/trend',
    params: { child_id: childId, start_date: startDate, end_date: endDate },
  });
}
