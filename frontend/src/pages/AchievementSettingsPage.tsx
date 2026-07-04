import { useState, useEffect } from 'react';
import { BackHeader } from '../components/Header';
import * as growthService from '../services/growth';
import type { Achievement } from '../services/growth';
import { ACHIEVEMENT_TYPE_OPTIONS } from '../services/taskTemplates';
import { Medal, Plus, Edit2, Trash2, X, Target, Flame, Coins, Sparkles, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const EMOJI_OPTIONS = ['🌟', '🔥', '💪', '💎', '🥈', '🥇', '👑', '🐝', '⭐', '🏆', '🎁', '❤️', '🏅', '⚡', '🌈', '🎯', '🎖️', '💯', '🎪', '🎨'];

function AchievementForm({
  achievement,
  onSubmit,
  onCancel,
}: {
  achievement?: Achievement;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const isEdit = !!achievement;
  const [form, setForm] = useState({
    name: achievement?.name || '',
    description: achievement?.description || '',
    icon: achievement?.icon || '🌟',
    icon_color: achievement?.icon_color || '#FF9500',
    type: achievement?.type || 1,
    target_value: achievement?.target_value || 1,
    points: achievement?.points || 100,
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">
            {isEdit ? '编辑勋章' : '创建勋章'}
          </h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">勋章名称 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              placeholder="输入勋章名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary resize-none"
              placeholder="输入勋章描述"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">图标</label>
            <div className="flex items-center gap-2">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: form.icon_color }}
              >
                {form.icon}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-1">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setForm({ ...form, icon: emoji })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                        form.icon === emoji ? 'bg-primary/20 ring-2 ring-primary' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">图标颜色</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.icon_color}
                onChange={(e) => setForm({ ...form, icon_color: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={form.icon_color}
                onChange={(e) => setForm({ ...form, icon_color: e.target.value })}
                className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">达成条件</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: Number(e.target.value) })}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
            >
              {ACHIEVEMENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">目标值</label>
              <input
                type="number"
                min="0"
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">奖励积分</label>
              <input
                type="number"
                min="0"
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 text-text-secondary rounded-xl font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.name.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium disabled:opacity-50"
          >
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AchievementSettingsPage() {
  const authStore = useAuthStore();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showAchievementForm, setShowAchievementForm] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | undefined>();
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

  const handleCreateAchievement = async (data: any) => {
    try {
      await growthService.createAchievement({
        ...data,
        family_id: authStore.family?.id || 0,
        created_by: authStore.user?.id || 0,
      });
      setShowAchievementForm(false);
      loadData();
    } catch (e) {
      console.error('创建勋章失败:', e);
    }
  };

  const handleUpdateAchievement = async (data: any) => {
    if (!editingAchievement) return;
    try {
      await growthService.updateAchievement(editingAchievement.id, data);
      setShowAchievementForm(false);
      setEditingAchievement(undefined);
      loadData();
    } catch (e) {
      console.error('更新勋章失败:', e);
    }
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
          onClick={() => {
            setEditingAchievement(undefined);
            setShowAchievementForm(true);
          }}
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
                      {achievement.is_custom && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">自定义</span>
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
                    {achievement.is_custom && (
                      <>
                        <button
                          onClick={() => {
                            setEditingAchievement(achievement);
                            setShowAchievementForm(true);
                          }}
                          className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-text-secondary hover:bg-gray-200"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteAchievement(achievement.id)}
                          className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
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

      {showAchievementForm && (
        <AchievementForm
          achievement={editingAchievement}
          onSubmit={editingAchievement ? handleUpdateAchievement : handleCreateAchievement}
          onCancel={() => {
            setShowAchievementForm(false);
            setEditingAchievement(undefined);
          }}
        />
      )}
    </div>
  );
}

export default AchievementSettingsPage;
