import { useState, useEffect, useRef } from 'react';
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

/** 主题任务类别码 → 中文（与 CreateTaskPage / seed 一致） */
const THEME_CATEGORY_LABEL: Record<string, string> = {
  nature: '自然探索',
  family_creation: '家庭共创',
  creative: '创意表达',
  craft: '手工制作',
  financial: '财商培养',
  community: '社区公益',
  other: '其他',
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
  // 主题任务（parent/child）当前选中的子任务阶段 id
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const timelineWrapRef = useRef<HTMLDivElement | null>(null);
  const [, forceTimelineTick] = useState(0);

  // 时间线竖线高度：在选中节点、子任务列表或父容器尺寸变化时重算
  useEffect(() => {
    const wrap = timelineWrapRef.current;
    if (!wrap) return;
    const line = wrap.querySelector<HTMLDivElement>('[data-tl-line]');
    if (!line) return;
    const compute = () => {
      const markers = wrap.querySelectorAll<HTMLElement>('[data-tl-marker]');
      if (markers.length === 0) return;
      const first = markers[0];
      const last = markers[markers.length - 1];
      const wrapRect = wrap.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      const topY = firstRect.top - wrapRect.top + firstRect.height / 2;
      const bottomY = lastRect.top - wrapRect.top + lastRect.height / 2;
      line.style.top = `${topY}px`;
      line.style.height = `${Math.max(0, bottomY - topY)}px`;
    };
    compute();
    const raf1 = requestAnimationFrame(compute);
    const t1 = window.setTimeout(compute, 100);
    const t2 = window.setTimeout(compute, 300);
    const t3 = window.setTimeout(compute, 600);
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => compute())
        : null;
    ro?.observe(wrap);
    // 再额外监测每个 marker 内部元素的尺寸变化（展开内容变化会影响子元素高度不一定传出来）
    const innerRo =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => compute())
        : null;
    wrap.querySelectorAll<HTMLElement>('[data-tl-marker]').forEach((m) => {
      const card = m.closest('.relative') as HTMLElement | null;
      if (card) innerRo?.observe(card);
    });
    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      ro?.disconnect();
      innerRo?.disconnect();
    };
  }, [selectedStageId, childTasks.length, forceTimelineTick, id]);

  // timeline 就绪后延迟再 tick 一次（兜底 MediaUploader / 懒加载图片延迟布局）
  useEffect(() => {
    const t1 = window.setTimeout(() => forceTimelineTick((x) => x + 1), 500);
    const t2 = window.setTimeout(() => forceTimelineTick((x) => x + 1), 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [id]);

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

  // 父任务信息与子任务列表
  useEffect(() => {
    if (task?.task_kind === 'child' && task.parent_id) {
      // getParent 传 child 自己的 id，后端通过 child.parent_id 反查父任务
      getParent(task.id)
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

  // 主题任务：默认选中阶段（child→选中自身；parent→选中进行中/第一个实例化子任务）
  // 必须在早期 return 之前调用，遵守 React Hooks 规则
  useEffect(() => {
    if (!task) return;
    const isTheme = task.task_kind === 'parent' || task.task_kind === 'child';
    if (!isTheme) {
      if (selectedStageId !== null) setSelectedStageId(null);
      return;
    }
    if (selectedStageId != null) return;
    if (task.task_kind === 'child') {
      setSelectedStageId(task.id);
      return;
    }
    // parent：从 childTasks + outline 构建时间线，选中进行中或第一个实例化子任务
    const timeline = buildTimeline(childTasks, task.sub_task_outline);
    if (timeline.length === 0) return;
    const stage = timeline.find((i) => i.id > 0 && i.status !== 3) || timeline.find((i) => i.id > 0);
    if (stage?.id) setSelectedStageId(stage.id);
  }, [task, childTasks, selectedStageId]);

  // 选中阶段变化时，同步成果照片 state 为当前阶段任务的照片
  useEffect(() => {
    if (!task || !selectedStageId) return;
    const stageTask = childTasks.find((c) => c.id === selectedStageId);
    if (!stageTask || stageTask.id === task.id) return;
    setPhotos(parseTaskPhotos(stageTask.photo));
    setPhoto(stageTask.photo);
  }, [task, selectedStageId, childTasks]);

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
  const secondaryIds: number[] = (() => {
    if (!task.secondary_dimensions) return [];
    try { return JSON.parse(task.secondary_dimensions) as number[]; } catch { return []; }
  })();
  const secondaryDims = secondaryIds
    .map(id => abilities.find(a => a.id === id))
    .filter((d): d is AbilityDimension => !!d);

  // 统一标签
  const tags = getTaskTags(task);

  // ========== 主题任务（parent/child）统一派生状态 ==========
  const isThemeTask = task.task_kind === 'parent' || task.task_kind === 'child';
  const isChildTask = task.task_kind === 'child';
  const isParentTask = task.task_kind === 'parent';
  const themeParentTask: Task | null = isParentTask ? task : isChildTask ? parentTask : null;
  const themeTimeline: TimelineItem[] = themeParentTask
    ? buildTimeline(childTasks, themeParentTask.sub_task_outline)
    : [];
  const tCompletedCount = themeTimeline.filter((i) => i.status === 3).length;
  const tTotalCount = themeTimeline.length;
  const themeProgressPercent = tTotalCount > 0 ? Math.round((tCompletedCount / tTotalCount) * 100) : 0;
  const keyMilestoneStages = themeTimeline.filter((i) => i.is_key_milestone);
  const totalEstimatedDays = themeTimeline.reduce((s, i) => s + (i.estimated_days || 0), 0);

  // 当前进行中节点：第一个 status !== 3 且 id > 0（已实例化）的阶段；若没有则回退第一个 id > 0 的
  const currentStage =
    themeTimeline.find((i) => i.id > 0 && i.status !== 3) || themeTimeline.find((i) => i.id > 0) || null;

  const selectedStageTask: Task | null = selectedStageId
    ? childTasks.find((c) => c.id === selectedStageId) ?? null
    : null;

  // 对主题任务：当 selectedStageTask 切换时，更新成果照片/提交按钮绑定的数据（与详情页输入源一致）
  const activeTask: Task = isThemeTask && selectedStageTask ? selectedStageTask : task;
  const activePhotos = activeTask !== task ? parseTaskPhotos(activeTask.photo) : photos;

  // 兼容：让页面整体继续使用 photos/photo，而内部上传/提交走 activeTask
  const activeStatus = STATUS_MAP[activeTask.status] || STATUS_MAP[1];
  const activeTags = isThemeTask && selectedStageTask ? getTaskTags(selectedStageTask) : tags;

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
          ? await tasksService.submitTask(activeTask.id, undefined, photos)
          : await tasksService.submitTask(activeTask.id, photos[0] || '');
      if (activeTask.id === task.id) {
        // 非主题任务或详情页就是子任务本身
        setTask(updated);
      } else {
        // 主题任务选中阶段：更新 childTasks 中对应项
        setChildTasks((arr) => arr.map((c) => (c.id === activeTask.id ? updated : c)));
      }
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
      const updated = await tasksService.reviewTask(activeTask.id, true, points);
      if (activeTask.id === task.id) {
        setTask(updated);
      } else {
        setChildTasks((arr) => arr.map((c) => (c.id === activeTask.id ? updated : c)));
      }
      setShowReview(false);
      uiStore.setPreviousBalance(currentBalance);
      uiStore.setNeedRefreshScore(true);
      uiStore.setNeedRefreshTasks(true);
      uiStore.setPendingTaskStatus(3); // 回到任务看板「已完成」Tab
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
      const updated = await tasksService.reviewTask(activeTask.id, false);
      if (activeTask.id === task.id) {
        setTask(updated);
      } else {
        setChildTasks((arr) => arr.map((c) => (c.id === activeTask.id ? updated : c)));
      }
      setShowReview(false);
      uiStore.setNeedRefreshTasks(true);
      uiStore.setPendingTaskStatus(4); // 回到任务看板「已拒绝」Tab
      toast.success('已拒绝任务');
      setTimeout(() => {
        navigate('/home', { replace: true });
      }, 500);
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
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-3 pb-4 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${activeStatus.color} ${activeStatus.bg}`}>
              {isThemeTask
                ? selectedStageTask
                  ? activeStatus.label
                  : tCompletedCount > 0 && tCompletedCount === tTotalCount
                    ? '已完成'
                    : '进行中'
                : status.label}
            </div>
            <button
              onClick={handleDelete}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              <Trash2 size={18} className="text-white" />
            </button>
          </div>

          {isThemeTask && themeParentTask ? (
            <>
              {/* 主题任务：顶部展示父级主题内容（无积分） */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/20 text-white">
                  <ListTree size={10} /> 主题任务
                </span>
                {selectedStageTask && isChildTask ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/90">
                    当前阶段
                  </span>
                ) : null}
              </div>
              <h1 className="text-white font-semibold text-xl leading-snug">{themeParentTask.title}</h1>
              {themeParentTask.description && (
                <p className="text-white/80 text-sm mt-1.5 leading-relaxed line-clamp-3">
                  {themeParentTask.description}
                </p>
              )}

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

              {/* 元信息：阶段进度 · 当前阶段 · 指派 */}
              <div className="mt-3 flex items-center gap-3 text-xs text-white/85 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Target size={12} />
                  阶段进度 {tCompletedCount}/{tTotalCount}
                </span>
                {currentStage ? (
                  <>
                    <span className="text-white/50">·</span>
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp size={12} /> 当前：{currentStage.title}
                    </span>
                  </>
                ) : null}
                <span className="text-white/50">·</span>
                <span>指派 {childName}</span>
                {themeParentTask.deadline && (
                  <>
                    <span className="text-white/50">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />
                      {themeParentTask.deadline}
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 普通任务：默认样式 */}
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
            </>
          )}
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

                {/* 核心指标卡：连续 / 累计 / 目标（优先展示关键数字，不渲染 21 个空格子） */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-primary/5 p-3 text-center border border-primary/10">
                    <Flame size={16} className="text-primary mx-auto mb-1" />
                    <div className="text-xl font-bold text-primary leading-none">
                      {habitStats.streak_count}
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-1">连续 (天)</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-center border border-emerald-100">
                    <Calendar size={16} className="text-emerald-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-emerald-600 leading-none">
                      {habitStats.total_count}
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-1">累计 (天)</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 text-center border border-amber-100">
                    <Target size={16} className="text-amber-600 mx-auto mb-1" />
                    <div className="text-xl font-bold text-amber-600 leading-none">
                      {habitStats.habit_goal}
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-1">目标 (天)</div>
                  </div>
                </div>

                {/* 上次打卡 */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">上次打卡</span>
                  <span className="text-text-primary font-medium">
                    {habitStats.last_checkin_date || '暂无'}
                  </span>
                </div>
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

        {/* ==================== 主题任务：阶段时间线卡 + 选中阶段详情卡 ==================== */}
        {isThemeTask && themeParentTask && (
          <div className="bg-card rounded-2xl p-4 shadow-sm space-y-4">
            {/* 头部 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ListTree size={16} className="text-primary" />
                <h3 className="font-semibold text-text-primary">阶段进度</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {themeParentTask.category && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {THEME_CATEGORY_LABEL[themeParentTask.category] || themeParentTask.category}
                  </span>
                )}
                <span className="text-sm text-text-secondary">
                  共 {tTotalCount} 个阶段
                </span>
              </div>
            </div>

            {/* 整体进度条 */}
            {tTotalCount > 0 && (
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-secondary">整体进度</span>
                  <span className="font-medium text-text-primary">
                    已完成 {tCompletedCount}/{tTotalCount} · {tTotalCount > 0 ? Math.round((tCompletedCount / tTotalCount) * 100) : 0}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full transition-all"
                    style={{ width: `${tTotalCount > 0 ? (tCompletedCount / tTotalCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* 可点击切换的时间线 */}
            {themeTimeline.length > 0 && (
              <div className="relative" style={{ paddingLeft: 0 }} ref={timelineWrapRef}>
                {/* 连续竖线：对齐到 marker 列中心 (w-5=20px, 一半=10px)；
                    top/height 由 useEffect 根据首尾 marker 中心坐标计算，保证同轴线且不拖尾 */}
                <div
                  data-tl-line
                  className="absolute w-0.5 bg-gray-200 pointer-events-none"
                  style={{ left: 10 }}
                  aria-hidden
                />
                {themeTimeline.map((item, idx) => {
                  const isLast = idx === themeTimeline.length - 1;
                  const completed = item.status === 3;
                  const inProgress = item.id !== 0 && item.status !== 3;
                  const notStarted = item.id === 0;
                  const isSelected = selectedStageId === item.id;
                  return (
                    <div key={`timeline-${idx}`} className="relative">
                      <div className="flex gap-3">
                        {/* marker 列：固定 w-5（20px），竖线中心 x=10px，圆点在列内水平垂直居中到行首 */}
                        <div className="relative z-10 w-5 flex-shrink-0 flex items-start justify-center pt-[2px]">
                          <div
                            data-tl-marker
                            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              completed
                                ? 'bg-green-500'
                                : inProgress
                                  ? 'bg-orange-400 animate-pulse'
                                  : 'border-2 border-gray-300 bg-white'
                            } ${isSelected && item.id > 0 ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                          >
                            {completed && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                        </div>
                        {/* 右侧：可点击节点标题 */}
                        <div className={`flex-1 min-w-0 ${isLast && !isSelected ? 'pb-0' : 'pb-4'}`}>
                          <button
                            type="button"
                            disabled={item.id === 0}
                            onClick={() => item.id > 0 && setSelectedStageId(item.id)}
                            className={`w-full text-left rounded-xl -ml-2 -mt-1 p-2 transition-colors ${
                              item.id > 0
                                ? isSelected
                                  ? 'bg-primary/8 border border-primary/20'
                                  : 'hover:bg-warm-light'
                                : 'cursor-default'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-sm font-medium ${
                                  completed ? 'text-text-primary' : isSelected ? 'text-primary' : 'text-text-secondary'
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
                              {isSelected && item.id > 0 && !completed && (
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                  当前查看
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className={`text-xs mt-1 ${completed ? 'text-text-tertiary' : isSelected ? 'text-text-secondary' : 'text-text-tertiary/70 line-clamp-1'}`}>
                                {item.description}
                              </p>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* 选中节点：展开详情（积分 / 成果 / 提交 / 验收 / 任务信息） */}
                      {isSelected && selectedStageTask && item.id > 0 && item.id === selectedStageTask.id && (
                        <div className="ml-8 -mt-1 mb-4">
                          <div className="bg-warm-light rounded-xl p-3.5 space-y-3">
                            {/* 阶段积分 */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-text-secondary">阶段积分</span>
                              <span className="inline-flex items-center gap-1 text-primary font-bold">
                                <Star size={12} className="fill-primary" />
                                {selectedStageTask.points} 积分
                              </span>
                            </div>
                            {/* 阶段描述 */}
                            {selectedStageTask.description && (
                              <p className="text-xs text-text-secondary leading-relaxed bg-white rounded-lg p-2.5 border border-warm-light">
                                {selectedStageTask.description}
                              </p>
                            )}
                            {/* 成果照片 */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-text-secondary">成果照片 / 视频</span>
                                  <span className="text-[11px] text-text-tertiary">可选</span>
                                </div>
                              </div>
                              <MediaUploader
                                mediaUrls={photos}
                                onChange={(urls) => {
                                  setPhotos(urls);
                                  if (urls.length === 0) setPhoto(undefined);
                                  else if (urls.length === 1) setPhoto(urls[0]);
                                  else setPhoto(JSON.stringify(urls));
                                }}
                                onUploadingChange={setMediaUploading}
                                disabled={selectedStageTask.status === 2 || selectedStageTask.status === 3}
                                size="compact"
                                maxCount={9}
                                label="上传成果（可选）"
                              />
                              <p className="text-[11px] text-text-tertiary leading-relaxed">
                                {selectedStageTask.status === 1 || selectedStageTask.status === 4
                                  ? `可多选（最多 9 张）。支持图片与 60 秒内视频，不上传也可提交验收`
                                  : selectedStageTask.status === 3
                                    ? photos.length > 0
                                      ? `阶段已完成，共 ${photos.length} 件成果已存档 · 点击查看大图`
                                      : '阶段已完成（未附带成果媒体）'
                                    : photos.length > 0
                                      ? `已提交 ${photos.length} 件成果，等待家长验收 · 点击查看大图`
                                      : '已提交验收（未附带成果媒体）'}
                              </p>
                            </div>

                            {/* 提交 / 验收按钮 & 完成状态 */}
                            {(selectedStageTask.status === 1 || selectedStageTask.status === 4 || selectedStageTask.status === 2 || selectedStageTask.status === 3) && (
                              <div className="space-y-2 pt-1">
                                {(selectedStageTask.status === 1) && (
                                  <button
                                    onClick={handleSubmit}
                                    disabled={submitting || mediaUploading}
                                    className="w-full py-3.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors shadow-md shadow-primary/15 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {submitting ? (
                                      <><Loader2 size={16} className="animate-spin" />提交中...</>
                                    ) : mediaUploading ? (
                                      <><Loader2 size={16} className="animate-spin" />上传中，请稍候</>
                                    ) : photos.length === 0 ? (
                                      '提交验收（可不传图）'
                                    ) : (
                                      `提交验收（${photos.length} 张成果）`
                                    )}
                                  </button>
                                )}
                                {selectedStageTask.status === 4 && (
                                  <button
                                    onClick={handleSubmit}
                                    disabled={submitting || mediaUploading}
                                    className="w-full py-3.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors shadow-md shadow-primary/15 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {submitting ? (
                                      <><Loader2 size={16} className="animate-spin" />提交中...</>
                                    ) : mediaUploading ? (
                                      <><Loader2 size={16} className="animate-spin" />上传中，请稍候</>
                                    ) : photos.length === 0 ? (
                                      '重新提交验收（可不传图）'
                                    ) : (
                                      `重新提交验收（${photos.length} 张成果）`
                                    )}
                                  </button>
                                )}
                                {selectedStageTask.status === 2 && (
                                  <button
                                    onClick={() => setShowReview(true)}
                                    className="w-full py-3.5 bg-success text-white rounded-xl font-medium hover:bg-green-700 transition-colors shadow-md shadow-success/15"
                                  >
                                    验收 · 发放积分
                                  </button>
                                )}
                                {selectedStageTask.status === 3 && (
                                  <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
                                    <CheckCircle2 size={24} className="text-success mx-auto" />
                                    <div className="mt-1.5 text-success font-medium text-sm">阶段已完成</div>
                                    <div className="text-xs text-text-secondary mt-0.5">
                                      {selectedStageTask.points} 积分已发放给 {childName}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 阶段任务信息 */}
                            <div className="space-y-1.5 pt-2 border-t border-warm-light/70">
                              <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">阶段信息</div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-text-tertiary">状态</span>
                                <span className={`font-medium ${activeStatus.color}`}>{activeStatus.label}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-text-tertiary">指派给</span>
                                <span className="text-text-primary font-medium">{childName}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-text-tertiary">阶段积分</span>
                                <span className="text-primary font-bold">{selectedStageTask.points} 积分</span>
                              </div>
                              {selectedStageTask.created_at && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-text-tertiary">创建时间</span>
                                  <span className="text-text-secondary">{formatDateTime(selectedStageTask.created_at)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 关键里程碑专区 */}
            {keyMilestoneStages.length > 0 && (
              <div className="space-y-2 pt-1">
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

        {/* ==================== 非主题任务：成果照片 / 提交 / 验收 / 完成状态 ==================== */}
        {!isThemeTask && (
          <>
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
          </>
        )}

        {/* 非主题任务：任务信息底栏（主题任务信息已在选中阶段详情内显示） */}
        {!isThemeTask && (
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
        )}

        {/* 能力提升（主题任务时跟随主题父任务，否则跟随 task） */}
        {(() => {
          const abilityTask =
            isThemeTask && themeParentTask ? themeParentTask : task;
          if (!abilityTask.ability_dimension_id) return null;
          // 维度数组仍沿用当前 task 的 primaryDim / secondaryDims（避免重请求）
          if (!primaryDim && secondaryDims.length === 0) return null;
          return (
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
          );
        })()}

        <div className="h-8" />
      </div>

      {showReview && (
        <ReviewModal
          task={activeTask}
          onClose={() => setShowReview(false)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

export default TaskDetailPage;
