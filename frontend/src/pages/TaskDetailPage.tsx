import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Calendar, CheckCircle2, XCircle, Trash2, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import * as tasksService from '../services/tasks';
import * as scoreService from '../services/score';
import { getAbilities } from '../services/ability';
import { MediaUploader } from '../components/MediaUploader';
import type { Task } from '../services/tasks';
import type { AbilityDimension } from '../services/ability';

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
  const [currentBalance, setCurrentBalance] = useState(0);
  const [abilities, setAbilities] = useState<AbilityDimension[]>([]);

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

  const handleSubmit = async () => {
    try {
      const updated = await tasksService.submitTask(task.id, photo || '');
      setTask(updated);
      toast.success('任务已提交验收');
    } catch (e: any) {
      toast.error(e.message || '提交失败');
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
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${status.color} ${status.bg}`}>
              {status.label}
            </div>
            <button
              onClick={handleDelete}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              <Trash2 size={18} className="text-white" />
            </button>
          </div>
          <h1 className="text-white font-semibold text-xl">{task.title}</h1>
          {task.description && <p className="text-white/80 text-sm mt-2 leading-relaxed">{task.description}</p>}

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-white/15 rounded-xl p-3">
              <div className="text-white/70 text-xs">任务积分</div>
              <div className="text-white text-xl font-bold mt-0.5">{task.points}</div>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <div className="text-white/70 text-xs">指派</div>
              <div className="text-white font-medium mt-0.5">{childName}</div>
            </div>
          </div>

          {task.deadline && (
            <div className="mt-3 flex items-center gap-2 text-white/80 text-sm">
              <Calendar size={14} />
              <span>截止时间：{task.deadline}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text-primary">成果照片 / 视频</h3>
            <span className="text-xs text-text-tertiary">可选</span>
          </div>
          <MediaUploader
            mediaUrl={photo}
            onUpload={(url) => setPhoto(url)}
            onClear={() => setPhoto(undefined)}
            disabled={task.status === 2 || task.status === 3}
          />
          <p className="mt-3 text-sm text-text-tertiary">
            {task.status === 1 || task.status === 4
              ? '可从相册选择或直接拍摄；支持图片与 60 秒内视频，不上传也可提交验收'
              : task.status === 3
                ? photo
                  ? '任务已完成，成果已存档'
                  : '任务已完成（未附带成果媒体）'
                : photo
                  ? '已提交成果，等待家长验收'
                  : '已提交验收（未附带成果媒体）'}
          </p>
        </div>

        {task.status === 1 && (
          <button
            onClick={handleSubmit}
            className="w-full py-4 bg-primary text-white rounded-2xl font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
          >
            提交验收
          </button>
        )}
        {task.status === 4 && (
          <button
            onClick={handleSubmit}
            className="w-full py-4 bg-primary text-white rounded-2xl font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
          >
            重新提交验收
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

        <div className="bg-card rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-text-primary">任务信息</h3>

          <div className="flex items-start justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-text-tertiary">状态</span>
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
          </div>
          <div className="flex items-start justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-text-tertiary">指派给</span>
            <span className="text-sm text-text-primary font-medium">{childName}</span>
          </div>
          <div className="flex items-start justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-text-tertiary">原任务积分</span>
            <span className="text-sm text-primary font-bold">{task.points} 积分</span>
          </div>
          <div className="flex items-start justify-between py-2">
            <span className="text-sm text-text-tertiary">创建时间</span>
            <span className="text-sm text-text-secondary">{formatDateTime(task.created_at)}</span>
          </div>
        </div>

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
