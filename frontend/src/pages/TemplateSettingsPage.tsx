import { useState, useEffect } from 'react';
import { BackHeader } from '../components/Header';
import * as templateService from '../services/taskTemplates';
import type { TaskTemplate } from '../services/taskTemplates';
import { TASK_CATEGORY_OPTIONS } from '../services/taskTemplates';
import { ListTodo, Plus, Edit2, Trash2, X, Star, ChevronRight } from 'lucide-react';

const EMOJI_OPTIONS = ['🌟', '🔥', '💪', '💎', '🥈', '🥇', '👑', '🐝', '⭐', '🏆', '🎁', '❤️', '🏅', '⚡', '🌈', '🎯', '🎖️', '💯', '🎪', '🎨'];

function TaskTemplateForm({
  template,
  onSubmit,
  onCancel,
}: {
  template?: TaskTemplate;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const isEdit = !!template;
  const [form, setForm] = useState({
    title: template?.title || '',
    description: template?.description || '',
    points: template?.points || 10,
    icon: template?.icon || '⭐',
    category: template?.category || '学习',
    sort_order: template?.sort_order || 0,
    is_active: template?.is_active ?? true,
  });

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">
            {isEdit ? '编辑任务模板' : '创建任务模板'}
          </h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
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
              <label className="block text-sm font-medium text-text-primary mb-2">奖励积分</label>
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

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 text-text-secondary rounded-xl font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium disabled:opacity-50"
          >
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TemplateSettingsPage() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await templateService.listTaskTemplates();
      setTemplates(result);
    } catch (e) {
      console.error('加载数据失败:', e);
    }
    setLoading(false);
  };

  const handleCreateTemplate = async (data: any) => {
    try {
      await templateService.createTaskTemplate(data);
      setShowTemplateForm(false);
      loadData();
    } catch (e) {
      console.error('创建任务模板失败:', e);
    }
  };

  const handleUpdateTemplate = async (data: any) => {
    if (!editingTemplate) return;
    try {
      await templateService.updateTaskTemplate(editingTemplate.id, data);
      setShowTemplateForm(false);
      setEditingTemplate(undefined);
      loadData();
    } catch (e) {
      console.error('更新任务模板失败:', e);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (!confirm('确定删除这个任务模板吗？')) return;
    try {
      await templateService.deleteTaskTemplate(id);
      loadData();
    } catch (e) {
      console.error('删除任务模板失败:', e);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <BackHeader title="任务模板" />

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <button
          onClick={() => {
            setEditingTemplate(undefined);
            setShowTemplateForm(true);
          }}
          className="w-full bg-card rounded-2xl p-4 shadow-sm mb-3 flex items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors"
        >
          <Plus size={20} />
          <span className="font-medium">创建任务模板</span>
        </button>

        {loading ? (
          <div className="text-center py-8">加载中...</div>
        ) : templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`bg-card rounded-2xl p-4 shadow-sm ${
                  !template.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">
                    {template.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{template.title}</span>
                      {!template.is_active && (
                        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">已禁用</span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-text-tertiary mt-1 line-clamp-1">{template.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Star size={12} />
                        +{template.points}积分
                      </span>
                      <span>{template.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowTemplateForm(true);
                      }}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-text-secondary hover:bg-gray-200"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
            <ListTodo size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-text-primary font-medium">暂无任务模板</p>
            <p className="text-text-tertiary text-sm mt-1">点击上方按钮创建常见任务模板</p>
          </div>
        )}

        <div className="h-8" />
      </div>

      {showTemplateForm && (
        <TaskTemplateForm
          template={editingTemplate}
          onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
          onCancel={() => {
            setShowTemplateForm(false);
            setEditingTemplate(undefined);
          }}
        />
      )}
    </div>
  );
}

export default TemplateSettingsPage;
