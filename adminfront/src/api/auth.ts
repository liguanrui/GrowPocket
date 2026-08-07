import api from '@/lib/axios'
import type {
  AdminUser,
  ApiResponse,
  ChangePasswordRequest,
  CreateAdminRequest,
  LoginRequest,
  LoginResponse,
  OperationLog,
  PaginatedResponse,
  UpdateAdminRequest,
} from '@/types'

type ListAdminsQuery = {
  page?: number
  pageSize?: number
  keyword?: string
  role?: string
  status?: string
}

type ListOperationLogsQuery = {
  page?: number
  pageSize?: number
  adminId?: number
  action?: string
  startAt?: string
  endAt?: string
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', data)
  return res.data.data
}

export async function me(): Promise<AdminUser> {
  const res = await api.get<ApiResponse<AdminUser>>('/auth/me')
  return res.data.data
}

export async function changePassword(data: ChangePasswordRequest): Promise<void> {
  await api.post<ApiResponse<void>>('/auth/change-password', data)
}

export async function refreshToken(): Promise<{ token: string; expiresAt: string }> {
  const res = await api.post<ApiResponse<{ token: string; expiresAt: string }>>(
    '/auth/refresh-token'
  )
  return res.data.data
}

export async function logout(): Promise<void> {
  await api.post<ApiResponse<void>>('/auth/logout')
}

export async function listAdmins(
  params: ListAdminsQuery = {}
): Promise<PaginatedResponse<AdminUser>> {
  const res = await api.get<ApiResponse<PaginatedResponse<AdminUser>>>('/admins', {
    params,
  })
  return res.data.data
}

export async function createAdmin(
  data: CreateAdminRequest
): Promise<AdminUser> {
  const res = await api.post<ApiResponse<AdminUser>>('/admins', data)
  return res.data.data
}

export async function updateAdmin(
  id: number,
  data: UpdateAdminRequest
): Promise<AdminUser> {
  const res = await api.patch<ApiResponse<AdminUser>>(`/admins/${id}`, data)
  return res.data.data
}

export async function deleteAdmin(id: number): Promise<void> {
  await api.delete<ApiResponse<void>>(`/admins/${id}`)
}

export async function listOperationLogs(
  params: ListOperationLogsQuery = {}
): Promise<PaginatedResponse<OperationLog>> {
  const res = await api.get<ApiResponse<PaginatedResponse<OperationLog>>>(
    '/operation-logs',
    { params }
  )
  return res.data.data
}
