import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { ToastContainer } from './components/Toast';
import { AssistantPage } from './pages/AssistantPage';
import { HomePage } from './pages/HomePage';
import { MallPage } from './pages/MallPage';
import { GrowthPage } from './pages/GrowthPage';
import { GrowthStoryPage } from './pages/GrowthStoryPage';
import { GrowthStoryListPage } from './pages/GrowthStoryListPage';
import { MasterChallengePoolPage } from './pages/MasterChallengePoolPage';
import { MasterChallengeDetailPage } from './pages/MasterChallengeDetailPage';
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
import { MessagesPage } from './pages/MessagesPage';
import { QuestionnairePage } from './pages/QuestionnairePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import ProtectedRoute from './components/ProtectedRoute';

type PageKey = 'assistant' | 'home' | 'growth' | 'community' | 'settings';

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // 路由跳转时统一滚动到顶部（避免「点进任务详情页只看到半截内容」）
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

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
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* 添加孩子 / 新手引导 / 问卷：独立全屏，不显示底部 Tab，避免中途跳转丢失流程 */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/questionnaire"
          element={
            <ProtectedRoute>
              <QuestionnairePage />
            </ProtectedRoute>
          }
        />
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
          <Route path="master-challenges" element={<MasterChallengePoolPage />} />
          <Route path="master-challenges/:instanceId" element={<MasterChallengeDetailPage />} />
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
          <Route path="settings/messages" element={<MessagesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  );
}
