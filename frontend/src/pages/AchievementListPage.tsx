import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Trophy, Lock, Sparkles, ChevronLeft } from 'lucide-react';
import { useChildStore } from '../stores/childStore';
import * as growthService from '../services/growth';
import type { UserAchievement } from '../services/growth';

function AchievementCard({ achievement }: { achievement: UserAchievement }) {
  const { Achievement, unlocked, current_value, award_count } = achievement;
  const targetValue = Achievement.counter_target || Achievement.target_value || 0;
  const progress = Math.min((current_value / Math.max(targetValue, 1)) * 100, 100);

  return (
    <div
      className={`relative rounded-2xl p-4 transition-all ${
        unlocked
          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 shadow-lg shadow-amber-100/50'
          : 'bg-gray-50 border-2 border-gray-100'
      }`}
    >
      {unlocked && (
        <div className="absolute top-3 right-3">
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
            {award_count > 1 ? `已获得 x${award_count}` : '已获得'}
          </div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <div className="relative">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${
              unlocked
                ? 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-200/50'
                : 'bg-gray-200'
            }`}
          >
            {unlocked ? (
              <span className="drop-shadow">{Achievement.icon}</span>
            ) : (
              <Lock size={22} className="text-gray-400" />
            )}
          </div>
          {unlocked && award_count > 1 && (
            <div className="absolute -bottom-1 -right-1 bg-amber-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-sm min-w-[20px] text-center">
              x{award_count}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-base ${unlocked ? 'text-amber-900' : 'text-text-secondary'}`}>
              {Achievement.name}
            </span>
          </div>
          <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{Achievement.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs font-bold ${unlocked ? 'text-amber-600' : 'text-primary'}`}>
              +{Achievement.points} 积分
            </span>
            {Achievement.is_custom && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                自定义
              </span>
            )}
          </div>
        </div>
      </div>
      {!unlocked && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-text-tertiary mb-1.5">
            <span>完成进度</span>
            <span className="font-medium text-text-secondary">
              {current_value}/{targetValue}
            </span>
          </div>
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {unlocked && award_count > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-text-tertiary mb-1.5">
            <span>累计进度</span>
            <span className="font-medium text-text-secondary">
              {current_value}/{targetValue}
            </span>
          </div>
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function AchievementListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childStore = useChildStore();
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unlocked' | 'locked'>('all');

  const children = childStore.children;
  const [selectedChildId, setSelectedChildId] = useState<number | null>(() => {
    const id = searchParams.get('child_id');
    return id ? Number(id) : (childStore.currentChildId || (children[0]?.id ?? null));
  });

  const selectedChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  useEffect(() => {
    if (children.length === 0) {
      childStore.fetchChildren();
    }
  }, [children.length, childStore]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (!selectedChildId) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await growthService.getAchievements(selectedChildId);
        if (mounted) {
          setAchievements(result);
        }
      } catch (e: any) {
        console.error('加载勋章失败:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [selectedChildId]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const lockedCount = achievements.filter((a) => !a.unlocked).length;

  const filteredAchievements = achievements.filter((a) => {
    if (activeTab === 'unlocked') return a.unlocked;
    if (activeTab === 'locked') return !a.unlocked;
    return true;
  });

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-amber-500 to-yellow-500 pt-12 pb-8 px-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white mb-4 hover:bg-white/30 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Trophy size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">我的勋章</h1>
              <p className="text-white/80 text-sm mt-0.5">
                {selectedChild?.nickname || ''} 已获得 {unlockedCount} 枚勋章
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-6 pt-4 border-t border-white/20">
            <div className="flex-1 text-center">
              <div className="text-white font-bold text-2xl">{achievements.length}</div>
              <div className="text-white/70 text-xs">全部勋章</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-white font-bold text-2xl">{unlockedCount}</div>
              <div className="text-white/70 text-xs">已获得</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-white font-bold text-2xl">{lockedCount}</div>
              <div className="text-white/70 text-xs">未解锁</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <div className="bg-card rounded-2xl p-2 shadow-sm mb-4">
          <div className="flex gap-1">
            {[
              { key: 'all', label: '全部' },
              { key: 'unlocked', label: '已获得' },
              { key: 'locked', label: '未解锁' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md'
                    : 'text-text-secondary hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-text-secondary">加载中...</div>
        ) : filteredAchievements.length > 0 ? (
          <div className="space-y-3">
            {filteredAchievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-text-tertiary">
            <Sparkles size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-text-secondary">
              {activeTab === 'unlocked' ? '还没有获得勋章' : activeTab === 'locked' ? '全部勋章都已解锁' : '暂无勋章'}
            </p>
            <p className="text-sm mt-1">完成任务就能获得更多勋章哦</p>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

export default AchievementListPage;
