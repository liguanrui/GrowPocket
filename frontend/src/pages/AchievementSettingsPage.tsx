import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackHeader } from '../components/Header';
import * as growthService from '../services/growth';
import type { Achievement } from '../services/growth';
import { ACHIEVEMENT_TYPE_OPTIONS } from '../services/taskTemplates';
import { Plus, Edit2, Trash2, Target, Flame, Coins, Sparkles } from 'lucide-react';

export function AchievementSettingsPage() {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await growthService.getAchievements(1);
      setAchievements(result.map((ua) => ua.Achievement));
    } catch (e) {
      console.error('加载数据失败:', e);
    }
    setLoading(false);
  };

  const handleDeleteAchievement = async (id: number) => {
    if (!confirm('确定删除这个勋章吗？')) return;
    try {
      await growthService.deleteAchievement(id);
      loadData();
    } catch (e) {
      console.error('删除勋章失败:', e);
    }
  };

  const getTypeLabel = (type: number) => {
    return ACHIEVEMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label || '未知';
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <BackHeader title="自定义勋章" />

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <button
          onClick={() => navigate('/settings/achievement/edit')}
          className="w-full bg-card rounded-2xl p-4 shadow-sm mb-3 flex items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors"
        >
          <Plus size={20} />
          <span className="font-medium">创建自定义勋章</span>
        </button>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : achievements.length > 0 ? (
          <div className="space-y-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`bg-card rounded-2xl p-4 shadow-sm ${
                  achievement.is_custom ? 'border-l-4 border-primary' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: achievement.icon_color || '#FF9500' }}
                  >
                    {achievement.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{achievement.name}</span>
                      {achievement.is_custom ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">自定义</span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">系统</span>
                      )}
                    </div>
                    <p className="text-sm text-text-tertiary mt-1">{achievement.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Target size={12} />
                        {getTypeLabel(achievement.type)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame size={12} />
                        目标: {achievement.target_value}
                      </span>
                      <span className="flex items-center gap-1">
                        <Coins size={12} />
                        +{achievement.points}积分
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/settings/achievement/edit?id=${achievement.id}`)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-text-secondary hover:bg-gray-200"
                    >
                      <Edit2 size={14} />
                    </button>
                    {achievement.is_custom && (
                      <button
                        onClick={() => handleDeleteAchievement(achievement.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
            <Sparkles size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-text-primary font-medium">暂无勋章</p>
            <p className="text-text-tertiary text-sm mt-1">点击上方按钮创建自定义勋章</p>
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

export default AchievementSettingsPage;
