import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, Plus, Minus, Star, ImagePlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import * as scoreService from '../services/score';
import type { Transaction } from '../services/score';

function TrendChart({ points, maxDays = 7 }: { points: { date: string; balance: number }[]; maxDays?: number }) {
  const data = points.slice(-maxDays);
  const width = 600;
  const height = 160;
  const padding = 16;

  if (data.length === 0) {
    return <div className="text-sm text-text-tertiary text-center py-8">暂无数据</div>;
  }

  const values = data.map((d) => d.balance);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  const stepX = (width - padding * 2) / Math.max(1, data.length - 1);
  const pointsOnChart = data.map((d, i) => {
    const x = padding + stepX * i;
    const y = height - padding - ((d.balance - minVal) / range) * (height - padding * 2);
    return { x, y, d };
  });

  const pathD = pointsOnChart
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaD =
    pathD +
    ` L ${pointsOnChart[pointsOnChart.length - 1].x} ${height - padding} L ${pointsOnChart[0].x} ${height - padding} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <linearGradient id="balance-gradient-score" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#FF9500" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF9500" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#balance-gradient-score)" />
        <path d={pathD} fill="none" stroke="#FF9500" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pointsOnChart.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#FF9500" stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between mt-2 text-xs text-text-tertiary px-1">
        {data.map((d, i) => {
          const month = d.date.slice(5, 7);
          const day = d.date.slice(8, 10);
          return (
            <span key={i}>{month}/{day}</span>
          );
        })}
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.type === 0;
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${isIncome ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}
        >
          {isIncome ? <Plus size={18} /> : <Minus size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-text-primary truncate">{tx.reason}</div>
          <div className="text-xs text-text-tertiary mt-0.5">{tx.created_at}</div>
        </div>
      </div>
      <div className={`text-base font-bold flex-shrink-0 ml-2 ${isIncome ? 'text-success' : 'text-danger'}`}>
        {isIncome ? `+${tx.amount}` : `-${tx.amount}`}
      </div>
    </div>
  );
}

function AdjustScoreModal({
  child,
  mode,
  onClose,
  onSubmit,
}: {
  child: { id: number; nickname: string; balance: number };
  mode: 'add' | 'deduct';
  onClose: () => void;
  onSubmit: (title: string, amount: number, description?: string, photo?: string) => void;
}) {
  const [amount, setAmount] = useState<number>(50);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const presets = mode === 'add' ? [50, 100, 200] : [30, 50, 100];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-text-primary text-lg">
            {mode === 'add' ? '加积分（创建奖励任务）' : '减积分（创建惩罚任务）'}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-bg rounded-xl p-3 text-sm">
            当前孩子：<span className="font-bold text-text-primary">{child.nickname}</span> ·
            当前余额：<span className="font-bold text-primary">{child.balance}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              标题 <span className="text-danger">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：期中考试进步奖"
              className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              积分数量 <span className="text-danger">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${amount === p ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-gray-100'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-lg font-bold text-center"
                placeholder="输入积分数量"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">积分</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">补充说明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="补充说明（可选）"
              className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-sm resize-none"
            />
          </div>

          {photo && (
            <div className="flex items-center justify-between p-3 bg-bg rounded-xl border border-gray-100">
              <span className="text-sm text-text-secondary flex items-center gap-2">
                <ImagePlus size={16} className="text-primary" />
                已上传照片（模拟）
              </span>
              <button onClick={() => setPhoto(undefined)} className="text-sm text-danger">移除</button>
            </div>
          )}

          {mode === 'deduct' && amount > child.balance && (
            <div className="bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl p-3">⚠️ 当前余额不足（余额 {child.balance} 积分）</div>
          )}
        </div>

        <div className="p-5 bg-gray-50 border-t border-gray-100">
          <button
            disabled={!amount || amount <= 0 || (mode === 'deduct' && amount > child.balance) || !title.trim()}
            onClick={() => onSubmit(title.trim(), amount, description.trim() || undefined, photo)}
            className={`w-full py-3 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'add' ? 'bg-success hover:bg-green-700' : 'bg-danger hover:bg-red-700'}`}
          >
            创建为已完成的{mode === 'add' ? '奖励' : '惩罚'}任务
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScorePage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'deduct' | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

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
        const [historyResult, balanceResult] = await Promise.all([
          scoreService.getHistory(child.id),
          scoreService.getBalance(child.id),
        ]);
        if (mounted) {
          setTransactions(historyResult.items);
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

  const currentChild = useChildStore.getState().getCurrentChild();

  const handleAdjust = async (title: string, amount: number, description?: string, photo?: string) => {
    if (!currentChild) return;
    try {
      const result = await (modalMode === 'add'
        ? scoreService.addPoints(currentChild.id, amount, title, description, photo)
        : scoreService.deductPoints(currentChild.id, amount, title, description, photo));
    setBalance(result.balance);
    childStore.updateBalance(currentChild.id, result.balance);
    const historyResult = await scoreService.getHistory(currentChild.id);
    setTransactions(historyResult.items);
    setModalMode(null);
    } catch (e: any) {
      setError(e.message || '操作失败');
    }
  };

  const filteredTxs = useMemo(
    () =>
      transactions.filter((t) => (filter === 'all' ? true : filter === 'income' ? t.type === 0 : t.type === 1)),
    [transactions, filter]
  );

  const totalIncome = transactions.filter((t) => t.type === 0).reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === 1).reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  if (error && error && !currentChild) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-danger font-medium">{error}</div>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl">重试</button>
        </div>
      </div>
    );
  }

  if (!currentChild) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-text-primary font-medium">暂无孩子档案</div>
          <button onClick={() => navigate('/family')} className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl">添加孩子</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-success to-green-700 pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg">积分账户</h1>
            <div className="w-10 h-10" />
          </div>

          <div className="text-center">
            <div className="text-white/80 text-sm">{currentChild.nickname} 的积分余额</div>
            <div className="text-white text-5xl font-bold tracking-tight mt-2">{balance}</div>
            <div className="flex items-center justify-center gap-4 mt-4 text-white text-sm">
              <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full"><TrendingUp size={14} /><span>累计获得 {totalIncome}</span></div>
              <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full"><Minus size={14} /><span>累计消耗 {totalExpense}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setModalMode('add')} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center"><Plus size={20} /></div>
            <div className="text-left">
              <div className="font-medium text-text-primary text-sm">加积分</div>
              <div className="text-xs text-text-tertiary mt-0.5">创建奖励任务</div>
            </div>
          </button>
          <button onClick={() => setModalMode('deduct')} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
            <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center"><Minus size={20} /></div>
            <div className="text-left">
              <div className="font-medium text-text-primary text-sm">减积分</div>
              <div className="text-xs text-text-tertiary mt-0.5">创建惩罚任务</div>
            </div>
          </button>
        </div>

        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-1.5"><TrendingUp size={18} className="text-primary" /> 积分趋势</h3>
          </div>
          <TrendChart points={transactions.map((t) => ({ date: t.created_at, balance: t.balanceAfter }))} />
        </div>

        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text-primary">积分明细</h3>
            <div className="flex gap-1.5 text-xs">
              {([['all', '全部'], ['income', '收入'], ['expense', '支出']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1 rounded-full transition-colors ${filter === key ? 'bg-primary/10 text-primary font-medium' : 'text-text-tertiary hover:bg-bg'}`}>{label}</button>
              ))}
            </div>
          </div>

          {filteredTxs.length === 0 ? (
            <div className="py-10 text-center text-text-tertiary text-sm">暂无积分变动记录</div>
          ) : (
            <div>{filteredTxs.map((tx) => (<TransactionRow key={tx.id} tx={tx} />))}</div>
          )}
        </div>

        <div className="h-8" />
      </div>

      {modalMode && <AdjustScoreModal child={{ id: currentChild.id, nickname: currentChild.nickname, balance }} mode={modalMode} onClose={() => setModalMode(null)} onSubmit={handleAdjust} />}
    </div>
  );
}

export default ScorePage;
