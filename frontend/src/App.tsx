import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Routes, Route, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './pages/HomePage';
import { TaskListPage } from './pages/TaskListPage';
import { MallPage } from './pages/MallPage';
import { GrowthPage } from './pages/GrowthPage';
import { FamilyPage } from './pages/FamilyPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { ScorePage } from './pages/ScorePage';
import { CreateTaskPage } from './pages/CreateTaskPage';
import { CreateItemPage } from './pages/CreateItemPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';

type PageKey = 'home' | 'tasks' | 'mall' | 'growth' | 'family';

// 使用布局（5 个 Tab 页）
function MainLayout() {
  const navigate = useNavigate();
  const currentPath = window.location.pathname;
  let activeTab: PageKey = 'home';
  if (currentPath === '/tasks') activeTab = 'tasks';
  else if (currentPath === '/mall') activeTab = 'mall';
  else if (currentPath === '/growth') activeTab = 'growth';
  else if (currentPath === '/family') activeTab = 'family';

  const handleTab = (tab: string) => {
    navigate(`/${tab === 'home' ? 'home' : tab}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg pb-20">
      <Routes>
        <Route index element={<HomePage />} />
        <Route path="tasks" element={<TaskListPage />} />
        <Route path="mall" element={<MallPage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="family" element={<FamilyPage />} />
      </Routes>
      <BottomNav activeTab={activeTab} onTabChange={handleTab} />
    </div>
  );
}

export default function App() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Routes>
              <Route path="/" element={<MainLayout />}>
                <Route index element={<HomePage />} />
                <Route path="home" element={<HomePage />} />
                <Route path="tasks" element={<TaskListPage />} />
                <Route path="mall" element={<MallPage />} />
                <Route path="growth" element={<GrowthPage />} />
                <Route path="family" element={<FamilyPage />} />
              </Route>
              <Route path="task/:id" element={<TaskDetailPage />} />
              <Route path="tasks/new" element={<CreateTaskPage />} />
              <Route path="mall/new" element={<CreateItemPage />} />
              <Route path="score" element={<ScorePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
