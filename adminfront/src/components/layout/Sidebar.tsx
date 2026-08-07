import { useLocation, NavLink } from 'react-router-dom'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminUIStore } from '@/stores/adminUIStore'
import { cn } from '@/lib/utils'
import { filterMenusByRole, iconMap, matchMenuKeyByPath } from './menuConfig'
import { ChevronLeft, ChevronRight, Sprout } from 'lucide-react'

export function Sidebar() {
  const location = useLocation()
  const user = useAdminAuthStore((s) => s.user)
  const collapsed = useAdminUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAdminUIStore((s) => s.toggleSidebar)

  const role = user?.role ?? 'operator'
  const menus = filterMenusByRole(role)
  const activeKey = matchMenuKeyByPath(location.pathname)

  return (
    <aside
      className={cn(
        'flex flex-col h-screen border-r bg-sidebar transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="flex items-center h-14 px-4 border-b shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-primary flex items-center justify-center">
            <Sprout className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold whitespace-nowrap">GrowPocket</span>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {menus.map((item) => {
          const Icon = iconMap[item.icon]
          const isActive = item.key === activeKey
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === '/dashboard'}
              className={() =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  collapsed && 'justify-center px-0'
                )
              }
              title={collapsed ? item.label : undefined}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 border-t text-muted-foreground hover:bg-sidebar-accent transition-colors shrink-0"
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  )
}
