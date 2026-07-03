import { useState, useEffect, useRef } from 'react';
import { Plus, TrendingUp, Gift, Clock, CheckCircle, ChevronLeft, ChevronRight, CheckCircle2, Inbox, FileText, XCircle, Minus, X, Send, ImagePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import * as tasksService from '../services/tasks';
import * as scoreService from '../services/score';
import type { Task, TaskStatus } from '../services/tasks';
import type { Child } from '../stores/childStore';

const STATUS_TABS: { id: 'all' | TaskStatus; label: string; icon: any; color: string }[] = [
  { id: 'all', label: '全部', icon: FileText, color: 'text-text-primary' },
  { id: 1, label: '进行中', icon: Clock, color: 'text-primary' },
  { id: 2, label: '待验收', icon: Inbox, color: 'text-yellow-600' },
  { id: 3, label: '已完成', icon: CheckCircle2, color: 'text-success' },
  { id: 4, label: '已拒绝', icon: XCircle, color: 'text-danger' },
];

function ChildTabs({
  children,
  selectedId,
  onSelect,
}: {
  children: Child[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -150 : 150,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="relative">
      {children.length > 4 && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children.map((child) => {
          const isActive = child.id === selectedId;
          return (
            <button
              key={child.id}
              onClick={() => onSelect(child.id)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white text-primary shadow-lg'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-primary/10 text-primary' : 'bg-white/20 text-white'
                }`}
              >
                {child.nickname.charAt(0)}
              </div>
              <span>{child.nickname}</span>
            </button>
          );
        })}
      </div>
      {children.length > 4 && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

function PointsCard({ balance, nickname, totalIncome, totalExpense, onAdd, onDeduct, onClick }: { balance: number; nickname: string; totalIncome: number; totalExpense: number; onAdd: () => void; onDeduct: () => void; onClick: () => void }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="text-center">
        <div className="text-text-tertiary text-sm">{nickname} 的积分余额</div>
        <div className="text-5xl font-bold text-primary mt-2 tracking-tight">
          {balance.toLocaleString()}
        </div>
        <div className="flex justify-center gap-4 mt-4">
          <div className="flex items-center gap-1 text-text-tertiary text-sm">
            <TrendingUp size={14} />
            <span>累计获得 {totalIncome}</span>
          </div>
          <div className="flex items-center gap-1 text-text-tertiary text-sm">
            <Minus size={14} />
            <span>累计消耗 {totalExpense}</span>
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

function ScoreAdjustModal({
  mode,
  onClose,
  onSubmit,
  balance,
}: {
  mode: 'add' | 'deduct';
  onClose: () => void;
  onSubmit: (title: string, amount: number, description?: string, photo?: string) => void;
  balance: number;
}) {
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    const numAmount = parseInt(amount, 10);
    if (!numAmount || numAmount <= 0) return;
    if (!title.trim()) return;
    onSubmit(title.trim(), numAmount, description.trim() || undefined, photo || undefined);
  };

  const canSubmit = amount && parseInt(amount, 10) > 0 && title.trim() && (mode === 'add' || parseInt(amount, 10) <= balance);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-24 animate-slide-up max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">
            {mode === 'add' ? '奖励积分' : '扣除积分'}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">金额 *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="输入积分数量"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">标题 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入操作名称"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">备注</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="输入备注（可选）"
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">图片</label>
            <div className="relative">
              {photo ? (
                <div className="relative w-full h-32 rounded-xl overflow-hidden">
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setPhoto(null)}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <ImagePlus size={24} className="text-gray-400" />
                  <span className="text-sm text-gray-500 mt-2">点击上传图片</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {mode === 'deduct' && balance < parseInt(amount, 10) && (
            <div className="bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl p-3">
              ⚠️ 当前余额不足（余额 {balance} 积分）
            </div>
          )}
        </div>

        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`w-full mt-6 py-3 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            mode === 'add' ? 'bg-success hover:bg-green-700' : 'bg-danger hover:bg-red-700'
          }`}
        >
          <Send size={18} />
          {mode === 'add' ? '确认奖励' : '确认扣除'}
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
    <div className="flex gap-2 overflow-x-auto bg-card rounded-2xl p-1 shadow-sm">
      {STATUS_TABS.map((tab) => {
        const Icon = tab.icon;
        const count = tab.id === 'all' ? tasks.length : tasks.filter((t) => t.status === tab.id).length;
        const isActive = active === tab.id;
        return (
          <button
            key={String(tab.id)}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap text-xs font-medium transition-all flex-1 justify-center ${
              isActive ? 'bg-primary text-white shadow' : 'text-text-secondary hover:bg-gray-50'
            }`}
          >
            <Icon size={14} />
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100 text-text-tertiary'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TaskItem({ task, onClick, showStatus }: { task: Task; onClick: () => void; showStatus?: boolean }) {
  const statusInfo = STATUS_TABS.find((t) => t.id === task.status) || STATUS_TABS[0];
  const Icon = statusInfo.icon;

  return (
    <div
      onClick={onClick}
      className="cursor-pointer bg-card rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-text-primary">{task.title}</div>
          {task.description && (
            <div className="text-sm text-text-tertiary mt-1 line-clamp-2">{task.description}</div>
          )}
          {task.deadline && (
            <div className="text-xs text-text-tertiary mt-2 flex items-center gap-1">
              <Clock size={12} />
              <span>截止：{new Date(task.deadline).toLocaleDateString()}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="text-primary font-bold text-lg">{task.points}</div>
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
    </div>
  );
}

function TaskBoard({
  tasks,
  activeStatus,
  onStatusChange,
  onTaskClick,
  onCreateTask,
}: {
  tasks: Task[];
  activeStatus: 'all' | TaskStatus;
  onStatusChange: (s: 'all' | TaskStatus) => void;
  onTaskClick: (taskId: number) => void;
  onCreateTask: () => void;
}) {
  const filteredTasks = activeStatus === 'all' ? tasks : tasks.filter((t) => t.status === activeStatus);
  const showStatus = activeStatus === 'all';

  if (filteredTasks.length === 0) {
    return (
      <div>
        <StatusTabs active={activeStatus} onChange={onStatusChange} tasks={tasks} />
        <div className="text-center py-12 bg-card rounded-2xl shadow-sm mt-3">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-3xl">📋</span>
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
        {filteredTasks.map((task) => (
          <TaskItem key={task.id} task={task} onClick={() => onTaskClick(task.id)} showStatus={showStatus} />
        ))}
      </div>
    </div>
  );
}

import type { MonthlyStats } from '../services/score';

export function HomePage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const children = childStore.children;

  const [selectedChildId, setSelectedChildId] = useState<number | null>(childStore.currentChildId);
  const [activeStatus, setActiveStatus] = useState<'all' | TaskStatus>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreModalMode, setScoreModalMode] = useState<'add' | 'deduct' | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);

  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (!selectedChildId) return;
      setLoading(true);
      setError(null);
      try {
        const [tasksResult, balanceResult, statsResult] = await Promise.all([
          tasksService.getTasks({ childId: selectedChildId, page: 1, pageSize: 50 }),
          scoreService.getBalance(selectedChildId),
          scoreService.getMonthlyStats(selectedChildId),
        ]);
        if (mounted) {
          setTasks(tasksResult.items);
          setBalance(balanceResult.balance);
          setMonthlyStats(statsResult);
        }
      } catch (e: any) {
        if (mounted) setError(e.message || '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (children.length === 0) {
      childStore.fetchChildren().finally(() => {
        if (mounted) loadData();
      });
    } else {
      loadData();
    }

    return () => {
      mounted = false;
    };
  }, [selectedChildId]);

  const totalIncome = monthlyStats.reduce((sum, s) => sum + s.income, 0);
  const totalExpense = monthlyStats.reduce((sum, s) => sum + s.expense, 0);

  const selectedChild = children.find((c) => c.id === selectedChildId) || null;

  const handleChildSelect = (id: number) => {
    setSelectedChildId(id);
    childStore.setCurrentChildId(id);
    setActiveStatus('all');
  };

  const handleScoreAdjust = async (title: string, amount: number, description?: string, photo?: string) => {
    if (!selectedChildId) return;
    try {
      const result = await (scoreModalMode === 'add'
        ? scoreService.addPoints(selectedChildId, amount, title, description, photo)
        : scoreService.deductPoints(selectedChildId, amount, title, description, photo));
      setBalance(result.balance);
      childStore.updateBalance(selectedChildId, result.balance);
      setScoreModalMode(null);
    } catch (e: any) {
      alert(e.message || '操作失败');
    }
  };

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
        <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-8 px-4">
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
              添加孩子
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">任务看板</h1>
              <p className="text-white/80 text-sm mt-0.5">今日共 {tasks.length} 个任务</p>
            </div>
            <button
              onClick={() => navigate(`/tasks/new?child_id=${selectedChildId}`)}
              className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
            >
              <Plus size={16} /> 新建
            </button>
          </div>

          <ChildTabs children={children} selectedId={selectedChild.id} onSelect={handleChildSelect} />

          <div className="mt-4">
            <PointsCard
              balance={balance}
              nickname={selectedChild.nickname}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              onAdd={() => setScoreModalMode('add')}
              onDeduct={() => setScoreModalMode('deduct')}
              onClick={() => navigate(`/score?child_id=${selectedChildId}`)}
            />
          </div>
        </div>
      </div>

      {scoreModalMode && (
        <ScoreAdjustModal
          mode={scoreModalMode}
          onClose={() => setScoreModalMode(null)}
          onSubmit={handleScoreAdjust}
          balance={balance}
        />
      )}

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        <TaskBoard
          tasks={tasks}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          onTaskClick={(id) => navigate(`/task/${id}`)}
          onCreateTask={() => navigate(`/tasks/new?child_id=${selectedChildId}`)}
        />

        <div className="h-4" />
      </div>

      <button
        onClick={() => navigate(`/tasks/new?child_id=${selectedChildId}`)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-40"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}

export default HomePage;
