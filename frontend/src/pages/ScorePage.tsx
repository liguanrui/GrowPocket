import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, Plus, Minus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { ChildTabs } from '../components/ChildTabs';
import * as scoreService from '../services/score';
import type { Transaction, TrendPoint } from '../services/score';

type RangeType = '7d' | '30d' | 'month';

const RANGE_OPTIONS: { id: RangeType; label: string }[] = [
  { id: '7d', label: '近7天' },
  { id: '30d', label: '近30天' },
  { id: 'month', label: '本月' },
];

function getRange(rangeType: RangeType): { start: string; end: string } {
  const now = new Date();
  const endMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = new Date(endMs).toISOString().slice(0, 10);
  let startMs: number;
  if (rangeType === '7d') {
    startMs = endMs - 6 * 86400000;
  } else if (rangeType === '30d') {
    startMs = endMs - 29 * 86400000;
  } else {
    startMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  }
  const start = new Date(startMs).toISOString().slice(0, 10);
  return { start, end };
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const data = points;
  const width = 600;
  const height = 180;
  const padding = 16;

  if (data.length === 0) {
    return <div className="text-sm text-text-tertiary text-center py-8">暂无数据</div>;
  }

  const allValues = data.flatMap((d) => [d.income, d.expense]);
  const maxVal = Math.max(...allValues, 0);
  const range = maxVal || 1;
  const stepX = (width - padding * 2) / Math.max(1, data.length - 1);
  const toY = (v: number) => height - padding - (v / range) * (height - padding * 2);

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const incomePts = data.map((d, i) => ({ x: padding + stepX * i, y: toY(d.income) }));
  const expensePts = data.map((d, i) => ({ x: padding + stepX * i, y: toY(d.expense) }));
  const incomePath = toPath(incomePts);
  const expensePath = toPath(expensePts);

  // x 轴标签：均匀展示约 6 个
  const labelStep = Math.max(1, Math.ceil(data.length / 6));
  const labels = data.filter((_, i) => i % labelStep === 0 || i === data.length - 1);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <path d={incomePath} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={expensePath} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {incomePts.map((p, i) => (
          <circle key={`i${i}`} cx={p.x} cy={p.y} r="3" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
        ))}
        {expensePts.map((p, i) => (
          <circle key={`e${i}`} cx={p.x} cy={p.y} r="3" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="flex justify-between mt-2 text-xs text-text-tertiary px-1">
        {labels.map((d, i) => {
          const month = d.date.slice(5, 7);
          const day = d.date.slice(8, 10);
          return <span key={i}>{month}/{day}</span>;
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

export function ScorePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const childStore = useChildStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [rangeType, setRangeType] = useState<RangeType>('7d');

  const children = childStore.children;
  const childrenLength = children.length;
  const [selectedChildId, setSelectedChildId] = useState<number | null>(() => {
    const id = searchParams.get('child_id');
    return id ? Number(id) : (childStore.currentChildId || (children[0]?.id ?? null));
  });

  const selectedChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  useEffect(() => {
    if (childrenLength === 0) {
      childStore.fetchChildren();
    }
  }, []);

  useEffect(() => {
    if (childrenLength > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [childrenLength, selectedChildId]);

  useEffect(() => {
    if (selectedChildId) {
      setSearchParams({ child_id: String(selectedChildId) }, { replace: true });
    }
  }, [selectedChildId, setSearchParams]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      if (!selectedChildId) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { start, end } = getRange(rangeType);
        const [historyResult, trendResult] = await Promise.all([
          scoreService.getHistory(selectedChildId, 1, 50, start, end),
          scoreService.getTrend(selectedChildId, start, end),
        ]);
        if (mounted) {
          setTransactions(historyResult.items);
          setTrendData(trendResult);
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
  }, [selectedChildId, rangeType]);

  const handleChildSelect = (id: number) => {
    setSelectedChildId(id);
    childStore.setCurrentChildId(id);
  };

  const filteredTxs = useMemo(
    () =>
      transactions.filter((t) => (filter === 'all' ? true : filter === 'income' ? t.type === 0 : t.type === 1)),
    [transactions, filter]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  if (error && !selectedChild) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-danger font-medium">{error}</div>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl">重试</button>
        </div>
      </div>
    );
  }

  if (!selectedChild || children.length === 0) {
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
      <div className="bg-gradient-to-br from-success to-green-700 pt-8 pb-8 px-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg">积分明细</h1>
            <div className="w-10 h-10" />
          </div>

          <ChildTabs children={children} selectedId={selectedChild.id} onSelect={handleChildSelect} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        <div className="bg-card rounded-2xl p-1.5 shadow-sm flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setRangeType(opt.id)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                rangeType === opt.id ? 'bg-primary text-white shadow' : 'text-text-secondary hover:bg-bg'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-1.5"><TrendingUp size={18} className="text-primary" /> 积分趋势</h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-success"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />获取</span>
              <span className="flex items-center gap-1 text-danger"><span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" />消耗</span>
            </div>
          </div>
          <TrendChart points={trendData} />
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
    </div>
  );
}

export default ScorePage;
