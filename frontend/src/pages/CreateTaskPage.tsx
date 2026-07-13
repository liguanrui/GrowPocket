import { useState, useEffect } from 'react';
import { ArrowLeft, Star, User, CalendarDays, Sparkles, Bot, RefreshCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import * as tasksService from '../services/tasks';
import { listTaskTemplates } from '../services/taskTemplates';
import { getTaskRecommendations } from '../services/taskRecommend';
import type { TaskTemplate } from '../services/taskTemplates';
import type { RecommendedTask } from '../types';

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

function RecommendedTasks({
  recommendations,
  loading,
  childName,
  onRefresh,
  onPick,
}: {
  recommendations: RecommendedTask[];
  loading: boolean;
  childName: string;
  onRefresh: () => void;
  onPick: (title: string, desc: string, points: number) => void;
}) {
  const difficultyLabels: Record<string, string> = {
    easy: '简单',
    medium: '适中',
    hard: '困难',
  };

  const difficultyColors: Record<string, string> = {
    easy: 'text-emerald-500 bg-emerald-50',
    medium: 'text-amber-500 bg-amber-50',
    hard: 'text-rose-500 bg-rose-50',
  };

  const frequencyLabels: Record<string, string> = {
    daily: '每日',
    weekly: '每周',
    monthly: '每月',
    once: '一次',
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-text-primary">AI 智能推荐</label>
            <label className="block text-xs text-text-tertiary">为 {childName} 量身推荐</label>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-white/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin text-text-tertiary' : 'text-text-secondary'} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="text-center py-6 text-sm text-text-tertiary">
          暂无推荐任务，请选择孩子后重试
        </div>
      ) : (
        <div className="space-y-2">
          {recommendations.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t.title, t.description, t.points)}
              className="w-full text-left bg-white rounded-xl p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{t.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{t.title}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${difficultyColors[t.difficulty]}`}>
                      {difficultyLabels[t.difficulty]}
                    </span>
                    {t.frequency !== 'once' && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium text-blue-500 bg-blue-50">
                        {frequencyLabels[t.frequency]}
                      </span>
                    )}
                  </div>
                  {t.reason && (
                    <div className="text-xs text-text-tertiary mt-1">{t.reason}</div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-primary">+{t.points}</span>
                  <span className="text-xs text-text-tertiary">积分</span>
                </div>
              </div>
            </button>
          ))}
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(50);
  const [childId, setChildId] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<RecommendedTask[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

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

  useEffect(() => {
    if (childId) {
      fetchRecommendations();
    }
  }, [childId]);

  async function fetchRecommendations() {
    if (!childId) return;
    setRecommendationsLoading(true);
    try {
      const list = await getTaskRecommendations({ childId, count: 5 });
      setRecommendations(list);
    } catch (e: any) {
      setRecommendations([]);
    } finally {
      setRecommendationsLoading(false);
    }
  }

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
  const currentChild = children.find((c) => c.id === childId);

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg">发布新任务</h1>
            <div className="w-10 h-10" />
          </div>
          <p className="text-white/80 text-sm">为孩子设定一个可完成的小目标，并约定好积分奖励。</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
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
        </div>

        {childId && currentChild && (
          <RecommendedTasks
            recommendations={recommendations}
            loading={recommendationsLoading}
            childName={currentChild.nickname}
            onRefresh={fetchRecommendations}
            onPick={(t, d, p) => {
              setTitle(t);
              setDescription(d);
              setPoints(p);
            }}
          />
        )}

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

        <div className="h-8" />
      </div>
    </div>
  );
}

export default CreateTaskPage;
