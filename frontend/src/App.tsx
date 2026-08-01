import { useNavigate } from 'react-router-dom';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/Toast';
import { AssistantPage } from './pages/AssistantPage';
import { HomePage } from './pages/HomePage';
import { MallPage } from './pages/MallPage';
import { GrowthPage } from './pages/GrowthPage';
import { GrowthStoryPage } from './pages/GrowthStoryPage';
import { GrowthStoryListPage } from './pages/GrowthStoryListPage';
import { FamilyPage } from './pages/FamilyPage';
import { CommunityPage } from './pages/CommunityPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { ScorePage } from './pages/ScorePage';
import { ScoreAdjustPage } from './pages/ScoreAdjustPage';
import { CreateTaskPage } from './pages/CreateTaskPage';
import { CreateItemPage } from './pages/CreateItemPage';
import CreateActivityPage from './pages/CreateActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccountSettingsPage } from './pages/AccountSettingsPage';
import { FamilySettingsPage } from './pages/FamilySettingsPage';
import { TemplateSettingsPage } from './pages/TemplateSettingsPage';
import { TemplateEditPage } from './pages/TemplateEditPage';
import { QuestionnairePage } from './pages/QuestionnairePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import ProtectedRoute from './components/ProtectedRoute';

type PageKey = 'assistant' | 'home' | 'growth' | 'community' | 'settings';

function MainLayout() {
  const navigate = useNavigate();
  const currentPath = window.location.pathname;
  let activeTab: PageKey = 'assistant';
  if (currentPath.startsWith('/home')) activeTab = 'home';
    else if (currentPath === '/growth' || currentPath.startsWith('/growth')) activeTab = 'growth';
    else if (currentPath.startsWith('/community')) activeTab = 'community';
    else if (currentPath.startsWith('/settings') || currentPath === '/family') activeTab = 'settings';

  const handleTab = (tab: string) => {
    navigate(`/${tab === 'assistant' ? 'assistant' : tab}`, { replace: true });
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
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AssistantPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="home" element={<HomePage />} />
        <Route path="task/:id" element={<TaskDetailPage />} />
        <Route path="tasks/new" element={<CreateTaskPage />} />
        <Route path="mall" element={<MallPage />} />
        <Route path="mall/new" element={<CreateItemPage />} />
        <Route path="mall/:id/edit" element={<CreateItemPage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="growth/story" element={<GrowthStoryPage />} />
        <Route path="growth/stories" element={<GrowthStoryListPage />} />
        <Route path="family" element={<FamilyPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/activities/new" element={<CreateActivityPage />} />
        <Route path="score" element={<ScorePage />} />
        <Route path="score/adjust" element={<ScoreAdjustPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/account" element={<AccountSettingsPage />} />
        <Route path="settings/family" element={<FamilySettingsPage />} />
        <Route path="settings/templates" element={<TemplateSettingsPage />} />
        <Route path="settings/templates/new" element={<TemplateEditPage />} />
        <Route path="settings/templates/:id/edit" element={<TemplateEditPage />} />
        <Route path="questionnaire" element={<QuestionnairePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
