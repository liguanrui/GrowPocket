import { useNavigate } from 'react-router-dom';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './pages/HomePage';
import { MallPage } from './pages/MallPage';
import { GrowthPage } from './pages/GrowthPage';
import { FamilyPage } from './pages/FamilyPage';
import { CommunityPage } from './pages/CommunityPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { ScorePage } from './pages/ScorePage';
import { CreateTaskPage } from './pages/CreateTaskPage';
import { CreateItemPage } from './pages/CreateItemPage';
import { SettingsPage } from './pages/SettingsPage';
import { AchievementEditPage } from './pages/AchievementEditPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';

type PageKey = 'home' | 'mall' | 'growth' | 'community' | 'settings';

function MainLayout() {
  const navigate = useNavigate();
  const currentPath = window.location.pathname;
  let activeTab: PageKey = 'home';
  if (currentPath.startsWith('/mall')) activeTab = 'mall';
  else if (currentPath === '/growth') activeTab = 'growth';
  else if (currentPath === '/family') activeTab = 'settings';
  else if (currentPath.startsWith('/community')) activeTab = 'community';
  else if (currentPath === '/settings') activeTab = 'settings';

  const handleTab = (tab: string) => {
    navigate(`/${tab === 'home' ? 'home' : tab}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg pb-20">
      <Outlet />
      <BottomNav activeTab={activeTab} onTabChange={handleTab} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="task/:id" element={<TaskDetailPage />} />
        <Route path="tasks/new" element={<CreateTaskPage />} />
        <Route path="mall" element={<MallPage />} />
        <Route path="mall/new" element={<CreateItemPage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="score" element={<ScorePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/achievement/edit" element={<AchievementEditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
