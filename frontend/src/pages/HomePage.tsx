import { useState, useEffect, useRef } from 'react';
import { Plus, TrendingUp, Gift, Clock, CheckCircle, CheckCircle2, Inbox, FileText, XCircle, Minus, ClipboardList, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { ChildTabs } from '../components/ChildTabs';
import { AnimatedNumberComponent as AnimatedNumber } from '../components/AnimatedNumber';
import * as tasksService from '../services/tasks';
import * as scoreService from '../services/score';
import type { Task, TaskStatus } from '../services/tasks';
import { getTaskTags } from '../utils/taskTags';

const STATUS_TABS: { id: 'all' | TaskStatus; label: string; icon: any; color: string }[] = [
  { id: 'all', label: '全部', icon: FileText, color: 'text-text-primary' },
  { id: 1, label: '进行中', icon: Clock, color: 'text-primary' },
  { id: 2, label: '待验收', icon: Inbox, color: 'text-yellow-600' },
  { id: 3, label: '已完成', icon: CheckCircle2, color: 'text-success' },
  { id: 4, label: '已拒绝', icon: XCircle, color: 'text-danger' },
];

function PointsCard({ balance, previousBalance, nickname, monthIncome, monthExpense, onAdd, onDeduct, onClick, onAnimationComplete }: { balance: number; previousBalance: number | null; nickname: string; monthIncome: number; monthExpense: number; onAdd: () => void; onDeduct: () => void; onClick: () => void; onAnimationComplete?: () => void }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="text-center">
        <div className="text-text-tertiary text-sm">{nickname} 的积分余额</div>
        <div className="text-5xl font-bold bg-gradient-to-r from-primary to-warm-light bg-clip-text text-transparent mt-2 tracking-tight">
          <AnimatedNumber value={balance} startFrom={previousBalance} onComplete={onAnimationComplete} />
        </div>
        <div className="flex justify-center gap-4 mt-4">
          <div className="flex items-center gap-1 text-text-tertiary text-sm">
            <TrendingUp size={14} />
            <span>本月获得 {monthIncome}</span>
          </div>
          <div className="flex items-center gap-1 text-text-tertiary text-sm">
            <Minus size={14} />
            <span>本月消耗 {monthExpense}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-success/10 text-success rounded-lg hover:bg-success/20 transition-colors"
        >
          <Plus size={16} />
          <span className="text-xs font-medium">加积分</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDeduct(); }}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 transition-colors"
        >
          <Minus size={16} />
          <span className="text-xs font-medium">减积分</span>
        </button>
      </div>
    </div>
  );
}

