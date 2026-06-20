import { useState, useEffect } from 'react';
import { ArrowLeft, Star, User, CalendarDays, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import * as tasksService from '../services/tasks';

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
  onPick,
}: {
  onPick: (title: string, desc: string, points: number) => void;
}) {
  const templates = [
    { title: '整理房间', desc: '整理床铺、叠好衣物', points: 50 },
    { title: '洗碗', desc: '洗完饭后所有碗筷', points: 30 },
    { title: '阅读30分钟', desc: '阅读课外书籍30分钟', points: 60 },
    { title: '倒垃圾', desc: '把家里的垃圾倒到楼下', points: 15 },
    { title: '完成作业', desc: '认真完成当日作业', points: 80 },
    { title: '户外运动', desc: '户外活动1小时', points: 60 },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">
        <Sparkles size={14} className="inline mr-1 text-primary" /> 常见任务
      </label>
      <div className="grid grid-cols-2 gap-2">
        {templates.map((t, i) => (
          <button
            key={i}
            onClick={() => onPick(t.title, t.desc, t.points)}
            className="text-left bg-bg hover:bg-gray-100 rounded-xl p-3 transition-colors"
          >
            <div className="text-sm text-text-primary font-medium">{t.title}</div>
            <div className="text-xs text-text-tertiary mt-0.5">+{t.points} 积分</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CreateTaskPage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(50);
  const [childId, setChildId] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        await childStore.fetchChildren();
        const current = useChildStore.getState().getCurrentChild();
        if (current && mounted) {
          setChildId(current.id);
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
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请填写任务标题');
      return;
    }
    if (points <= 0) {
      setError('积分必须大于0');
      return;
    }
    if (!childId) {
      setError('请选择一个孩子');
      return;
    }
    setError('');
    try {
      await tasksService.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        points,
        childId,
        deadline,
        status: 1,
      });
      navigate('/tasks');
    } catch (e: any) {
      setError(e.message || '创建失败');
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

        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <TaskTemplates
            onPick={(t, d, p) => {
              setTitle(t);
              setDescription(d);
              setPoints(p);
            }}
          />
        </div>

        {error && (
          <div className="bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl p-3">{error}</div>
        )}

        <div className="sticky bottom-4 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || points <= 0 || !childId}
            className="w-full py-4 bg-primary text-white rounded-2xl font-semibold shadow-lg shadow-primary/20 hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发布任务
          </button>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

export default CreateTaskPage;
