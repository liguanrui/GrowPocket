import { useState, useEffect } from 'react';
import { ArrowLeft, ListTodo, Star } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import * as templateService from '../services/taskTemplates';
import type { TaskTemplate } from '../services/taskTemplates';
import { TASK_CATEGORY_OPTIONS } from '../services/taskTemplates';

const EMOJI_OPTIONS = ['🌟', '🔥', '💪', '💎', '🥈', '🥇', '👑', '🐝', '⭐', '🏆', '🎁', '❤️', '🏅', '⚡', '🌈', '🎯', '🎖️', '💯', '🎪', '🎨'];

export function TemplateEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToastStore();
  const uiStore = useUIStore();
  const isEdit = !!id;

  const [form, setForm] = useState({
    title: '',
    description: '',
    points: 10,
    icon: '⭐',
    category: '学习',
    sort_order: 0,
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit && id) {
      loadTemplate();
    }
  }, [isEdit, id]);

  const loadTemplate = async () => {
    try {
      const template = await templateService.getTaskTemplate(Number(id));
      setForm({
        title: template.title,
        description: template.description,
        points: template.points,
        icon: template.icon,
        category: template.category,
        sort_order: template.sort_order,
        is_active: template.is_active,
      });
    } catch (e: any) {
      toast.error(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error('请填写任务名称');
      return;
    }
    if (form.points < 0) {
      toast.error('奖励积分不能小于0');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && id) {
        await templateService.updateTaskTemplate(Number(id), form);
        toast.success('模板修改成功');
      } else {
        await templateService.createTaskTemplate(form);
        toast.success('模板创建成功');
      }
      uiStore.setNeedRefreshTemplates(true);
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
      <div className="bg-gradient-to-br from-primary to-indigo-600 pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg">
              {isEdit ? '编辑任务模板' : '创建任务模板'}
            </h1>
            <div className="w-10 h-10" />
          </div>
          <p className="text-white/80 text-sm">
            {isEdit ? '修改任务模板的设置。' : '创建一个常见任务模板，方便快速创建任务。'}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <div className="bg-card rounded-2xl p-5 shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">任务名称 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              placeholder="输入任务名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary resize-none"
              placeholder="输入任务描述"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                <Star size={14} className="inline mr-1 text-primary" /> 奖励积分
              </label>
              <input
                type="number"
                min="0"
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">排序</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">图标</label>
            <div className="flex flex-wrap gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setForm({ ...form, icon: emoji })}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                    form.icon === emoji ? 'bg-primary/20 ring-2 ring-primary' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">分类</label>
            <div className="flex flex-wrap gap-2">
              {TASK_CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setForm({ ...form, category: option.value })}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-all ${
                    form.category === option.value
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  <span>{option.icon}</span>
                  <span>{option.value}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-text-primary">启用状态</span>
            <button
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`w-12 h-7 rounded-full transition-colors relative ${
                form.is_active ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  form.is_active ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.title.trim()}
            className="w-full py-4 bg-gradient-to-r from-primary to-amber-500 text-white rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ListTodo size={20} />
            {submitting ? '保存中...' : isEdit ? '保存修改' : '创建模板'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditPage;
