import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import * as growthService from '../services/growth';
import * as templateService from '../services/taskTemplates';
import * as childService from '../services/children';
import type { Achievement } from '../services/growth';
import type { TaskTemplate } from '../services/taskTemplates';
import type { Child } from '../services/children';
import { ACHIEVEMENT_TYPE_OPTIONS, TASK_CATEGORY_OPTIONS } from '../services/taskTemplates';
import { Settings, User, Users, ListTodo, Medal, LogOut, ChevronRight, Plus, Edit2, Trash2, Target, Flame, Coins, Sparkles, X } from 'lucide-react';

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
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h3 className="text-lg font-semibold text-text-primary">
            {isEdit ? '编辑任务模板' : '创建任务模板'}
          </h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 pb-2">
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

        <div className="flex gap-3 p-6 pt-4 flex-shrink-0">
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

function ChildForm({
  child,
  onSubmit,
  onCancel,
}: {
  child?: Child;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const isEdit = !!child;
  const [form, setForm] = useState({
    nickname: child?.nickname || '',
    birthday: child?.birthday || '',
    gender: child?.gender ?? 1,
  });

  const handleSubmit = () => {
    if (!form.nickname.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h3 className="text-lg font-semibold text-text-primary">
            {isEdit ? '编辑孩子档案' : '添加孩子档案'}
          </h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-6 pb-2">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">姓名 *</label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              placeholder="输入孩子姓名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">生日</label>
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">性别</label>
            <div className="flex gap-3">
              <button
                onClick={() => setForm({ ...form, gender: 1 })}
                className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                  form.gender === 1 ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-text-secondary'
                }`}
              >
                👦 男
              </button>
              <button
                onClick={() => setForm({ ...form, gender: 2 })}
                className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                  form.gender === 2 ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-text-secondary'
                }`}
              >
                👧 女
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-4 flex-shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 text-text-secondary rounded-xl font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.nickname.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium disabled:opacity-50"
          >
            {isEdit ? '保存' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const childStore = useChildStore();
  const [activeTab, setActiveTab] = useState<'account' | 'achievements' | 'templates'>('account');
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showChildForm, setShowChildForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | undefined>();
  const [editingChild, setEditingChild] = useState<Child | undefined>();
  const [loading, setLoading] = useState(true);
  const [childrenList, setChildrenList] = useState<Child[]>([]);

  useEffect(() => {
    if (childStore.children.length === 0) {
      childStore.fetchChildren();
    }
  }, []);

  useEffect(() => {
    if (childStore.children.length > 0) {
      setChildrenList(childStore.children);
    }
  }, [childStore.children]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'achievements') {
        const result = await growthService.getAchievements(1);
        setAchievements(result.map((ua) => ua.Achievement));
      } else if (activeTab === 'templates') {
        const result = await templateService.listTaskTemplates();
        setTemplates(result);
      }
    } catch (e) {
      console.error('加载数据失败:', e);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      authStore.logout();
      navigate('/login');
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

  const handleAddChild = async (data: any) => {
    try {
      await childService.addChild(data);
      setShowChildForm(false);
      childStore.fetchChildren();
    } catch (e) {
      console.error('添加孩子失败:', e);
    }
  };

  const handleUpdateChild = async (data: any) => {
    if (!editingChild) return;
    try {
      await childService.updateChild(editingChild.id, data);
      setShowChildForm(false);
      setEditingChild(undefined);
      childStore.fetchChildren();
    } catch (e) {
      console.error('更新孩子失败:', e);
    }
  };

  const handleDeleteChild = async (id: number) => {
    if (!confirm('确定删除这个孩子档案吗？')) return;
    try {
      await childService.deleteChild(id);
      childStore.fetchChildren();
    } catch (e) {
      console.error('删除孩子失败:', e);
    }
  };

  const getTypeLabel = (type: number) => {
    return ACHIEVEMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label || '未知';
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

        <div className="space-y-3">
          {/* 家庭管理 */}
          <div className="bg-card rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users size={20} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary">家庭管理</h3>
                  <p className="text-xs text-text-tertiary">管理孩子档案</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingChild(undefined);
                  setShowChildForm(true);
                }}
                className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {childrenList.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">
                      {child.gender === 1 ? '👦' : '👧'}
                    </div>
                    <div>
                      <div className="font-medium text-text-primary">{child.nickname}</div>
                      <div className="text-xs text-text-tertiary">
                        {child.birthday ? `${child.birthday} · ${child.gender === 1 ? '男' : '女'}` : (child.gender === 1 ? '男' : '女')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingChild(child);
                        setShowChildForm(true);
                      }}
                      className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-text-secondary hover:bg-gray-300"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteChild(child.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {childrenList.length === 0 && (
                <div className="text-center py-6 text-text-tertiary">
                  暂无孩子档案，点击 + 添加
                </div>
              )}
            </div>
          </div>

          {/* 勋章管理 */}
          {activeTab === 'achievements' && (
          <>
            <button
              onClick={() => {
                navigate('/settings/achievement/edit');
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
                      achievement.is_custom ? '' : 'border-l-4 border-amber-400'
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
                          onClick={() => {
                            navigate(`/settings/achievement/edit?id=${achievement.id}`);
                          }}
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
          </>
        )}

        {activeTab === 'templates' && (
          <>
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
                        <ChevronRight size={18} className="text-text-tertiary" />
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
          </>
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

      {showChildForm && (
        <ChildForm
          child={editingChild}
          onSubmit={editingChild ? handleUpdateChild : handleAddChild}
          onCancel={() => {
            setShowChildForm(false);
            setEditingChild(undefined);
          }}
        />
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
  );
}

export default SettingsPage;
