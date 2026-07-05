import { useState, useEffect, useRef } from 'react';
import { Plus, TrendingUp, Gift, Clock, CheckCircle, CheckCircle2, Inbox, FileText, XCircle, Minus, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { ChildTabs } from '../components/ChildTabs';
import { AnimatedNumberComponent as AnimatedNumber } from '../components/AnimatedNumber';
import * as tasksService from '../services/tasks';
import * as scoreService from '../services/score';
import type { Task, TaskStatus } from '../services/tasks';

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

function TaskItem({ task, onClick, showStatus, highlight }: { task: Task; onClick: () => void; showStatus?: boolean; highlight?: boolean }) {
  const statusInfo = STATUS_TABS.find((t) => t.id === task.status) || STATUS_TABS[0];
  const Icon = statusInfo.icon;

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
  highlightTaskId,
}: {
  tasks: Task[];
  activeStatus: 'all' | TaskStatus;
  onStatusChange: (s: 'all' | TaskStatus) => void;
  onTaskClick: (taskId: number) => void;
  onCreateTask: () => void;
  highlightTaskId?: number | null;
}) {
  const filteredTasks = activeStatus === 'all' ? tasks : tasks.filter((t) => t.status === activeStatus);
  const showStatus = activeStatus === 'all';

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
        {filteredTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task.id)}
            showStatus={showStatus}
            highlight={highlightTaskId === task.id}
          />
        ))}
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
  const children = childStore.children;

  const [selectedChildId, setSelectedChildId] = useState<number | null>(childStore.currentChildId);
  const [activeStatus, setActiveStatus] = useState<'all' | TaskStatus>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const hasPrevBalance = uiStore.previousBalance != null;
  const [balance, setBalance] = useState(hasPrevBalance ? uiStore.previousBalance! : 0);
  const [loading, setLoading] = useState(!hasPrevBalance);
  const [error, setError] = useState<string | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const taskBoardRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadData = async (showLoading = true) => {
    if (!selectedChildId) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const [tasksResult, balanceResult, statsResult] = await Promise.all([
        tasksService.getTasks({ childId: selectedChildId, page: 1, pageSize: 50 }),
        scoreService.getBalance(selectedChildId),
        scoreService.getMonthlyStats(selectedChildId),
      ]);
      setTasks(tasksResult.items);
      setBalance(balanceResult.balance);
      childStore.updateBalance(selectedChildId!, balanceResult.balance);
      setMonthlyStats(statsResult);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      if (showLoading) setLoading(false);
      loadingRef.current = false;
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
              去家庭管理
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-8 pb-8 px-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
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
