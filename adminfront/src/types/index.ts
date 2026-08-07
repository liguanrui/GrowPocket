export type AdminRole = 'super_admin' | 'admin' | 'operator'

export interface AdminUser {
  id: number
  username: string
  nickname: string
  role: AdminRole
  avatar?: string
  email?: string
  phone?: string
  status: 'active' | 'disabled'
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: Pagination
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: AdminUser
  expiresAt: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export interface CreateAdminRequest {
  username: string
  password: string
  nickname: string
  role: AdminRole
  email?: string
  phone?: string
}

export interface UpdateAdminRequest {
  nickname?: string
  role?: AdminRole
  email?: string
  phone?: string
  status?: 'active' | 'disabled'
}

export interface OperationLog {
  id: number
  adminId: number
  adminUsername: string
  action: string
  targetType?: string
  targetId?: number
  detail?: string
  ip?: string
  userAgent?: string
  createdAt: string
}

export type MenuKey =
  | 'dashboard'
  | 'families'
  | 'children'
  | 'parents'
  | 'tasks'
  | 'redeem-items'
  | 'achievements'
  | 'logs'
  | 'admin-users'

export interface MenuItem {
  key: MenuKey
  label: string
  icon: string
  path: string
  roles: AdminRole[]
}

export interface OverviewStats {
  total_families: number
  total_parents: number
  total_children: number
  today_new_families: number
  today_new_children: number
  today_active_tasks: number
  today_completed_tasks: number
  today_income_points: number
  today_expense_points: number
  total_tasks: number
  total_redeem_orders: number
  ai_generated_task_ratio: number
  top_hot_tasks: {
    id: number
    title: string
    category: string
    points: number
    completed_count: number
  }[]
  top_redeem_items: {
    id: number
    name: string
    points: number
    redeemed_count: number
  }[]
}

export interface TrendStats {
  family_registration_trend: { date: string; value: number }[]
  task_completion_trend: { date: string; value: number }[]
  points_income_trend: { date: string; value: number }[]
  points_expense_trend: { date: string; value: number }[]
  grade_distribution: { grade_label: string; count: number }[]
  task_category_distribution: { category: string; count: number }[]
  redeem_category_distribution: {
    category: number
    name: string
    count: number
  }[]
}

export interface AbilityRadar {
  dimensions: { id: number; code: string; name: string; color: string }[]
  platform_avg: number[]
  by_grade: Record<string, number[]>
}

export interface Family {
  id: number
  name: string
  is_active: boolean
  created_at: string
}

export interface FamilyListDTO extends Family {
  parent_count: number
  child_count: number
  total_balance: number
  task_count: number
  redeem_count: number
}

export interface ChildListItem {
  id: number
  family_id: number
  family_name: string
  nickname: string
  avatar?: string
  gender?: number
  birthday?: string
  grade?: number
  age?: number
  hobbies?: string
  balance: number
  stats: {
    task_total: number
    task_completed: number
    redeem_count: number
    growth_index?: number
  }
  created_at: string
}

export interface ChildDetailDTO {
  id: number
  family_id: number
  family_name: string
  nickname: string
  avatar?: string
  gender?: number
  birthday?: string
  grade?: number
  age?: number
  hobbies?: string
  balance: number
  created_at: string
  total_points_earned: number
  total_points_spent: number
  task_stats: {
    total: number
    completed: number
    pending: number
    rejected: number
  }
  growth_cycle_count: number
  ability_scores: {
    dimension_id: number
    dimension_code: string
    dimension_name: string
    dimension_color: string
    score: number
  }[]
}

export interface ParentListItem {
  id: number
  family_id: number
  nickname: string
  avatar?: string
  created_at: string
}

export interface FamilyDetailDTO {
  family: Family
  parents: ParentListItem[]
  children: ChildDetailDTO[]
  recent_tasks: any[]
  recent_transactions: any[]
  recent_redeems: any[]
}

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
