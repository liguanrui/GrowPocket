import { useNavigate } from 'react-router-dom';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/Toast';
import { HomePage } from './pages/HomePage';
import { MallPage } from './pages/MallPage';
import { GrowthPage } from './pages/GrowthPage';
import { FamilyPage } from './pages/FamilyPage';
import { CommunityPage } from './pages/CommunityPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { ScorePage } from './pages/ScorePage';
import { ScoreAdjustPage } from './pages/ScoreAdjustPage';
import { CreateTaskPage } from './pages/CreateTaskPage';
import { CreateItemPage } from './pages/CreateItemPage';
import { SettingsPage } from './pages/SettingsPage';
import { AchievementEditPage } from './pages/AchievementEditPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { FamilySettingsPage } from './pages/FamilySettingsPage';
import { TemplateSettingsPage } from './pages/TemplateSettingsPage';
import { TemplateEditPage } from './pages/TemplateEditPage';
import { AchievementSettingsPage } from './pages/AchievementSettingsPage';
import { AchievementListPage } from './pages/AchievementListPage';
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
    else if (currentPath.startsWith('/settings')) activeTab = 'settings';

  const handleTab = (tab: string) => {
    navigate(`/${tab === 'home' ? 'home' : tab}`, { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg pb-20">
      <Outlet />
      <BottomNav activeTab={activeTab} onTabChange={handleTab} />
      <ToastContainer />
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
        <Route path="mall/:id/edit" element={<CreateItemPage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="achievements" element={<AchievementListPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="score" element={<ScorePage />} />
        <Route path="score/adjust" element={<ScoreAdjustPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/achievement/edit" element={<AchievementEditPage />} />
        <Route path="settings/account" element={<AccountSettingsPage />} />
        <Route path="settings/family" element={<FamilySettingsPage />} />
        <Route path="settings/templates" element={<TemplateSettingsPage />} />
        <Route path="settings/templates/new" element={<TemplateEditPage />} />
        <Route path="settings/templates/:id/edit" element={<TemplateEditPage />} />
        <Route path="settings/achievements" element={<AchievementSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
