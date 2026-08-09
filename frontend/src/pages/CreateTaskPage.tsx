import { useState, useEffect } from 'react';
import { ArrowLeft, Star, User, CalendarDays, Sparkles, AlertTriangle, Target, ChevronDown, Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import * as tasksService from '../services/tasks';
import { listTaskTemplates } from '../services/taskTemplates';
import type { TaskTemplate } from '../services/taskTemplates';
import { getPresetTemplates, createParentTask, generateChildren } from '../services/parentTasks';
import type { ParentTaskTemplate } from '../services/parentTasks';
import { DayStepper } from '../components/DayStepper';
import { SoftSelect } from '../components/SoftSelect';

// 主题任务类别（与后端 parent_task_template seed 一致：nature/family_creation/creative/craft/financial/community）
const THEME_CATEGORIES = [
  { value: 'nature', label: '自然探索' },
  { value: 'family_creation', label: '家庭共创' },
  { value: 'creative', label: '创意表达' },
  { value: 'craft', label: '手工制作' },
  { value: 'financial', label: '财商培养' },
  { value: 'community', label: '社区公益' },
  { value: 'other', label: '其他' },
];
const THEME_CATEGORY_LABEL: Record<string, string> = THEME_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<string, string>,
);

// 根据孩子信息推算年龄：优先 derived_age → age → 从 birthday 计算；默认 6 岁
function computeChildAge(child: { derived_age?: number; age?: number | null; birthday?: string | null } | null): number {
  if (!child) return 6;
  if (typeof child.derived_age === 'number' && child.derived_age > 0) return child.derived_age;
  if (typeof child.age === 'number' && child.age > 0) return child.age;
  if (child.birthday) {
    const birth = new Date(child.birthday);
    if (!isNaN(birth.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return Math.max(0, age);
    }
  }
  return 6;
}

// 解析 sub_task_outline（JSON 字符串）为数组长度，用于提示生成子任务数
function countSubTaskOutline(outline?: string): number {
  if (!outline) return 0;
  try {
    const parsed = JSON.parse(outline);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function PointsInput({ points, onChange }: { points: number; onChange: (n: number) => void }) {
  const presets = [20, 50, 100, 200];
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">
        <Star size={14} className="inline mr-1 text-primary" /> 积分数量
      </label>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
              points === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-bg text-text-secondary hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="relative">
        <input
          type="number"
          value={points}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-lg font-bold text-center"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">积分</span>
      </div>
    </div>
  );
}

function ChildPicker({
  selectedChildId,
  onSelect,
  children,
}: {
  selectedChildId: number | null;
  onSelect: (id: number) => void;
  children: { id: number; nickname: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">
        <User size={14} className="inline mr-1 text-primary" /> 指派给哪个孩子
      </label>
      <div className="flex flex-wrap gap-2">
        {children.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-all ${
              selectedChildId === c.id
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-bg text-text-secondary hover:bg-gray-100'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                selectedChildId === c.id ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
              }`}
            >
              {c.nickname.slice(0, 1)}
            </div>
            <span className="text-sm font-medium">{c.nickname}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DeadlinePicker({
  deadline,
  onChange,
}: {
  deadline?: string;
  onChange: (d?: string) => void;
}) {
  const presets = [
    { label: '不设置', days: null },
    { label: '今天', days: 0 },
    { label: '3天内', days: 3 },
    { label: '1周', days: 7 },
    { label: '1月', days: 30 },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">
        <CalendarDays size={14} className="inline mr-1 text-primary" /> 截止时间（可选）
      </label>
      <div className="grid grid-cols-5 gap-2">
        {presets.map((p) => {
          let target: string | undefined;
          if (p.days !== null) {
            const d = new Date();
            d.setDate(d.getDate() + p.days);
            d.setHours(23, 59, 59, 0);
            target = d.toISOString();
          }
          const isActive =
            (deadline === undefined && p.days === null) ||
            (deadline !== undefined && target === deadline);
          return (
            <button
              key={p.label}
              onClick={() => onChange(target)}
              className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                isActive ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskTemplates({
  templates,
  loading,
  onPick,
}: {
  templates: TaskTemplate[];
  loading: boolean;
  onPick: (title: string, desc: string, points: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">
        <Sparkles size={14} className="inline mr-1 text-primary" /> 常见任务
      </label>
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg rounded-xl p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-1.5" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-6 text-sm text-text-tertiary">
          暂无任务模板，可前往「设置 - 任务模板」添加
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t.title, t.description, t.points)}
              className="text-left bg-bg hover:bg-gray-100 rounded-xl p-3 transition-colors"
            >
              <div className="text-sm text-text-primary font-medium flex items-center gap-1">
                <span>{t.icon}</span>
                <span>{t.title}</span>
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">+{t.points} 积分</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 主题任务预设模板列表（按年龄过滤，单选填充）
function ParentTaskTemplates({
  templates,
  loading,
  selectedId,
  onPick,
}: {
  templates: ParentTaskTemplate[];
  loading: boolean;
  selectedId: number | null;
  onPick: (tpl: ParentTaskTemplate) => void;
}) {
  return (
    <div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-bg rounded-xl p-3 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-1.5" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-4 text-sm text-text-tertiary">
          暂无适配当前年龄的预设主题，可直接填写下方表单
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => {
            const checked = selectedId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onPick(tpl)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  checked
                    ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-300'
                    : 'bg-bg border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      checked ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {checked && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary flex items-center gap-1.5 flex-wrap">
                      {tpl.title}
                    </div>
                    {tpl.description && (
                      <div className="text-xs text-text-tertiary line-clamp-2 mt-0.5">
                        {tpl.description}
                      </div>
                    )}
                    <div className="text-[11px] text-text-tertiary mt-1">
                      预计周期 {tpl.estimated_days} 天
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


export function CreateTaskPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childStore = useChildStore();
  const toast = useToastStore();
  const uiStore = useUIStore();
  const [taskType, setTaskType] = useState<'daily' | 'parent'>('daily');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(50);
  const [childId, setChildId] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<string | undefined>(undefined);
  const [guardianRequired, setGuardianRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  // 主题任务相关状态
  const [estimatedDays, setEstimatedDays] = useState(30);
  const [category, setCategory] = useState<string>('nature');
  const [presetThemeTemplates, setPresetThemeTemplates] = useState<ParentTaskTemplate[]>([]);
  const [themeTemplatesLoading, setThemeTemplatesLoading] = useState(false);
  const [showThemeTemplates, setShowThemeTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        await childStore.fetchChildren();
        const children = useChildStore.getState().children;
        if (children.length > 0) {
          const urlChildId = searchParams.get('child_id');
          const targetId = urlChildId ? Number(urlChildId) : useChildStore.getState().currentChildId;
          const validId = targetId && children.some((c) => c.id === targetId) ? targetId : children[0].id;
          if (mounted) {
            setChildId(validId);
          }
        }
      } catch (e: any) {
        if (mounted) toast.error(e.message || '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }

      setTemplatesLoading(true);
      try {
        const list = await listTaskTemplates();
        if (mounted) {
          setTemplates(list.filter((t) => t.is_active));
        }
      } catch (e: any) {
        if (mounted) setTemplates([]);
      } finally {
        if (mounted) setTemplatesLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  // 切换任务类型时清空不相关字段
  const handleSwitchType = (type: 'daily' | 'parent') => {
    if (type === taskType) return;
    setTaskType(type);
    // 共用字段（标题、描述、孩子、家长陪伴）保留，仅清空类型专属字段
    if (type === 'daily') {
      setEstimatedDays(30);
      setCategory('nature');
      setSelectedTemplateId(null);
      setShowThemeTemplates(false);
    } else {
      setPoints(50);
      setDeadline(undefined);
      setSelectedTemplateId(null);
      setShowThemeTemplates(false);
    }
  };

  // 展开/收起主题模板列表，首次展开时按孩子年龄加载预设模板
  const handleToggleThemeTemplates = () => {
    if (!showThemeTemplates && presetThemeTemplates.length === 0 && !themeTemplatesLoading) {
      const children = useChildStore.getState().children;
      const child = children.find((c) => c.id === childId) || null;
      const age = computeChildAge(child);
      setThemeTemplatesLoading(true);
      getPresetTemplates(age)
        .then((list) => setPresetThemeTemplates(list || []))
        .catch(() => setPresetThemeTemplates([]))
        .finally(() => setThemeTemplatesLoading(false));
    }
    setShowThemeTemplates((v) => !v);
  };

  // 选中主题模板后自动填充表单字段（用户可在此基础上修改）
  const handlePickThemeTemplate = (tpl: ParentTaskTemplate) => {
    setSelectedTemplateId((prev) => (prev === tpl.id ? null : tpl.id));
    if (selectedTemplateId !== tpl.id) {
      setTitle(tpl.title);
      setDescription(tpl.description);
      setEstimatedDays(tpl.estimated_days);
      setCategory(tpl.category);
    }
  };

  // 主题任务提交逻辑
  const handleParentSubmit = async () => {
    if (!title.trim()) {
      toast.error('请填写主题标题');
      return;
    }
    if (!description.trim()) {
      toast.error('请填写主题描述');
      return;
    }
    if (!estimatedDays || estimatedDays < 7 || estimatedDays > 90) {
      toast.error('预计周期天数需在 7-90 之间');
      return;
    }
    if (!childId) {
      toast.error('请选择一个孩子');
      return;
    }
    setSubmitting(true);
    try {
      const parentTask = await createParentTask({
        child_id: childId,
        title: title.trim(),
        description: description.trim(),
        estimated_days: estimatedDays,
        category,
      });
      childStore.setCurrentChildId(childId);
      uiStore.setNeedRefreshTasks(true);
      // 后端 CreateParentTask 已自动生成子任务大纲；若返回为空则兜底触发一次生成
      if (!parentTask.sub_task_outline) {
        try {
          await generateChildren(parentTask.id);
        } catch {
          // 兜底生成失败不阻断流程，后端可能已在异步处理
        }
        toast.success('主题任务已创建，子任务大纲生成中');
      } else {
        const count = countSubTaskOutline(parentTask.sub_task_outline);
        toast.success(
          count > 0
            ? `主题任务已创建，已生成 ${count} 个子任务大纲`
            : '主题任务已创建，已生成子任务大纲',
        );
      }
      navigate(`/task/${parentTask.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('请填写任务标题');
      return;
    }
    if (points <= 0) {
      toast.error('积分必须大于0');
      return;
    }
    if (!childId) {
      toast.error('请选择一个孩子');
      return;
    }
    setSubmitting(true);
    try {
      const createdTask = await tasksService.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        points,
        childId,
        deadline,
        status: 1,
        guardianRequired,
      });
      childStore.setCurrentChildId(childId);
      uiStore.setNewTaskId(createdTask.id);
      uiStore.setNeedRefreshTasks(true);
      uiStore.setNeedRefreshScore(true);
      toast.success('任务创建成功');
      navigate('/home', { replace: true });
    } catch (e: any) {
      toast.error(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  const children = useChildStore.getState().children;

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-3 pb-4 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg">发布新任务</h1>
            <div className="w-10 h-10" />
          </div>
          <p className="text-white/80 text-sm">
            {taskType === 'daily'
              ? '为孩子设定一个可完成的小目标，并约定好积分奖励。'
              : '设定一个多日主题任务，AI 将自动拆解为分阶段子任务。'}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        {/* 任务类型选择器 */}
        <div className="bg-card rounded-2xl p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleSwitchType('daily')}
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                taskType === 'daily'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-bg text-text-secondary hover:bg-gray-100'
              }`}
            >
              <Sparkles size={15} />
              日常任务
            </button>
            <button
              type="button"
              onClick={() => handleSwitchType('parent')}
              className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                taskType === 'parent'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-bg text-text-secondary hover:bg-gray-100'
              }`}
            >
              <Target size={15} />
              主题任务
            </button>
          </div>
        </div>

        {taskType === 'daily' ? (
          <>
            <div className="bg-card rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">任务标题 *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：整理房间"
                  className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">任务描述（可选）</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="更详细地描述希望孩子如何完成..."
                  className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-sm resize-none"
                />
              </div>

              <PointsInput points={points} onChange={setPoints} />

              <ChildPicker selectedChildId={childId} onSelect={setChildId} children={children} />

              <DeadlinePicker deadline={deadline} onChange={setDeadline} />

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  <AlertTriangle size={14} className="inline mr-1 text-rose-500" /> 安全提示
                </label>
                <button
                  type="button"
                  onClick={() => setGuardianRequired((v) => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    guardianRequired
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-bg border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm text-text-primary">
                    <span className="text-rose-500">⚠️</span>
                    <span>需要家长陪伴</span>
                  </span>
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      guardianRequired ? 'bg-rose-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        guardianRequired ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
                {guardianRequired && (
                  <p className="mt-2 text-xs text-rose-600">
                    勾选后，任务详情页和列表会显示「需家长陪伴」提示，提醒家长在旁指导并注意安全。
                  </p>
                )}
              </div>
            </div>

            <div className="bg-card rounded-2xl p-5 shadow-sm">
              <TaskTemplates
                templates={templates}
                loading={templatesLoading}
                onPick={(t, d, p) => {
                  setTitle(t);
                  setDescription(d);
                  setPoints(p);
                }}
              />
            </div>

            <div className="sticky bottom-4 pt-2">
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || points <= 0 || !childId || submitting}
                className="w-full py-4 bg-primary text-white rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '发布中...' : '发布任务'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 从模板选择（可折叠） */}
            <div className="bg-card rounded-2xl p-5 shadow-sm">
              <button
                type="button"
                onClick={handleToggleThemeTemplates}
                className="w-full flex items-center justify-between text-sm font-medium text-text-primary"
              >
                <span className="flex items-center gap-1.5">
                  <Target size={14} className="text-indigo-500" />
                  从模板选择
                </span>
                <ChevronDown
                  size={16}
                  className={`text-text-tertiary transition-transform ${showThemeTemplates ? 'rotate-180' : ''}`}
                />
              </button>
              {showThemeTemplates && (
                <div className="mt-3">
                  <ParentTaskTemplates
                    templates={presetThemeTemplates}
                    loading={themeTemplatesLoading}
                    selectedId={selectedTemplateId}
                    onPick={handlePickThemeTemplate}
                  />
                </div>
              )}
            </div>

            {/* 主题任务表单 */}
            <div className="bg-card rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">主题标题 *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：小小科学家养成计划"
                  className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">主题描述 *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="描述这个主题任务的目标、内容和孩子将获得的成长..."
                  className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">预计周期（天）*</label>
                  <DayStepper
                    value={estimatedDays}
                    onChange={setEstimatedDays}
                    min={7}
                    max={90}
                  />
                  <p className="mt-1 text-xs text-text-tertiary">范围 7-90 天</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">类别</label>
                  <SoftSelect
                    value={category}
                    onChange={setCategory}
                    options={THEME_CATEGORIES}
                  />
                </div>
              </div>

              <ChildPicker selectedChildId={childId} onSelect={setChildId} children={children} />

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  <AlertTriangle size={14} className="inline mr-1 text-rose-500" /> 安全提示
                </label>
                <button
                  type="button"
                  onClick={() => setGuardianRequired((v) => !v)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
                    guardianRequired
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-bg border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm text-text-primary">
                    <span className="text-rose-500">⚠️</span>
                    <span>需要家长陪伴</span>
                  </span>
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      guardianRequired ? 'bg-rose-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        guardianRequired ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </span>
                </button>
                {guardianRequired && (
                  <p className="mt-2 text-xs text-rose-600">
                    勾选后，任务详情页和列表会显示「需家长陪伴」提示，提醒家长在旁指导并注意安全。
                  </p>
                )}
              </div>
            </div>

            <div className="sticky bottom-4 pt-2">
              <button
                onClick={handleParentSubmit}
                disabled={!title.trim() || !description.trim() || !childId || submitting}
                className="w-full py-4 bg-primary text-white rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '创建中...' : '创建主题任务'}
              </button>
            </div>
          </>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

export default CreateTaskPage;
