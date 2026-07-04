import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Settings, User, Users, ListTodo, Medal, LogOut, ChevronRight } from 'lucide-react';

export function SettingsPage() {
  const navigate = useNavigate();
  const authStore = useAuthStore();

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      authStore.logout();
      navigate('/login');
    }
  };

  const menuItems = [
    {
      id: 'account',
      label: '登录信息',
      icon: User,
      description: '账号、密码管理',
      path: '/settings/account',
    },
    {
      id: 'family',
      label: '家庭管理',
      icon: Users,
      description: '管理家庭信息和孩子档案',
      path: '/settings/family',
    },
    {
      id: 'templates',
      label: '任务模板',
      icon: ListTodo,
      description: '自定义任务模板',
      path: '/settings/templates',
    },
    {
      id: 'achievements',
      label: '自定义勋章',
      icon: Medal,
      description: '创建和管理勋章',
      path: '/settings/achievements',
    },
  ];

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-amber-500 pt-6 pb-10 px-4 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Settings size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">设置</h1>
              <p className="text-white/80 text-sm">管理账户和家庭</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <User size={28} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-text-primary">
                  {authStore.user?.nickname || '未登录'}
                </div>
                <div className="text-sm text-text-secondary">
                  {authStore.user?.role === 'parent' ? '家长' : '孩子'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-tertiary">当前家庭</div>
                <div className="text-sm font-medium text-text-primary">
                  {authStore.family?.name || '未加入家庭'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <div className="space-y-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="w-full bg-card rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon size={22} className="text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-text-primary">{item.label}</div>
                  <div className="text-sm text-text-tertiary">{item.description}</div>
                </div>
                <ChevronRight size={20} className="text-text-tertiary" />
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          <button
            onClick={handleLogout}
            className="w-full bg-card rounded-2xl p-4 shadow-sm flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">退出登录</span>
          </button>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

export default SettingsPage;
