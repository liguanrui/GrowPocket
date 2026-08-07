import {
  LayoutDashboard,
  Users,
  Baby,
  UserCircle,
  ListTodo,
  Gift,
  Trophy,
  FileText,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import type { AdminRole, MenuItem } from '@/types'

export const iconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  families: Users,
  children: Baby,
  parents: UserCircle,
  tasks: ListTodo,
  'redeem-items': Gift,
  achievements: Trophy,
  logs: FileText,
  'admin-users': Shield,
}

export const menuItems: MenuItem[] = [
  {
    key: 'dashboard',
    label: '数据概览',
    icon: 'dashboard',
    path: '/dashboard',
    roles: ['super_admin', 'admin', 'operator'],
  },
  {
    key: 'families',
    label: '家庭列表',
    icon: 'families',
    path: '/families',
    roles: ['super_admin', 'admin', 'operator'],
  },
  {
    key: 'children',
    label: '孩子列表',
    icon: 'children',
    path: '/children',
    roles: ['super_admin', 'admin', 'operator'],
  },
  {
    key: 'parents',
    label: '家长列表',
    icon: 'parents',
    path: '/parents',
    roles: ['super_admin', 'admin', 'operator'],
  },
  {
    key: 'tasks',
    label: '任务管理',
    icon: 'tasks',
    path: '/tasks',
    roles: ['super_admin', 'admin', 'operator'],
  },
  {
    key: 'redeem-items',
    label: '兑换物品',
    icon: 'redeem-items',
    path: '/redeem/items',
    roles: ['super_admin', 'admin', 'operator'],
  },
  {
    key: 'achievements',
    label: '成就体系',
    icon: 'achievements',
    path: '/achievements/system',
    roles: ['super_admin', 'admin'],
  },
  {
    key: 'logs',
    label: '操作日志',
    icon: 'logs',
    path: '/system/logs',
    roles: ['super_admin', 'admin'],
  },
  {
    key: 'admin-users',
    label: '管理员',
    icon: 'admin-users',
    path: '/admin/users',
    roles: ['super_admin'],
  },
]

export function filterMenusByRole(role: AdminRole): MenuItem[] {
  return menuItems.filter((item) => item.roles.includes(role))
}

export function matchMenuKeyByPath(pathname: string): string | undefined {
  const sorted = [...menuItems].sort((a, b) => b.path.length - a.path.length)
  const hit = sorted.find((m) => pathname === m.path || pathname.startsWith(m.path + '/'))
  return hit?.key
}
