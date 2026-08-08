import { useState, useEffect } from 'react';
import { User, Settings, Bell, HelpCircle, LogOut, Sparkles, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';

function MenuRow({ icon: Icon, label, badge, onClick }: { icon: any; label: string; badge?: number; onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon size={18} className="text-primary" />
      </div>
      <div className="flex-1 text-sm text-text-primary">{label}</div>
      {badge !== undefined && (
        <div className="text-xs bg-danger text-white rounded-full px-2 py-0.5">{badge}</div>
      )}
      <ChevronRight size={16} className="text-text-tertiary" />
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const childStore = useChildStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        await childStore.fetchChildren();
      } catch (e) {
        // 忽略
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-3 pb-4 px-4 rounded-b-2xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden">
              <span className="text-2xl font-bold text-white">{authStore.user?.nickname?.slice(0, 1) || 'U'}</span>
            </div>
            <div className="text-white">
              <h1 className="text-xl font-bold">{authStore.user?.nickname || '未登录'}</h1>
              <p className="text-white/80 text-sm mt-1">家长账号</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-3">
        <div className="bg-card rounded-2xl p-4 shadow-md mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-tertiary">当前家庭</span>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
              {childStore.children.length} 个孩子
            </span>
          </div>
          <div className="space-y-3">
            {childStore.children.map((child) => (
              <div key={child.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {child.avatar ? (
                    <img src={child.avatar} alt={child.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-primary">{child.nickname.slice(0, 1)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary text-sm">{child.nickname}</div>
                </div>
                <div className="flex items-center gap-1 text-primary font-semibold">
                  <Sparkles size={14} className="fill-primary" />
                  <span>{child.balance}</span>
                </div>
              </div>
            ))}
            {childStore.children.length === 0 && (
              <div className="text-sm text-text-tertiary text-center py-2">暂无孩子档案</div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-sm overflow-hidden mb-4">
          <MenuRow icon={User} label="个人资料" />
          <MenuRow icon={Settings} label="设置" />
          <MenuRow icon={Bell} label="消息通知" />
          <MenuRow icon={HelpCircle} label="帮助与反馈" />
        </div>

        <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 bg-card rounded-2xl shadow-sm text-danger hover:bg-gray-50 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
            <LogOut size={20} />
          </div>
          <span className="font-medium">退出登录</span>
        </button>
      </div>
    </div>
  );
}

export default ProfilePage;
