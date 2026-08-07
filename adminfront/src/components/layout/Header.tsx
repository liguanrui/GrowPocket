import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Moon,
  Sun,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Home,
} from 'lucide-react'
import { useAdminAuthStore } from '@/stores/adminAuthStore'
import { useAdminUIStore } from '@/stores/adminUIStore'
import { menuItems } from './menuConfig'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const routeTitles: Record<string, string> = {
  '/dashboard': '数据概览',
  '/families': '家庭列表',
  '/children': '孩子列表',
  '/parents': '家长列表',
  '/tasks': '任务管理',
  '/redeem/items': '兑换物品',
  '/achievements/system': '成就体系',
  '/system/logs': '操作日志',
  '/admin/users': '管理员管理',
}

function matchMenuItem(pathname: string) {
  const sorted = [...menuItems].sort((a, b) => b.path.length - a.path.length)
  return sorted.find(
    (m) => pathname === m.path || pathname.startsWith(m.path + '/')
  )
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAdminAuthStore((s) => s.user)
  const logout = useAdminAuthStore((s) => s.logout)
  const theme = useAdminUIStore((s) => s.theme)
  const toggleTheme = useAdminUIStore((s) => s.toggleTheme)

  const [crumbs, setCrumbs] = useState<{ label: string; path?: string }[]>([])

  useEffect(() => {
    const pathname = location.pathname
    const items: { label: string; path?: string }[] = [
      { label: '首页', path: '/dashboard' },
    ]
    const parent = matchMenuItem(pathname)
    if (parent) {
      if (parent.path !== pathname) {
        items.push({ label: parent.label, path: parent.path })
      } else {
        items.push({ label: parent.label })
      }
      if (parent.path !== pathname) {
        const rest = pathname.slice(parent.path.length + 1)
        if (rest) {
          const parts = rest.split('/').filter(Boolean)
          parts.forEach((p, idx) => {
            if (parent.key === 'families' && idx === 0) {
              items.push({ label: `家庭 #${p}` })
            } else if (parent.key === 'children' && idx === 0) {
              items.push({ label: `孩子 #${p}` })
            } else {
              items.push({ label: p })
            }
          })
        }
      }
    } else if (routeTitles[pathname]) {
      items.push({ label: routeTitles[pathname] })
    } else {
      items.push({ label: '页面' })
    }
    setCrumbs(items)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const roleLabel: Record<string, string> = {
    super_admin: '超级管理员',
    admin: '管理员',
    operator: '运营',
  }

  const initial = user?.nickname?.charAt(0) || user?.username?.charAt(0) || 'A'

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
      <div className="flex items-center justify-between h-full px-4 md:px-6">
        <nav className="flex items-center text-sm text-muted-foreground">
          {crumbs.map((crumb, idx) => {
            const last = idx === crumbs.length - 1
            return (
              <span key={idx} className="flex items-center">
                {idx > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
                {crumb.path && !last ? (
                  <Link
                    to={crumb.path}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    {idx === 0 && <Home className="h-3.5 w-3.5" />}
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">
                    {crumb.label}
                  </span>
                )}
              </span>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 h-9 px-2 w-auto">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm font-medium">
                  {user?.nickname || user?.username || '管理员'}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <span className="font-medium">
                    {user?.nickname || user?.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user?.role ? roleLabel[user.role] : ''}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="cursor-not-allowed">
                <UserIcon className="h-4 w-4 mr-2" />
                个人设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
