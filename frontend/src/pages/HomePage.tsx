import { useState, useEffect } from 'react';
import { Plus, TrendingUp, Gift, Calendar, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import * as tasksService from '../services/tasks';
import * as scoreService from '../services/score';
import type { Task } from '../services/tasks';

function PointsCard({ balance, nickname }: { balance: number; nickname: string }) {
  return (
    <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-5 shadow-lg shadow-primary/20">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white/70 text-sm">{nickname} 的积分</div>
          <div className="text-4xl font-bold text-white mt-1 tracking-tight">
            {balance.toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-2 text-white/80 text-sm">
            <TrendingUp size={14} />
            <span>本周 +150</span>
          </div>
        </div>
        <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center overflow-hidden">
          <span className="text-xl font-bold text-white">{nickname.slice(0, 1)}</span>
        </div>
      </div>
    </div>
  );
}

function QuickActions({ onCreateTask, onCreateItem, onAdjustScore }: {
  onCreateTask: () => void;
  onCreateItem: () => void;
  onAdjustScore: () => void;
}) {
  const actions = [
    { icon: Plus, label: '发布任务', onClick: onCreateTask, bg: 'bg-primary' },
    { icon: Gift, label: '创建商品', onClick: onCreateItem, bg: 'bg-purple' },
    { icon: TrendingUp, label: '积分调整', onClick: onAdjustScore, bg: 'bg-success' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((a, idx) => {
        const Icon = a.icon;
        return (
          <button
            key={idx}
            onClick={a.onClick}
            className={`${a.bg} text-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-all active:scale-95 flex flex-col items-center gap-2`}
          >
            <Icon size={22} />
            <span className="text-sm font-medium">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function StatsSummary({ inProgressCount, submittedCount, completedCount }: {
  inProgressCount: number;
  submittedCount: number;
  completedCount: number;
}) {
  const stats = [
    { label: '进行中', value: inProgressCount, icon: Clock, color: 'text-primary' },
    { label: '待验收', value: submittedCount, icon: CheckCircle, color: 'text-yellow-600' },
    { label: '已完成', value: completedCount, icon: Calendar, color: 'text-success' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s, idx) => {
        const Icon = s.icon;
        return (
          <div key={idx} className="bg-card rounded-2xl p-4 shadow-sm text-center">
            <div className={`w-10 h-10 mx-auto rounded-xl bg-${s.color === 'text-primary' ? 'primary' : s.color === 'text-yellow-600' ? 'yellow' : 'success'}/10 flex items-center justify-center ${s.color}`}>
              <Icon size={18} />
            </div>
            <div className="text-2xl font-bold text-text-primary mt-2">{s.value}</div>
            <div className="text-xs text-text-tertiary mt-1">{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ title, rightText, onRightClick }: { title: string; rightText?: string; onRightClick?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-text-primary font-semibold">{title}</h3>
      {rightText && (
        <button onClick={onRightClick} className="text-sm text-primary flex items-center gap-0.5 hover:opacity-80">
          {rightText}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const currentChild = childStore.getCurrentChild();

  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [submittedTasks, setSubmittedTasks] = useState<Task[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        await childStore.fetchChildren();
        const child = useChildStore.getState().getCurrentChild();
        if (!child) {
          if (mounted) setLoading(false);
          return;
        }

        const [tasksResult, balanceResult] = await Promise.all([
          tasksService.getTasks({ childId: child.id, page: 1, pageSize: 5 }),
          scoreService.getBalance(child.id),
        ]);

        if (mounted) {
          setRecentTasks(tasksResult.items.filter((t) => t.status === 1 || t.status === 3).slice(0, 3));
          setSubmittedTasks(tasksResult.items.filter((t) => t.status === 2));
          setBalance(balanceResult.balance);
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

  if (!currentChild) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-text-primary font-medium">暂无孩子档案</div>
          <p className="text-sm text-text-tertiary mt-2">请先在家庭管理中添加孩子</p>
          <button
            onClick={() => navigate('/family')}
            className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            添加孩子
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-white/70 text-sm">下午好，爸爸 ☀️</div>
              <div className="text-white font-semibold text-lg">{currentChild.nickname} 的成长今天继续</div>
            </div>
            <div className="relative">
              <button
                onClick={() => navigate('/tasks/new')}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <Plus size={20} className="text-white" />
              </button>
            </div>
          </div>

          <div onClick={() => navigate('/score')} className="cursor-pointer">
            <PointsCard balance={balance} nickname={currentChild.nickname} />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-5">
        <QuickActions
          onCreateTask={() => navigate('/tasks/new')}
          onCreateItem={() => navigate('/mall/new')}
          onAdjustScore={() => navigate('/score')}
        />

        <StatsSummary
          inProgressCount={recentTasks.filter((t) => t.status === 1).length}
          submittedCount={submittedTasks.length}
          completedCount={recentTasks.filter((t) => t.status === 3).length}
        />

        {submittedTasks.length > 0 && (
          <div>
            <SectionHeader title={`待验收任务（${submittedTasks.length}）`} rightText="查看全部" onRightClick={() => navigate('/tasks')} />
            <div className="space-y-3">
              {submittedTasks.slice(0, 3).map((task) => (
                <div key={task.id} onClick={() => navigate(`/task/${task.id}`)} className="cursor-pointer bg-card rounded-2xl p-4 shadow-sm">
                  <div className="font-medium text-text-primary">{task.title}</div>
                  <div className="text-sm text-text-tertiary mt-1">{task.points} 积分</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentTasks.length > 0 && (
          <div>
            <SectionHeader title={`进行中（${recentTasks.filter((t) => t.status === 1).length}）`} rightText="查看全部" onRightClick={() => navigate('/tasks')} />
            <div className="space-y-3">
              {recentTasks.filter((t) => t.status === 1).slice(0, 3).map((task) => (
                <div key={task.id} onClick={() => navigate(`/task/${task.id}`)} className="cursor-pointer bg-card rounded-2xl p-4 shadow-sm">
                  <div className="font-medium text-text-primary">{task.title}</div>
                  <div className="text-sm text-text-tertiary mt-1">{task.points} 积分</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionHeader title="可兑换的奖励" rightText="去商城" onRightClick={() => navigate('/mall')} />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl overflow-hidden shadow-sm">
                <div className="aspect-square bg-gray-50 flex items-center justify-center">
                  <Gift size={24} className="text-text-tertiary" />
                </div>
                <div className="p-2">
                  <div className="text-xs text-text-primary font-medium line-clamp-1">商品 {i}</div>
                  <div className="text-primary text-xs font-bold mt-1">{i * 100} 分</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

export default HomePage;
