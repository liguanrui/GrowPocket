import { useState, useEffect } from 'react';
import { ArrowLeft, Medal } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import * as growthService from '../services/growth';
import { ACHIEVEMENT_TYPE_OPTIONS } from '../services/taskTemplates';
import { useAuthStore } from '../stores/authStore';

const EMOJI_OPTIONS = ['🌟', '🔥', '💪', '💎', '🥈', '🥇', '👑', '🐝', '⭐', '🏆', '🎁', '❤️', '🏅', '⚡', '🌈', '🎯', '🎖️', '💯', '🎪', '🎨'];

export function AchievementEditPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authStore = useAuthStore();
  const toast = useToastStore();
  const uiStore = useUIStore();
  const id = searchParams.get('id');
  const isEdit = !!id;
  const [isSystem, setIsSystem] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: '🌟',
    icon_color: '#FF9500',
    type: 1,
    target_value: 1,
    points: 100,
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit && id) {
      loadAchievement();
    }
  }, [isEdit, id]);

  const loadAchievement = async () => {
    try {
      const achievements = await growthService.getAchievements(1);
      const achievement = achievements.find((a) => a.Achievement.id === Number(id));
      if (achievement) {
        const a = achievement.Achievement;
        setForm({
          name: a.name,
          description: a.description,
          icon: a.icon,
          icon_color: a.icon_color || '#FF9500',
          type: a.type,
          target_value: a.target_value,
          points: a.points,
        });
        setIsSystem(!a.is_custom);
      }
    } catch (e: any) {
      toast.error(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (isSystem) {
      setSubmitting(true);
      try {
        await growthService.updateAchievement(Number(id), { points: form.points });
        uiStore.setNeedRefreshAchievements(true);
        toast.success('勋章修改成功');
        navigate(-1);
      } catch (e: any) {
        toast.error(e.message || '保存失败');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!form.name.trim()) {
      toast.error('请填写勋章名称');
      return;
    }
    if (form.target_value < 0) {
      toast.error('目标值不能小于0');
      return;
    }
    if (form.points < 0) {
      toast.error('奖励积分不能小于0');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && id) {
        await growthService.updateAchievement(Number(id), form);
        toast.success('勋章修改成功');
      } else {
        await growthService.createAchievement({
          ...form,
          family_id: authStore.family?.id || 0,
          created_by: authStore.user?.id || 0,
        });
        toast.success('勋章创建成功');
      }
      uiStore.setNeedRefreshAchievements(true);
      navigate(-1);
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-text-secondary">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-amber-500 to-orange-500 pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg">
              {isEdit ? (isSystem ? '编辑系统勋章' : '编辑勋章') : '创建勋章'}
            </h1>
            <div className="w-10 h-10" />
          </div>
          <p className="text-white/80 text-sm">
            {isEdit
              ? isSystem
                ? '系统勋章仅支持修改奖励积分。'
                : '修改自定义勋章的设置。'
              : '创建一个独特的勋章来激励孩子。'}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <div className="bg-card rounded-2xl p-5 shadow-sm space-y-5">
          {isSystem && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
              系统勋章为所有家庭共享，仅支持修改奖励积分。
            </div>
          )}

          {!isSystem && (
            <>
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
                <div className="flex items-start gap-3">
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                    style={{ backgroundColor: form.icon_color }}
                  >
                    {form.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setForm({ ...form, icon: emoji })}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                            form.icon === emoji
                              ? 'bg-primary/20 ring-2 ring-primary'
                              : 'bg-gray-100 hover:bg-gray-200'
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

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">目标值</label>
                <input
                  type="number"
                  min="0"
                  value={form.target_value}
                  onChange={(e) =>
                    setForm({ ...form, target_value: Math.max(0, Number(e.target.value) || 0) })
                  }
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              {isSystem ? '奖励积分（可自定义）' : '奖励积分'}
            </label>
            <input
              type="number"
              min="0"
              value={form.points}
              onChange={(e) =>
                setForm({ ...form, points: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || (!isSystem && !form.name.trim())}
            className="w-full py-4 bg-gradient-to-r from-primary to-amber-500 text-white rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Medal size={20} />
            {submitting ? '保存中...' : isEdit ? '保存修改' : '创建勋章'}
          </button>
        </div>
      </div>
    </div>
  );
}