function TaskStatsCard({ tasks }: { tasks: Task[] }) {
  const inProgress = tasks.filter((t) => t.status === 1).length;
  const submitted = tasks.filter((t) => t.status === 2).length;
  const completed = tasks.filter((t) => t.status === 3).length;

  const stats = [
    { label: '进行中', value: inProgress, icon: Clock, color: 'text-primary', bg: 'bg-primary/10' },
    { label: '待验收', value: submitted, icon: Inbox, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: '已完成', value: completed, icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="bg-card rounded-2xl p-4 shadow-sm text-center">
            <div className={`w-10 h-10 mx-auto rounded-xl ${s.bg} flex items-center justify-center`}>
              <Icon size={18} className={s.color} />
            </div>
            <div className="text-2xl font-bold text-text-primary mt-2">{s.value}</div>
            <div className="text-xs text-text-tertiary mt-1">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatusTabs({
  active,
  onChange,
  tasks,
}: {
  active: 'all' | TaskStatus;
  onChange: (status: 'all' | TaskStatus) => void;
  tasks: Task[];
}) {
  return (
    <div className="flex gap-0.5 bg-card rounded-2xl p-1 shadow-sm">
      {STATUS_TABS.map((tab) => {
        const count = tab.id === 'all' ? tasks.length : tasks.filter((t) => t.status === tab.id).length;
        const isActive = active === tab.id;
        return (
          <button
            key={String(tab.id)}
            onClick={() => onChange(tab.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-0.5 px-1 py-2 rounded-xl text-[11px] font-medium transition-all ${
              isActive ? 'bg-primary text-white shadow' : 'text-text-secondary hover:bg-gray-50'
            }`}
          >
            <span className="truncate">{tab.label}</span>
            <span
              className={`flex-shrink-0 text-[10px] min-w-[1.1rem] px-1 rounded-full text-center ${
                isActive ? 'bg-white/20' : 'bg-gray-100 text-text-tertiary'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TaskItem({
  task,
  onClick,
  showStatus,
  highlight,
  onComplete,
  onReject,
  isParentTheme,
  currentStageTitle,
  currentStageSequence,
  childCompletedCount,
  childTotalCount,
}: {
  task: Task;
  onClick: () => void;
  showStatus?: boolean;
  highlight?: boolean;
  onComplete?: (task: Task) => void;
  onReject?: (task: Task) => void;
  isParentTheme?: boolean;
  currentStageTitle?: string;
  currentStageSequence?: number;
  childCompletedCount?: number;
  childTotalCount?: number;
}) {
  const statusInfo = STATUS_TABS.find((t) => t.id === task.status) || STATUS_TABS[0];
  const Icon = statusInfo.icon;
  const isAITask = !!task.ai_generated;
  const canReviewAI = isAITask && task.status === 1;
  const tags = getTaskTags(task);
  const visibleTags = tags.slice(0, 3);
  const hiddenTagCount = tags.length - visibleTags.length;
  const showStreak = task.task_kind === 'habit_daily' && (task.streak_count || 0) > 0;
  const showSequence = task.task_kind === 'child' && (task.sequence || 0) > 0;

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer bg-card rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98] ${
        highlight ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''
      }`}
      style={highlight ? { animation: 'highlightPulse 1.5s ease-in-out' } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="font-medium text-text-primary truncate">{task.title}</div>
            {isParentTheme && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary flex-shrink-0">
                主题任务
              </span>
            )}
          </div>
          {/* 统一标签区：最多展示 3 个标签 + 超量折叠 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag.label}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tag.color}`}
              >
                {tag.label === 'AI 生成' ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Sparkles size={10} />
                    {tag.label}
                  </span>
                ) : (
                  tag.label
                )}
              </span>
            ))}
            {hiddenTagCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                +{hiddenTagCount}
              </span>
            )}
            {showStreak && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-600">
                🔥 连续 {task.streak_count} 天
              </span>
            )}
            {showSequence && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-600">
                阶段 #{task.sequence}
              </span>
            )}
            {isParentTheme && currentStageTitle && (currentStageSequence || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-orange-700">
                阶段 #{currentStageSequence} · {currentStageTitle}
              </span>
            )}
          </div>
          {task.description && !isParentTheme && (
            <div className="text-sm text-text-tertiary mt-1 line-clamp-2">{task.description}</div>
          )}
          {isParentTheme && currentStageTitle && (
            <div className="text-sm text-text-tertiary mt-1 line-clamp-2">
              当前进行中：{currentStageTitle}
            </div>
          )}
          {task.deadline && (
            <div className="text-xs text-text-tertiary mt-2 flex items-center gap-1">
              <Clock size={12} />
              <span>截止：{new Date(task.deadline).toLocaleDateString()}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {isParentTheme ? (
            <div className="text-right">
              <div className="text-primary font-bold text-sm leading-tight">
                {childCompletedCount ?? 0}/{childTotalCount ?? 0}
              </div>
              <div className="text-[10px] text-text-tertiary mt-0.5">阶段进度</div>
            </div>
          ) : (
            <div className="text-primary font-bold text-lg">{task.points}</div>
          )}
          {showStatus && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                task.status === 1
                  ? 'bg-primary/10 text-primary'
                  : task.status === 2
                  ? 'bg-yellow-100 text-yellow-700'
                  : task.status === 3
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              <Icon size={10} />
              {statusInfo.label}
            </span>
          )}
        </div>
      </div>
      {canReviewAI && (onComplete || onReject) && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          {onComplete && (
            <button
              onClick={(e) => { e.stopPropagation(); onComplete(task); }}
              className="flex-1 py-1.5 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              完成
            </button>
          )}
          {onReject && (
            <button
              onClick={(e) => { e.stopPropagation(); onReject(task); }}
              className="flex-1 py-1.5 text-xs rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
            >
              拒绝
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// AIReviewModal 家长审核 AI 任务弹窗：可调整标题/积分/难度，或拒绝删除
function AIReviewModal({ task, onClose, onReviewed }: { task: Task; onClose: () => void; onReviewed: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [points, setPoints] = useState(task.points);
  const [difficulty, setDifficulty] = useState(task.difficulty || 'medium');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToastStore();

  const handleAdjust = async () => {
    setSubmitting(true);
    try {
      await tasksService.reviewAITask(task.id, 'adjust', { title, points, difficulty });
      toast.success('已调整 AI 任务');
      onReviewed();
    } catch (e: any) {
      toast.error(e.message || '调整失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await tasksService.reviewAITask(task.id, 'reject');
      toast.success('已拒绝 AI 任务');
      onReviewed();
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-2xl p-5 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Sparkles size={18} className="text-purple-500" />
            审核 AI 任务
          </h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg leading-none">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-text-secondary">任务标题</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-sm text-text-secondary">积分</label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-sm text-text-secondary">难度</label>
            <div className="mt-1 flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 text-xs rounded-lg transition-colors ${difficulty === d ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'}`}
                >
                  {d === 'easy' ? '简单' : d === 'medium' ? '中等' : '困难'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleAdjust}
            disabled={submitting || !title.trim() || points <= 0}
            className="flex-1 py-2.5 bg-primary text-white text-sm rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            确认调整
          </button>
          <button
            onClick={handleReject}
            disabled={submitting}
            className="flex-1 py-2.5 bg-danger/10 text-danger text-sm rounded-xl hover:bg-danger/20 transition-colors disabled:opacity-50"
          >
            拒绝
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskBoard({
  tasks,
  activeStatus,
  onStatusChange,
  onTaskClick,
  onCreateTask,
  highlightTaskId,
  onReviewed,
}: {
  tasks: Task[];
  activeStatus: 'all' | TaskStatus;
  onStatusChange: (s: 'all' | TaskStatus) => void;
  onTaskClick: (taskId: number) => void;
  onCreateTask: () => void;
  highlightTaskId?: number | null;
  onReviewed?: () => void;
}) {
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const toast = useToastStore();
  // 过滤状态 + 排除子任务（子任务不独立显示）
  const statusFiltered = activeStatus === 'all' ? tasks : tasks.filter((t) => t.status === activeStatus);
  const filteredTasks = statusFiltered.filter((t) => t.task_kind !== 'child');
  const showStatus = activeStatus === 'all';

  // 从全量 tasks 中为主题父任务计算进度与当前阶段
  const calcParentThemeMeta = (task: Task) => {
    if (task.task_kind !== 'parent') return undefined;
    const childs = tasks
      .filter((t) => t.parent_id === task.id && t.task_kind === 'child')
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    // 从 sub_task_outline 解析总阶段数（包含未实例化的）
    let outlineTotal = 0;
    if (task.sub_task_outline) {
      try {
        const outline = JSON.parse(task.sub_task_outline);
        outlineTotal = Array.isArray(outline) ? outline.length : 0;
      } catch { /* ignore */ }
    }
    const total = Math.max(outlineTotal, childs.length);
    const completed = childs.filter((c) => c.status === 3).length;
    // 当前进行中：优先取第一个状态 ≠3 的实例化子任务（存在的）
    let currentStage = childs.find((c) => c.status === 1);
    if (!currentStage) currentStage = childs.find((c) => c.status === 2);
    if (!currentStage) currentStage = childs.find((c) => c.status === 4);
    if (!currentStage) currentStage = childs.find((c) => c.status !== 3);
    return {
      isParentTheme: true as const,
      childCompletedCount: completed,
      childTotalCount: total,
      currentStageTitle: currentStage?.title,
      currentStageSequence: currentStage?.sequence,
    };
  };

  // 家长一键完成 AI 任务（提交验收 + 通过），完成后跳到「已完成」Tab
  const handleComplete = async (task: Task) => {
    if (!onReviewed || actionLoadingId) return;
    setActionLoadingId(task.id);
    try {
      await tasksService.submitTask(task.id);
      await tasksService.reviewTask(task.id, true, task.points);
      toast.success(`任务已完成，已发放 ${task.points} 积分`);
      onStatusChange(3);
      onReviewed();
    } catch (e: any) {
      toast.error(e.message || '完成失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (task: Task) => {
    if (!onReviewed || actionLoadingId) return;
    setActionLoadingId(task.id);
    try {
      await tasksService.reviewAITask(task.id, 'reject');
      toast.success('已拒绝 AI 任务');
      onStatusChange(4);
      onReviewed();
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (filteredTasks.length === 0) {
    return (
      <div>
        <StatusTabs active={activeStatus} onChange={onStatusChange} tasks={tasks} />
        <div className="text-center py-12 bg-card rounded-2xl shadow-sm mt-3">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/5 flex items-center justify-center">
            <ClipboardList size={28} className="text-primary/40" />
          </div>
          <p className="text-text-primary font-medium">暂无任务</p>
          <p className="text-text-tertiary text-sm mt-1">
            {activeStatus === 'all' ? '还没有任何任务' : '这个分类下没有任务'}
          </p>
          <button
            onClick={onCreateTask}
            className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary-dark transition-colors flex items-center gap-1 mx-auto"
          >
            <Plus size={14} />
            发布任务
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StatusTabs active={activeStatus} onChange={onStatusChange} tasks={tasks} />
      <div className="space-y-3 mt-3">
        {filteredTasks.map((task) => {
          const parentMeta = calcParentThemeMeta(task);
          return (
            <TaskItem
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task.id)}
              showStatus={showStatus}
              highlight={highlightTaskId === task.id}
              onComplete={onReviewed ? handleComplete : undefined}
              onReject={onReviewed ? handleReject : undefined}
              {...(parentMeta || {})}
            />
          );
        })}
      </div>
      <style>{`
        @keyframes highlightPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(245, 158, 107, 0.4);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(245, 158, 107, 0);
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  );
}

import type { MonthlyStats } from '../services/score';

export function HomePage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const uiStore = useUIStore();
  const toast = useToastStore();
  const authStore = useAuthStore();
  const isParent = authStore.user?.role === 'parent';
  const children = childStore.children;

  const [selectedChildId, setSelectedChildId] = useState<number | null>(childStore.currentChildId);
  const [activeStatus, setActiveStatus] = useState<'all' | TaskStatus>(1);
  const [tasks, setTasks] = useState<Task[]>([]);
  const hasPrevBalance = uiStore.previousBalance != null;
  const [balance, setBalance] = useState(hasPrevBalance ? uiStore.previousBalance! : 0);
  const [loading, setLoading] = useState(!hasPrevBalance);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const taskBoardRef = useRef<HTMLDivElement>(null);
  const loadingSeqRef = useRef(0);

  // 手动触发 AI 生成今日任务
  const handleGenerateAI = async () => {
    if (!selectedChildId) return;
    setAiGenerating(true);
    try {
      const res = await tasksService.generateAITasks(selectedChildId);
      toast.success(`AI 已生成 ${res.count} 个任务`);
      loadData(false);
    } catch (e: any) {
      toast.error(e.message || 'AI 生成失败（可能未配置 API Key）');
    } finally {
      setAiGenerating(false);
    }
  };

  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadData = async (showLoading = true) => {
    if (!selectedChildId) {
      if (showLoading) setLoading(false);
      return;
    }
    // 使用请求序号避免并发竞态，而不是直接丢弃新请求
    const reqId = ++loadingSeqRef.current;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [tasksResult, balanceResult, statsResult] = await Promise.all([
        tasksService.getTasks({ childId: selectedChildId, taskKind: 'daily,habit_daily,child,parent', page: 1, pageSize: 50 }),
        scoreService.getBalance(selectedChildId),
        scoreService.getMonthlyStats(selectedChildId),
      ]);
      // 只处理最新请求的结果
      if (reqId !== loadingSeqRef.current) return;
      setTasks(tasksResult.items);
      setBalance(balanceResult.balance);
      childStore.updateBalance(selectedChildId!, balanceResult.balance);
      setMonthlyStats(statsResult);
    } catch (e: any) {
      if (reqId !== loadingSeqRef.current) return;
      setError(e.message || '加载失败');
    } finally {
      // 无论本次是否带 loading 遮罩，最新请求结束都必须清掉 loading，
      // 否则 loadData(true) 被后续 loadData(false) 顶替时会一直转圈
      if (reqId === loadingSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    async function initLoad() {
      if (children.length === 0) {
        await childStore.fetchChildren();
      }
      if (mounted) {
        const shouldShowLoading = uiStore.previousBalance == null;
        loadData(shouldShowLoading);
      }
    }
    initLoad();
    return () => {
      mounted = false;
    };
  }, [selectedChildId]);

  useEffect(() => {
    if (uiStore.needRefreshTasks || uiStore.needRefreshScore) {
      if (uiStore.needRefreshTasks) uiStore.setNeedRefreshTasks(false);
      if (uiStore.needRefreshScore) uiStore.setNeedRefreshScore(false);
      loadData(false);
    }
  }, [uiStore.needRefreshTasks, uiStore.needRefreshScore]);

  // 从详情页完成/拒绝返回时，切换到对应状态 Tab
  useEffect(() => {
    if (uiStore.pendingTaskStatus == null) return;
    setActiveStatus(uiStore.pendingTaskStatus);
    uiStore.setPendingTaskStatus(null);
  }, [uiStore.pendingTaskStatus]);

  useEffect(() => {
    if (uiStore.highlightTaskId !== null && tasks.length > 0) {
      const hasTask = tasks.some((t) => t.id === uiStore.highlightTaskId);
      if (hasTask) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const timer = setTimeout(() => {
          uiStore.setHighlightTaskId(null);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [uiStore.highlightTaskId, tasks]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthStats = monthlyStats.find((s) => s.month === currentMonth);
  const monthIncome = monthStats?.income ?? 0;
  const monthExpense = monthStats?.expense ?? 0;

  const selectedChild = children.find((c) => c.id === selectedChildId) || null;

  const handleChildSelect = (id: number) => {
    setSelectedChildId(id);
    childStore.setCurrentChildId(id);
    setActiveStatus('all');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-gray-200 animate-spin" style={{ borderTopColor: '#F59E6B' }} />
        </div>
        <div className="text-text-secondary text-sm">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-danger font-medium">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!selectedChild || children.length === 0) {
    return (
      <div className="min-h-screen bg-bg pb-24">
        <div className="bg-gradient-to-br from-primary to-primary-dark pt-3 pb-4 px-4">
          <div className="max-w-lg mx-auto">
            <h1 className="text-xl font-bold text-white">我的家庭</h1>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 -mt-3">
          <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
            <div className="text-text-primary font-medium">暂无孩子档案</div>
            <p className="text-sm text-text-tertiary mt-2">请先添加孩子信息</p>
            <button
              onClick={() => navigate('/family')}
              className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-xl"
            >
              去家庭管理
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-3 pb-4 px-4 rounded-b-2xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-white">任务看板</h1>
              <p className="text-white/80 text-sm mt-0.5">今日共 {tasks.length} 个任务</p>
            </div>
            <div className="flex items-center gap-2">
              {isParent && (
                <button
                  onClick={handleGenerateAI}
                  disabled={aiGenerating}
                  className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors disabled:opacity-60"
                >
                  <Sparkles size={16} />
                  {aiGenerating ? '生成中...' : 'AI 生成'}
                </button>
              )}
              <button
                onClick={() => navigate(`/tasks/new?child_id=${selectedChildId}`)}
                className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
              >
                <Plus size={16} /> 新建
              </button>
            </div>
          </div>

          <ChildTabs children={children} selectedId={selectedChild.id} onSelect={handleChildSelect} />

          <div className="mt-4">
            <PointsCard
              balance={balance}
              previousBalance={uiStore.previousBalance}
              nickname={selectedChild.nickname}
              monthIncome={monthIncome}
              monthExpense={monthExpense}
              onAdd={() => navigate(`/score/adjust?mode=add&child_id=${selectedChildId}`)}
              onDeduct={() => navigate(`/score/adjust?mode=deduct&child_id=${selectedChildId}`)}
              onClick={() => navigate(`/score?child_id=${selectedChildId}`)}
              onAnimationComplete={() => uiStore.setPreviousBalance(null)}
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 mt-6 space-y-5">
        <TaskBoard
          tasks={tasks}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          onTaskClick={(id) => navigate(`/task/${id}`)}
          onCreateTask={() => navigate(`/tasks/new?child_id=${selectedChildId}`)}
          highlightTaskId={uiStore.highlightTaskId}
          onReviewed={() => {
            uiStore.setNeedRefreshTasks(true);
            loadData(false);
          }}
        />

        <div className="h-4" />
      </div>

      <button
        onClick={() => navigate(`/tasks/new?child_id=${selectedChildId}`)}
        className="fixed bottom-24 right-5 w-14 h-14 bg-primary text-white rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center z-40"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

export default HomePage;
