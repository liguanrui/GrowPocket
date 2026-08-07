import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Star, Calendar, CheckCircle2, XCircle, Trash2, Sparkles, Flame, TrendingUp, Target, AlertTriangle, ChevronRight, ListTree, ChevronDown, Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import * as tasksService from '../services/tasks';
import { parseTaskPhotos } from '../services/tasks';
import * as scoreService from '../services/score';
import { getAbilities, getChildScores } from '../services/ability';
import { getCycleStats } from '../services/growthCycle';
import { getHabitStats } from '../services/habits';
import { getChildren, getParent } from '../services/parentTasks';
import { MediaUploader } from '../components/MediaUploader';
import { getTaskTags } from '../utils/taskTags';
import type { Task } from '../services/tasks';
import type { AbilityDimension, ChildAbilityScore } from '../services/ability';
import type { CycleStats } from '../services/growthCycle';
import type { HabitStats } from '../services/habits';

const STATUS_MAP: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: '进行中', color: 'text-orange-700', bg: 'bg-orange-100' },
  2: { label: '待验收', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  3: { label: '已完成', color: 'text-green-700', bg: 'bg-green-100' },
  4: { label: '已拒绝', color: 'text-red-700', bg: 'bg-red-100' },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface SubTaskOutlineItem {
  title: string;
  description?: string;
  estimated_days?: number;
  sequence?: number;
  is_key_milestone?: boolean;
}

interface TimelineItem {
  id: number; // 0 表示来自大纲的虚拟（未实例化）节点
  title: string;
  description?: string;
  status: number; // 0=未开始（虚拟）
  is_key_milestone: boolean;
  updated_at?: string;
  sequence: number;
  estimated_days?: number;
}

// 合并已实例化子任务与大纲中未实例化的项，按 sequence 排序
function buildTimeline(childTasks: Task[], outlineStr?: string): TimelineItem[] {
  let outline: SubTaskOutlineItem[] = [];
  if (outlineStr) {
    try {
      outline = JSON.parse(outlineStr) as SubTaskOutlineItem[];
    } catch {
      outline = [];
    }
  }

  const childrenBySeq = new Map<number, Task>();
  childTasks.forEach((c) => {
    if (c.sequence != null) childrenBySeq.set(c.sequence, c);
  });

  const items: TimelineItem[] = [];
  const usedChildIds = new Set<number>();

  outline.forEach((o, idx) => {
    const seq = o.sequence ?? idx;
    const child = childrenBySeq.get(seq);
    if (child) {
      usedChildIds.add(child.id);
      items.push({
        id: child.id,
        title: child.title,
        description: child.description,
        status: child.status,
        is_key_milestone: child.is_key_milestone ?? o.is_key_milestone ?? false,
        updated_at: child.updated_at,
        sequence: seq,
        estimated_days: o.estimated_days,
      });
    } else {
      items.push({
        id: 0,
        title: o.title,
        description: o.description,
        status: 0,
        is_key_milestone: o.is_key_milestone ?? false,
        sequence: seq,
        estimated_days: o.estimated_days,
      });
    }
  });

  // 兜底：追加未出现在大纲中的已实例化子任务
  childTasks.forEach((c) => {
    if (!usedChildIds.has(c.id)) {
      items.push({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
        is_key_milestone: c.is_key_milestone ?? false,
        updated_at: c.updated_at,
        sequence: c.sequence ?? items.length,
      });
    }
  });

  items.sort((a, b) => a.sequence - b.sequence);
  return items;
}


function ReviewModal({
  task,
  onClose,
  onApprove,
  onReject,
}: {
  task: Task;
  onClose: () => void;
  onApprove: (points: number) => void;
  onReject: () => void;
}) {
  const [mode, setMode] = useState<'approve' | 'reject'>('approve');
  const [points, setPoints] = useState(task.points);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl max-h-[82vh] mb-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] overflow-y-auto">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-text-primary text-lg">验收任务</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50">
          <button
            onClick={() => setMode('approve')}
            className={`py-3 rounded-xl text-sm font-medium transition-colors ${
              mode === 'approve' ? 'bg-success text-white' : 'bg-white text-text-secondary'
            }`}
          >
            <CheckCircle2 size={16} className="inline mr-1" />
            验收通过
          </button>
          <button
            onClick={() => setMode('reject')}
            className={`py-3 rounded-xl text-sm font-medium transition-colors ${
              mode === 'reject' ? 'bg-danger text-white' : 'bg-white text-text-secondary'
            }`}
          >
            <XCircle size={16} className="inline mr-1" />
            验收拒绝
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-bg rounded-xl p-4 space-y-1.5">
            <div className="font-medium text-text-primary">{task.title}</div>
            <div className="text-sm text-text-secondary">原任务积分：{task.points}</div>
          </div>

          {mode === 'approve' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  实际发放积分
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPoints(Math.max(0, points - 10))}
                    className="w-10 h-10 rounded-full bg-bg text-text-primary text-xl hover:bg-gray-200"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-bg rounded-xl py-3 text-center">
                    <Star size={16} className="inline text-primary mr-1" />
                    <span className="text-2xl font-bold text-primary">{points}</span>
                  </div>
                  <button
                    onClick={() => setPoints(points + 10)}
                    className="w-10 h-10 rounded-full bg-bg text-text-primary text-xl hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-success/5 border border-success/20 rounded-xl p-4">
                <div className="text-sm text-success font-medium">通过后：</div>
                <div className="text-sm text-text-secondary mt-1">
                  • 任务状态变为「已完成」
                  <br />• {points} 积分发放到孩子账户
                </div>
              </div>
            </>
          )}

          {mode === 'reject' && (
            <div className="bg-danger/5 border border-danger/20 rounded-xl p-4">
              <div className="text-sm text-danger font-medium">拒绝后：</div>
              <div className="text-sm text-text-secondary mt-1">
                • 任务状态变为「已拒绝」
                <br />• 不发放积分
                <br />• 孩子可以重新提交成果
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-gray-50 border-t border-gray-100">
          <button
            onClick={() => (mode === 'approve' ? onApprove(points) : onReject())}
            className={`w-full py-3 text-white rounded-xl font-medium transition-colors ${
              mode === 'approve' ? 'bg-success hover:bg-green-700' : 'bg-danger hover:bg-red-700'
            }`}
          >
            {mode === 'approve' ? `通过并发放 ${points} 积分` : '确认拒绝'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const childStore = useChildStore();
  const toast = useToastStore();
  const uiStore = useUIStore();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  // 多图成果：从 Photo 字段解析（单图/JSON数组/逗号分隔），与 photo(单图兼容字段) 同步
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [abilities, setAbilities] = useState<AbilityDimension[]>([]);
  const [habitStats, setHabitStats] = useState<HabitStats | null>(null);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [childTasks, setChildTasks] = useState<Task[]>([]);
  const [cycleStats, setCycleStats] = useState<CycleStats | null>(null);
  const [childScores, setChildScores] = useState<ChildAbilityScore[]>([]);
  // 习惯打卡手风琴：默认展开
  const [habitOpen, setHabitOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // 临时暴露上传中状态：MediaUploader 是自管状态，外层通过「约定字段」传 backchannel
  // 方式：在 onChange 回调里 setPhotos 之后额外判断一个「是否有任何 pending」
  // 为了让提交按钮能感知上传中，MediaUploader 提供 onUploadingChange 回调
  const [mediaUploading, setMediaUploading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        await childStore.fetchChildren();
        if (!id) {
          if (mounted) setLoading(false);
          return;
        }
        const t = await tasksService.getTask(Number(id));
        if (mounted) {
          setTask(t);
          setPhoto(t.photo);
          setPhotos(parseTaskPhotos(t.photo));
          if (t.ability_dimension_id) {
            getAbilities().then(setAbilities).catch(() => {});
          }
        }
        const bal = await scoreService.getBalance(t.child_id);
        if (mounted) {
          setCurrentBalance(bal.balance);
          childStore.updateBalance(t.child_id, bal.balance);
        }
      } catch (e: any) {
        if (mounted) setError(e.message || '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [id]);

  // 习惯打卡统计
  useEffect(() => {
    if (task?.task_kind === 'habit_daily' && task.habit_id) {
      getHabitStats(task.habit_id)
        .then(setHabitStats)
        .catch(() => setHabitStats(null));
    } else {
      setHabitStats(null);
    }
  }, [task?.task_kind, task?.habit_id]);

  // 前端兜底生成最近 21 天完整打卡日历（3×7），避免后端只返回几天就出现大灰块
  const checkinGrid = useMemo<{ date: string; completed: boolean; isToday: boolean }[]>(() => {
    if (!habitStats) return [];
    // 用后端返回的日期建 Map（只匹配 yyyy-mm-dd）
    const map = new Map<string, boolean>();
    for (const d of habitStats.checkin_calendar || []) {
      try {
        const key = d.date.replace(/T.*$/, '').slice(0, 10);
        if (key) map.set(key, !!d.completed);
      } catch {}
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);
    const out: { date: string; completed: boolean; isToday: boolean }[] = [];
    for (let i = 20; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      out.push({
        date: key,
        completed: map.get(key) ?? false,
        isToday: key === todayKey,
      });
    }
    return out;
  }, [habitStats]);

  const hasAnyCheckin = useMemo(
    () => (habitStats?.total_count || 0) > 0 || checkinGrid.some((d) => d.completed),
    [habitStats, checkinGrid]
  );

  // 父任务信息与子任务列表
  useEffect(() => {
    if (task?.task_kind === 'child' && task.parent_id) {
      getParent(task.parent_id)
        .then(setParentTask)
        .catch(() => setParentTask(null));
      getChildren(task.parent_id)
        .then(setChildTasks)
        .catch(() => setChildTasks([]));
    } else if (task?.task_kind === 'parent') {
      // parent 任务详情：加载自身子任务用于阶段流水时间线
      setParentTask(null);
      getChildren(task.id)
        .then(setChildTasks)
        .catch(() => setChildTasks([]));
    } else {
      setParentTask(null);
      setChildTasks([]);
    }
  }, [task?.task_kind, task?.parent_id, task?.id]);

  // daily 任务本周期累计统计
  useEffect(() => {
    const isDailyTask = task?.task_kind === 'daily' || !task?.task_kind;
    if (isDailyTask && task?.child_id) {
      const childId = task.child_id;
      getCycleStats(childId)
        .then(setCycleStats)
        .catch(() => setCycleStats(null));
      getChildScores(childId)
        .then(setChildScores)
        .catch(() => setChildScores([]));
    } else {
      setCycleStats(null);
      setChildScores([]);
    }
  }, [task?.task_kind, task?.child_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-danger font-medium">{error}</div>
          <button
            onClick={() => navigate(-1)}
            className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex flex-col items-center justify-center p-6">
        <p className="text-text-secondary">任务不存在</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-primary">
          返回
        </button>
      </div>
    );
  }

  const child = useChildStore.getState().children.find((c) => c.id === task.child_id);
  const childName = task.child_name || child?.nickname || '未设置';
  const status = STATUS_MAP[task.status] || STATUS_MAP[1];
  const primaryDim = abilities.find(a => a.id === task.ability_dimension_id);
  const secondaryIds: number[] = task.secondary_dimensions ? JSON.parse(task.secondary_dimensions) : [];
  const secondaryDims = secondaryIds
    .map(id => abilities.find(a => a.id === id))
    .filter((d): d is AbilityDimension => !!d);

  // 统一标签
  const tags = getTaskTags(task);

  // parent 任务阶段流水
  const isParentTask = task.task_kind === 'parent';
  const parentTimeline = isParentTask ? buildTimeline(childTasks, task.sub_task_outline) : [];
  const completedStageCount = parentTimeline.filter((i) => i.status === 3).length;
  const totalStageCount = parentTimeline.length;
  const stageProgressPercent = totalStageCount > 0 ? Math.round((completedStageCount / totalStageCount) * 100) : 0;
  const keyMilestoneStages = parentTimeline.filter((i) => i.is_key_milestone);
  const totalEstimatedDays = parentTimeline.reduce((s, i) => s + (i.estimated_days || 0), 0);

  // daily 任务本周期累计：仅 daily 或无 task_kind 时展示
  const isDailyTask = task.task_kind === 'daily' || !task.task_kind;
  const abilityScore = task.ability_dimension_id
    ? childScores.find((s) => s.dimension_id === task.ability_dimension_id)
    : undefined;

  const handleSubmit = async () => {
    if (submitting || mediaUploading) return;
    try {
      setSubmitting(true);
      // 有多个图 → 走 photo_urls 数组通道；仅 0/1 张图走旧单图通道
      const updated =
        photos.length > 1
          ? await tasksService.submitTask(task.id, undefined, photos)
          : await tasksService.submitTask(task.id, photos[0] || '');
      setTask(updated);
      setPhotos(parseTaskPhotos(updated.photo));
      setPhoto(updated.photo);
      toast.success('任务已提交验收');
    } catch (e: any) {
      toast.error(e.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (points: number) => {
    try {
      const updated = await tasksService.reviewTask(task.id, true, points);
      setTask(updated);
      setShowReview(false);
      uiStore.setPreviousBalance(currentBalance);
      uiStore.setNeedRefreshScore(true);
      uiStore.setNeedRefreshTasks(true);
      childStore.setCurrentChildId(task.child_id);
      toast.success(`验收通过，已发放 ${points} 积分`);
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 800);
    } catch (e: any) {
      toast.error(e.message || '验收失败');
    }
  };

  const handleReject = async () => {
    try {
      const updated = await tasksService.reviewTask(task.id, false);
      setTask(updated);
      setShowReview(false);
      uiStore.setNeedRefreshTasks(true);
      toast.success('已拒绝任务');
    } catch (e: any) {
      toast.error(e.message || '拒绝失败');
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除这个任务吗？')) return;
    try {
      await tasksService.deleteTask(task.id);
      uiStore.setNeedRefreshTasks(true);
      toast.success('任务已删除');
      navigate(-1);
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-6 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${status.color} ${status.bg}`}>
              {status.label}
            </div>
            <button
              onClick={handleDelete}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              <Trash2 size={18} className="text-white" />
            </button>
          </div>
          <h1 className="text-white font-semibold text-xl leading-snug">{task.title}</h1>
          {task.description && <p className="text-white/80 text-sm mt-1.5 leading-relaxed line-clamp-3">{task.description}</p>}

          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
              {tags.map((tag) => (
                <span
                  key={tag.label}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${tag.color}`}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          )}

          {/* 紧凑元信息条：积分 · 指派 · 截止 （一行呈现，弱化视觉） */}
          <div className="mt-3 flex items-center gap-3 text-xs text-white/85 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Star size={12} className="text-yellow-200 fill-yellow-200" />
              {task.points} 积分
            </span>
            <span className="text-white/50">·</span>
            <span>指派 {childName}</span>
            {task.deadline && (
              <>
                <span className="text-white/50">·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} />
                  {task.deadline}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-3">
        {/* 习惯打卡：手风琴（顶部前置，默认展开，纯白底） */}
        {task.task_kind === 'habit_daily' && habitStats && (
          <div className="overflow-hidden bg-white border border-warm-light rounded-2xl shadow-sm">
            <button
              onClick={() => setHabitOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Flame size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  习惯打卡
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                    连续 {habitStats.streak_count} 天 · 累计 {habitStats.total_count} 天
                  </span>
                </div>
              </div>
              <ChevronDown
                size={18}
                className={`text-text-tertiary transition-transform ${habitOpen ? '' : '-rotate-90'}`}
              />
            </button>

            {habitOpen && (
              <div className="px-4 pb-4 space-y-3">
                {/* 目标进度条 */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-text-secondary flex items-center gap-1">
                      <Target size={12} />
                      目标进度
                    </span>
                    <span className="font-semibold text-text-primary">
                      {habitStats.streak_count}/{habitStats.habit_goal}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (habitStats.streak_count / Math.max(1, habitStats.habit_goal)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* 上次打卡 */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">上次打卡</span>
                  <span className="text-text-primary font-medium">
                    {habitStats.last_checkin_date || '暂无'}
                  </span>
                </div>

                {/* 最近 21 天打卡：3×7 满格；无历史打卡时显示友好空态 + 迷你格子 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[11px] text-text-tertiary">最近 21 天</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
                      <span className="inline-block w-2 h-2 rounded-sm bg-primary" /> 已打卡
                      <span className="inline-block w-2 h-2 rounded-sm border border-gray-300" /> 未打卡
                    </div>
                  </div>
                  {!hasAnyCheckin ? (
                    <div className="rounded-xl bg-bg p-3 text-xs text-text-secondary flex items-start gap-2">
                      <Flame size={14} className="text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-text-primary mb-0.5">还没有打卡记录</div>
                        <div className="text-[11px] text-text-tertiary leading-relaxed">
                          完成今日任务即可点亮第一个格子，坚持 21 天养成好习惯~
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className={`grid grid-cols-7 gap-1 ${!hasAnyCheckin ? 'mt-2' : ''}`}>
                    {checkinGrid.map((day, idx) => (
                      <div
                        key={`${day.date}-${idx}`}
                        title={day.date + (day.isToday ? '（今天）' : '') + (day.completed ? ' 已打卡' : day.isToday ? ' 今日待完成' : ' 未打卡')}
                        className={`aspect-square rounded ${
                          day.completed
                            ? 'bg-primary shadow-sm'
                            : day.isToday
                            ? 'border-2 border-primary/60 bg-primary/5'
                            : hasAnyCheckin
                            ? 'bg-gray-100'
                            : 'border border-gray-200 bg-white'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {task.parent_id && (
                  <button
                    onClick={() => navigate(`/task/${task.parent_id}`)}
                    className="w-full flex items-center justify-between py-2 px-3 bg-bg rounded-lg text-xs text-text-secondary hover:bg-gray-100 transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <ListTree size={12} />
                      查看父任务
                    </span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {task.guardian_required && (
          <div className="bg-rose-500 text-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle size={20} />
              <span>⚠️ 此任务需要家长陪伴完成</span>
            </div>
            <p className="mt-2 text-sm text-white/90">请家长在旁指导，注意安全</p>
          </div>
        )}

        {isDailyTask && cycleStats && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <div className="flex-1">
                <h3 className="font-semibold text-text-primary">本周期累计</h3>
                {cycleStats.cycle_name && (
                  <p className="text-xs text-text-tertiary mt-0.5">{cycleStats.cycle_name}</p>
                )}
              </div>
            </div>

            {/* 累计统计行 */}
            <div className="flex items-center gap-2 text-sm bg-white/60 rounded-xl py-2.5 px-3">
              <TrendingUp size={14} className="text-amber-500 flex-shrink-0" />
              <span className="text-text-secondary">
                累计完成 <span className="font-bold text-amber-600">{cycleStats.completed_task_count}</span> 个任务
              </span>
              <span className="text-text-tertiary">·</span>
              <span className="text-text-secondary">
                <span className="font-bold text-amber-600">{cycleStats.total_points_earned}</span> 积分
              </span>
            </div>

            {/* 能力维度 */}
            {task.ability_dimension_id && abilityScore && (
              <div className="flex items-center justify-between py-2 px-3 bg-white/60 rounded-xl">
                <span className="text-sm text-text-tertiary flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" />
                  能力维度
                </span>
                <span className="text-sm font-medium text-text-primary">
                  {abilityScore.dimension_name} · <span className="text-primary font-bold">{abilityScore.score}</span> 分
                </span>
              </div>
            )}

            {/* 周期目标提示 */}
            {cycleStats.focus_dim_names && cycleStats.focus_dim_names.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-text-secondary bg-white/60 rounded-xl py-2 px-3">
                <Target size={14} className="text-primary mt-0.5 flex-shrink-0" />
                <span>本周期重点关注：{cycleStats.focus_dim_names.join('、')}</span>
              </div>
            )}

            {/* 剩余天数 */}
            {cycleStats.days_remaining > 0 && (
              <div className="flex items-center justify-between text-sm bg-white/60 rounded-xl py-2 px-3">
                <span className="text-text-tertiary flex items-center gap-1.5">
                  <Calendar size={14} className="text-orange-500" />
                  剩余天数
                </span>
                <span className="font-medium text-orange-600">{cycleStats.days_remaining} 天</span>
              </div>
            )}
          </div>
        )}

        {isParentTask && (
          <div className="bg-card rounded-2xl p-4 shadow-sm space-y-4">
            {/* 主题头部 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ListTree size={16} className="text-primary" />
                <h3 className="font-semibold text-text-primary">阶段流水</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {task.category && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {task.category}
                  </span>
                )}
                <span className="text-sm text-text-secondary">
                  共 {totalStageCount} 个阶段{totalEstimatedDays > 0 ? ` · 预计 ${totalEstimatedDays} 天` : ''}
                </span>
              </div>
            </div>

            {/* 整体进度条 */}
            {totalStageCount > 0 && (
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">整体进度</span>
                  <span className="font-medium text-text-primary">
                    已完成 {completedStageCount}/{totalStageCount} · {stageProgressPercent}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full transition-all"
                    style={{ width: `${stageProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* 时间线 */}
            {parentTimeline.length > 0 && (
              <div>
                {parentTimeline.map((item, idx) => {
                  const isLast = idx === parentTimeline.length - 1;
                  const completed = item.status === 3;
                  const inProgress = item.id !== 0 && item.status !== 3;
                  const notStarted = item.id === 0;
                  return (
                    <div key={`stage-${idx}`} className="flex gap-3">
                      {/* 左侧圆点 + 连线 */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            completed
                              ? 'bg-green-500'
                              : inProgress
                                ? 'bg-orange-400 animate-pulse'
                                : 'border-2 border-gray-300 bg-white'
                          }`}
                        >
                          {completed && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 min-h-[24px]" />}
                      </div>
                      {/* 右侧内容 */}
                      <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-medium ${
                              completed ? 'text-text-primary' : 'text-text-secondary'
                            }`}
                          >
                            {item.title}
                          </span>
                          {item.is_key_milestone && <span className="text-xs">🌟</span>}
                          {completed && item.updated_at && (
                            <span className="text-xs text-text-tertiary">
                              {formatMonthDay(item.updated_at)}
                            </span>
                          )}
                          {inProgress && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              进行中
                            </span>
                          )}
                          {notStarted && (
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              未开始
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-text-tertiary mt-1">{item.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 关键里程碑专区 */}
            {keyMilestoneStages.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-text-tertiary flex items-center gap-1">
                  <Star size={12} className="text-amber-500 fill-amber-500" />
                  关键里程碑
                </div>
                <div className="space-y-1.5">
                  {keyMilestoneStages.map((m, idx) => (
                    <div
                      key={`milestone-${idx}`}
                      className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-xl"
                    >
                      <span className="text-sm text-text-primary flex items-center gap-1.5">
                        <Star size={14} className="text-amber-500 fill-amber-500" />
                        {m.title}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          m.status === 3 ? 'text-success' : 'text-text-tertiary'
                        }`}
                      >
                        {m.status === 3 ? '已完成' : '未完成'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 成果照片 / 视频：弱化权重，不再做突出标题卡片 */}
        <div className="bg-card rounded-2xl px-3.5 py-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-text-secondary">成果照片 / 视频</span>
              <span className="text-[11px] text-text-tertiary">可选</span>
            </div>
          </div>
          <MediaUploader
            mediaUrls={photos}
            onChange={(urls) => {
              setPhotos(urls);
              // 兼容单图字段同步：0 张=undefined，1 张=原字符串，>1 张=JSON 数组字符串
              if (urls.length === 0) setPhoto(undefined);
              else if (urls.length === 1) setPhoto(urls[0]);
              else setPhoto(JSON.stringify(urls));
            }}
            onUploadingChange={setMediaUploading}
            disabled={task.status === 2 || task.status === 3}
            size="compact"
            maxCount={9}
            label="上传成果（可选）"
          />
          <p className="mt-2 text-[11px] text-text-tertiary leading-relaxed">
            {task.status === 1 || task.status === 4
              ? `可多选（最多 9 张）。支持图片与 60 秒内视频，不上传也可提交验收`
              : task.status === 3
                ? photos.length > 0
                  ? `任务已完成，共 ${photos.length} 件成果已存档 · 点击查看大图`
                  : '任务已完成（未附带成果媒体）'
                : photos.length > 0
                  ? `已提交 ${photos.length} 件成果，等待家长验收 · 点击查看大图`
                  : '已提交验收（未附带成果媒体）'}
          </p>
        </div>

        {task.status === 1 && (
          <button
            onClick={handleSubmit}
            disabled={submitting || mediaUploading}
            className="w-full py-4 bg-primary text-white rounded-2xl font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                提交中...
              </>
            ) : mediaUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                上传中，请稍候
              </>
            ) : photos.length === 0 ? (
              '提交验收（可不传图）'
            ) : (
              `提交验收（${photos.length} 张成果）`
            )}
          </button>
        )}
        {task.status === 4 && (
          <button
            onClick={handleSubmit}
            disabled={submitting || mediaUploading}
            className="w-full py-4 bg-primary text-white rounded-2xl font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                提交中...
              </>
            ) : mediaUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                上传中，请稍候
              </>
            ) : photos.length === 0 ? (
              '重新提交验收（可不传图）'
            ) : (
              `重新提交验收（${photos.length} 张成果）`
            )}
          </button>
        )}
        {task.status === 2 && (
          <button
            onClick={() => setShowReview(true)}
            className="w-full py-4 bg-success text-white rounded-2xl font-medium hover:bg-green-700 transition-colors shadow-lg shadow-success/20"
          >
            验收 · 发放积分
          </button>
        )}
        {task.status === 3 && (
          <div className="bg-success/5 border border-success/20 rounded-2xl p-5 text-center">
            <CheckCircle2 size={28} className="text-success mx-auto" />
            <div className="mt-2 text-success font-medium">任务已完成</div>
            <div className="text-sm text-text-secondary mt-1">
              {task.points} 积分已发放给 {childName}
            </div>
          </div>
        )}

        {/* 任务信息：紧凑底栏，无厚重分隔线 */}
        <div className="bg-card rounded-2xl px-4 py-3.5 shadow-sm space-y-2.5">
          <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-1">任务信息</div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-tertiary">状态</span>
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-tertiary">指派给</span>
            <span className="text-text-primary font-medium">{childName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-tertiary">原任务积分</span>
            <span className="text-primary font-bold">{task.points} 积分</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-tertiary">创建时间</span>
            <span className="text-text-secondary text-xs">{formatDateTime(task.created_at)}</span>
          </div>
        </div>

        {task.task_kind === 'child' && parentTask && (
          <div className="bg-card rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ListTree size={16} className="text-primary" />
              <h3 className="font-semibold text-text-primary">父任务信息</h3>
            </div>

            <div className="bg-bg rounded-xl p-3 space-y-1.5">
              <div className="font-medium text-text-primary">{parentTask.title}</div>
              {parentTask.description && (
                <p className="text-sm text-text-secondary leading-relaxed">{parentTask.description}</p>
              )}
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-text-tertiary">整体进度</span>
              <span className="text-sm font-medium text-text-primary">
                已完成 {childTasks.filter((t) => t.status === 3).length}/{childTasks.length} 个子任务
              </span>
            </div>

            {childTasks.filter((t) => t.is_key_milestone).length > 0 && (
              <div>
                <div className="text-xs text-text-tertiary mb-2">关键子任务</div>
                <div className="space-y-1.5">
                  {childTasks
                    .filter((t) => t.is_key_milestone)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-xl"
                      >
                        <span className="text-sm text-text-primary flex items-center gap-1.5">
                          <Star size={14} className="text-amber-500 fill-amber-500" />
                          {t.title}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            t.status === 3 ? 'text-success' : 'text-text-tertiary'
                          }`}
                        >
                          {t.status === 3 ? '已完成' : '未完成'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <button
              onClick={() => navigate(`/task/${parentTask.id}`)}
              className="w-full flex items-center justify-between py-2.5 px-3 bg-bg rounded-xl text-sm text-text-secondary hover:bg-gray-100"
            >
              <span className="flex items-center gap-1.5">
                <ListTree size={14} />
                查看父任务详情
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {task.ability_dimension_id && (
          <div className="bg-card rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-primary" />
              <h3 className="font-semibold text-text-primary">能力提升</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {primaryDim && (
                <span className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: primaryDim.color + '20', color: primaryDim.color }}>
                  {primaryDim.name} · 主维度
                </span>
              )}
              {secondaryDims.map(dim => (
                <span key={dim.id} className="px-3 py-1.5 rounded-full text-sm" style={{ backgroundColor: dim.color + '15', color: dim.color }}>
                  {dim.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>

      {showReview && (
        <ReviewModal
          task={task}
          onClose={() => setShowReview(false)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

export default TaskDetailPage;
