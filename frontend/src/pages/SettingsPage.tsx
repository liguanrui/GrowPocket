import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { Settings, User, Users, ListTodo, LogOut, ChevronRight, Clock, FastForward, RotateCcw, FlaskConical, Bell, Share2, Copy } from 'lucide-react';
import { getDebugTime, advanceTime, resetTime } from '../services/debug';
import type { DebugTimeInfo } from '../services/debug';
import { fetchUnreadCount } from '../services/messages';
import { getFamily } from '../services/children';
import { copyText } from '../utils/clipboard';

export function SettingsPage() {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const setNeedRefreshTasks = useUIStore((s) => s.setNeedRefreshTasks);
  const toast = useToastStore();

  // 调试面板状态（仅开发环境显示）
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugTime, setDebugTime] = useState<DebugTimeInfo | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [shareCode, setShareCode] = useState(authStore.family?.share_code || '');

  useEffect(() => {
    fetchUnreadCount()
      .then(setUnreadCount)
      .catch(() => setUnreadCount(0));
    getFamily()
      .then((info) => {
        setShareCode(info.share_code || '');
        authStore.setFamily({
          id: info.id,
          name: info.name,
          share_code: info.share_code,
        });
      })
      .catch(() => {});
  }, []);

  const handleCopyShareCode = async () => {
    if (!shareCode) {
      toast.error('暂无分享码');
      return;
    }
    const ok = await copyText(shareCode);
    if (ok) toast.success('分享码已复制');
    else toast.error('复制失败，请长按分享码手动复制');
  };

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      authStore.logout();
      navigate('/login');
    }
  };

  // 调试：加载当前时间
  const handleLoadDebugTime = async () => {
    try {
      const info = await getDebugTime();
      setDebugTime(info);
    } catch (e: any) {
      toast.error(e.message || '调试接口不可用（需 APP_ENV=development）');
    }
  };

  // 调试：快进 N 天
  const handleAdvanceTime = async (days: number) => {
    if (debugLoading) return;
    setDebugLoading(true);
    try {
      const info = await advanceTime(days);
      setDebugTime(info);
      setNeedRefreshTasks(true);
      toast.success(`已快进 ${days} 天，任务列表已刷新`);
    } catch (e: any) {
      toast.error(e.message || '快进失败');
    } finally {
      setDebugLoading(false);
    }
  };

  // 调试：重置时间
  const handleResetTime = async () => {
    if (debugLoading) return;
    setDebugLoading(true);
    try {
      const info = await resetTime();
      setDebugTime(info);
      setNeedRefreshTasks(true);
      toast.success('已恢复真实时间');
    } catch (e: any) {
      toast.error(e.message || '重置失败');
    } finally {
      setDebugLoading(false);
    }
  };

  const toggleDebugPanel = () => {
    const next = !debugOpen;
    setDebugOpen(next);
    if (next && !debugTime) {
      handleLoadDebugTime();
    }
  };

  const menuItems = [
    {
      id: 'messages',
      label: '系统消息',
      icon: Bell,
      description: '报名通知、活动动态提醒',
      path: '/settings/messages',
      badge: unreadCount,
    },
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
  ];

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-amber-500 pt-3 pb-4 px-4 rounded-b-2xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Settings size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">设置</h1>
              <p className="text-white/80 text-xs">管理账户和家庭</p>
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
          {/* 家庭分享码：独立入口，一键复制 */}
          <div className="w-full bg-card rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Share2 size={22} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary">家庭分享码</div>
                <p className="mt-1.5 text-xl font-bold font-mono tracking-[0.2em] text-[#2D2A26] select-all">
                  {shareCode || '--------'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyShareCode()}
                disabled={!shareCode}
                className="flex-shrink-0 px-3 py-2 rounded-xl bg-primary text-white text-sm font-medium flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
              >
                <Copy size={16} />
                复制
              </button>
            </div>
          </div>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const badge = 'badge' in item ? Number(item.badge || 0) : 0;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="w-full bg-card rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="relative w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon size={22} className="text-primary" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-text-primary flex items-center gap-2">
                    {item.label}
                    {badge > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-medium">
                        {badge} 条未读
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-tertiary">{item.description}</div>
                </div>
                <ChevronRight size={20} className="text-text-tertiary" />
              </button>
            );
          })}
        </div>

        {/* 调试工具：临时对生产开放（测完记得关掉） */}
        {true && (
          <div className="mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-2xl overflow-hidden">
            <button
              onClick={toggleDebugPanel}
              className="w-full p-4 flex items-center gap-3 hover:bg-purple-100/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <FlaskConical size={20} className="text-purple-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-purple-900 flex items-center gap-2">
                  调试工具
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-200 text-amber-800">临时开放</span>
                </div>
                <div className="text-xs text-purple-600">时间穿越测试：快进天数模拟阶段推进</div>
              </div>
              <ChevronRight
                size={18}
                className={`text-purple-400 transition-transform ${debugOpen ? 'rotate-90' : ''}`}
              />
            </button>

            {debugOpen && (
              <div className="px-4 pb-4 space-y-3">
                {/* 当前时间展示 */}
                <div className="bg-white/70 rounded-xl p-3 flex items-center gap-2">
                  <Clock size={16} className={debugTime?.is_virtual ? 'text-purple-600' : 'text-gray-400'} />
                  <div className="flex-1">
                    <div className="text-xs text-gray-500">当前时间</div>
                    <div className="text-sm font-medium text-gray-800">
                      {debugTime ? new Date(debugTime.current_time).toLocaleString('zh-CN') : '加载中...'}
                    </div>
                  </div>
                  {debugTime?.is_virtual && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      虚拟模式
                    </span>
                  )}
                </div>

                {/* 快进按钮组 */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAdvanceTime(1)}
                    disabled={debugLoading}
                    className="py-2.5 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <FastForward size={14} />
                    快进 1 天
                  </button>
                  <button
                    onClick={() => handleAdvanceTime(7)}
                    disabled={debugLoading}
                    className="py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <FastForward size={14} />
                    快进 7 天
                  </button>
                  <button
                    onClick={handleResetTime}
                    disabled={debugLoading}
                    className="py-2.5 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <RotateCcw size={14} />
                    重置
                  </button>
                </div>

                <p className="text-xs text-purple-500 leading-relaxed">
                  快进后会为当前家庭生成习惯打卡，并检查主题子任务是否超过 3 天未完成（触发兜底推进）。AI 任务会在后台补生成。
                </p>
              </div>
            )}
          </div>
        )}

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
