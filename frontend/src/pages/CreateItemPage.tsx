import { useState } from 'react';
import { ArrowLeft, Gift, Check, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as redeemService from '../services/redeem';

const CATEGORIES: { key: 0 | 1 | 2; label: string; desc: string }[] = [
  { key: 0, label: '物质奖励', desc: '玩具、文具、书籍等实物' },
  { key: 1, label: '体验奖励', desc: '电影、出游、游戏时间等' },
  { key: 2, label: '其他', desc: '特权、自定义奖励等' },
];

export function CreateItemPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(500);
  const [category, setCategory] = useState<0 | 1 | 2>(0);
  const [stock, setStock] = useState(10);
  const [isLimited, setIsLimited] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请填写商品名称');
      return;
    }
    if (points <= 0) {
      setError('积分必须大于0');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await redeemService.createItem({
        name: name.trim(),
        description: description.trim() || undefined,
        points,
        category,
        stock: isLimited ? stock : 999,
        image: imageUrl,
      });
      navigate('/mall');
    } catch (e: any) {
      setError(e.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg">创建新商品</h1>
            <div className="w-10 h-10" />
          </div>
          <p className="text-white/80 text-sm">设定一个能激励孩子努力完成任务的奖励。</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">
        <div className="bg-card rounded-2xl p-5 shadow-sm space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">商品图片（可选）</label>
            <button
              onClick={() => {
                const mockUrl = `https://picsum.photos/400/400?random=${Date.now()}`;
                setImageUrl(mockUrl);
              }}
              className={`w-full aspect-[4/3] rounded-2xl overflow-hidden ${imageUrl ? 'border-0' : 'bg-bg border-2 border-dashed border-gray-200 flex items-center justify-center'} hover:border-primary transition-colors`}
            >
              {imageUrl ? (
                <img src={imageUrl} alt="商品" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <Gift size={32} className="text-text-tertiary mx-auto" />
                  <span className="text-sm text-text-secondary mt-2 block">选择商品图片</span>
                </div>
              )}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">商品名称 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：精美文具套装"
              className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              maxLength={30}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">商品描述（可选）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="关于这个奖励的补充说明..."
              className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              所需积分 *
            </label>
            <div className="relative">
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-lg font-bold text-center"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">积分</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              奖励类型
            </label>
            <div className="space-y-2">
              {CATEGORIES.map((c) => {
                const active = c.key === category;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      active ? `bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md` : 'bg-bg text-text-secondary hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{c.label}</div>
                      <div className={`text-xs ${active ? 'text-white/80' : 'text-text-tertiary'}`}>{c.desc}</div>
                    </div>
                    {active && <Check size={18} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              库存设置
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => {
                  setIsLimited(false);
                }}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${!isLimited ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-gray-100'}`}
              >
                无限库存
              </button>
              <button
                onClick={() => setIsLimited(true)}
                className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${isLimited ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-gray-100'}`}
              >
                有限库存
              </button>
            </div>
            {isLimited && (
              <div className="relative">
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-base font-medium text-center"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary text-sm">件</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl p-3">{error}</div>
        )}

        <div className="sticky bottom-4 pt-2">
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || points <= 0 || submitting}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl font-semibold shadow-lg shadow-purple-500/20 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '发布商品'}
          </button>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

export default CreateItemPage;
