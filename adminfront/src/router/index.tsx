import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { FamilyListPage } from '@/pages/FamilyListPage'
import { FamilyDetailPage } from '@/pages/FamilyDetailPage'
import { ChildListPage } from '@/pages/ChildListPage'
import { ChildDetailPage } from '@/pages/ChildDetailPage'
import { ParentListPage } from '@/pages/ParentListPage'
import { TaskListPage } from '@/pages/TaskListPage'
import { ItemListPage } from '@/pages/ItemListPage'
import { AchievementPage } from '@/pages/AchievementPage'
import { OperationLogPage } from '@/pages/OperationLogPage'
import { AdminListPage } from '@/pages/AdminListPage'
import { DonationListPage } from '@/pages/DonationListPage'

const NotFoundPage = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
    <h1 className="text-6xl font-bold text-primary">404</h1>
    <h2 className="text-2xl font-semibold">页面未找到</h2>
    <p className="text-muted-foreground">抱歉，您访问的页面不存在或已被移除。</p>
  </div>
)

const ServerErrorPage = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
    <h1 className="text-6xl font-bold text-destructive">500</h1>
    <h2 className="text-2xl font-semibold">服务器错误</h2>
    <p className="text-muted-foreground">抱歉，服务器出现了一些问题，请稍后重试。</p>
  </div>
)

const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/500',
    element: <ServerErrorPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'families', element: <FamilyListPage /> },
      { path: 'families/:id', element: <FamilyDetailPage /> },
      { path: 'children', element: <ChildListPage /> },
      { path: 'children/:id', element: <ChildDetailPage /> },
      { path: 'parents', element: <ParentListPage /> },
      { path: 'tasks', element: <TaskListPage /> },
      { path: 'redeem/items', element: <ItemListPage /> },
      { path: 'donations', element: <DonationListPage /> },
      { path: 'achievements/system', element: <AchievementPage /> },
      { path: 'system/logs', element: <OperationLogPage /> },
      { path: 'admin/users', element: <AdminListPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]

const router = createBrowserRouter(routes, { basename: '/admin' })

export function Router() {
  return <RouterProvider router={router} />
}
