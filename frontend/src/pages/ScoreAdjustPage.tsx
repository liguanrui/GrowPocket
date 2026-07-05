import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Plus, Minus, Upload, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import { useUIStore } from '../stores/uiStore';
import * as scoreService from '../services/score';

function AmountInput({ amount, onChange, mode }: { amount: number; onChange: (n: number) => void; mode: 'add' | 'deduct' }) {
  const presets = [10, 50, 100, 200];
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
              amount === p ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-bg text-text-secondary hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <div className="relative">
        <input
          type="number"
          value={amount || ''}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-lg font-bold text-center"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">积分</span>
      </div>
    </div>
  );
}

function RandomPhoto({ photo, onGenerate, onClear }: { photo: string | null; onGenerate: () => void; onClear: () => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-primary mb-2">图片（可选）</label>
      {photo ? (
        <div className="relative w-full h-40 rounded-xl overflow-hidden">
          <img src={photo} alt="" className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={onGenerate}
              className="w-7 h-7 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/60"
              title="换一张"
            >
              <Upload size={14} className="text-white" />
            </button>
            <button
              onClick={onClear}
              className="w-7 h-7 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/60"
              title="移除"
            >
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onGenerate}
          className="w-full h-40 bg-bg border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Upload size={28} className="text-text-tertiary" />
          <span className="text-sm text-text-secondary">点击生成随机图片</span>
        </button>
      )}
    </div>
  );
}

export function ScoreAdjustPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const childStore = useChildStore();
  const toast = useToastStore();
  const uiStore = useUIStore();
  const mode = (searchParams.get('mode') === 'deduct' ? 'deduct' : 'add') as 'add' | 'deduct';

  const [amount, setAmount] = useState(50);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [childId, setChildId] = useState<number | null>(null);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        await childStore.fetchChildren();
        const children = useChildStore.getState().children;
        const urlChildId = searchParams.get('child_id');
        const targetId = urlChildId ? Number(urlChildId) : useChildStore.getState().currentChildId;
        const validId = targetId && children.some((c) => c.id === targetId) ? targetId : children[0]?.id ?? null;
        if (mounted) setChildId(validId);

        if (validId) {
          const bal = await scoreService.getBalance(validId);
          if (mounted) setBalance(bal.balance);
        }
      } catch (e: any) {
        if (mounted) toast.error(e.message || '加载失败');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const generatePhoto = () => {
    setPhoto(`https://picsum.photos/400/300?random=${Date.now()}`);
  };

  const clearPhoto = () => setPhoto(null);

  const isAdd = mode === 'add';
  const insufficient = !isAdd && amount > balance;
  const canSubmit = amount > 0 && title.trim() !== '' && !insufficient && !submitting;

  const handleSubmit = async () => {
    if (!childId) {
      toast.error('未选择孩子');
      return;
    }
    if (!title.trim()) {
      toast.error('请填写标题');
      return;
    }
    if (amount <= 0) {
      toast.error('积分数量必须大于 0');
      return;
    }
    setSubmitting(true);
    try {
      const result = isAdd
        ? await scoreService.addPoints(childId, amount, title.trim(), description.trim() || undefined, photo || undefined)
        : await scoreService.deductPoints(childId, amount, title.trim(), description.trim() || undefined, photo || undefined);
      childStore.updateBalance(childId, result.balance);
      uiStore.triggerScoreAnimation(childId, amount, isAdd ? 'add' : 'deduct');
      uiStore.setNeedRefreshScore(true);
      uiStore.setNeedRefreshTasks(false);
      childStore.setCurrentChildId(childId);
      toast.success(isAdd ? `已奖励 ${amount} 积分` : `已扣除 ${amount} 积分`);
      navigate('/home', { replace: true });
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  const selectedChild = useChildStore.getState().children.find((c) => c.id === childId);
  const childName = selectedChild?.nickname || '孩子';

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className={`bg-gradient-to-br ${isAdd ? 'from-success to-green-700' : 'from-danger to-red-700'} pt-6 pb-8 px-4`}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg flex items-center gap-1.5">
              {isAdd ? <Plus size={18} /> : <Minus size={18} />}
              {isAdd ? '奖励积分' : '扣除积分'}
            </h1>
            <div className="w-10 h-10" />
          </div>
          <p className="text-white/80 text-sm">
            {childName} 当前余额 <span className="font-bold">{balance.toLocaleString()}</span> 积分
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        <div className="bg-card rounded-2xl p-5 shadow-sm space-y-4">
          <AmountInput amount={amount} onChange={setAmount} mode={mode} />

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">标题 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isAdd ? '例如：奖励表现好' : '例如：扣除未完成任务'}
              maxLength={30}
              className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">备注（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="输入备注说明"
              className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-sm resize-none"
            />
          </div>

          <RandomPhoto photo={photo} onGenerate={generatePhoto} onClear={clearPhoto} />

          {insufficient && (
            <div className="bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl p-3">
              ⚠️ 余额不足（当前余额 {balance} 积分）
            </div>
          )}
        </div>

        <div className="sticky bottom-4 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 text-white rounded-2xl font-semibold shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              isAdd ? 'bg-success hover:bg-green-700 shadow-success/20' : 'bg-danger hover:bg-red-700 shadow-danger/20'
            }`}
          >
            {submitting ? '处理中...' : isAdd ? `确认奖励 ${amount} 积分` : `确认扣除 ${amount} 积分`}
          </button>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

export default ScoreAdjustPage;
