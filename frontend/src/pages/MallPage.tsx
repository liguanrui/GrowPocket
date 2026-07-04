import { useState, useEffect, useRef } from 'react';
import { Plus, Gift, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import type { Child } from '../stores/childStore';
import * as redeemService from '../services/redeem';
import type { RedeemItem } from '../services/redeem';

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
      scrollRef.current.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
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
                isActive ? 'bg-white text-primary shadow-lg' : 'bg-white/15 text-white hover:bg-white/25'
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

function ItemCard({ item, child, onExchange }: { item: RedeemItem; child: { nickname: string; balance: number; id: number }; onExchange: () => void }) {
  const enough = child.balance >= item.points;
  const soldOut = item.stock === 0;
  const canExchange = enough && !soldOut;

  return (
    <div className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
        {item.image ? (
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-warm-light text-primary/30">
            <Gift size={48} />
          </div>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium">
            已兑换完
          </div>
        )}
        {!enough && !soldOut && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
            积分不足
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="text-sm font-semibold text-text-primary line-clamp-1">{item.name}</div>
        {item.description && (
          <div className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{item.description}</div>
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1 text-primary">
            <span className="font-bold text-base bg-gradient-to-r from-primary to-warm-light bg-clip-text text-transparent">{item.points}</span>
            <span className="text-xs text-text-tertiary">积分</span>
          </div>
          {item.stock >= 0 && (
            <div className="text-xs text-text-tertiary flex items-center gap-1">
              剩 {item.stock}
            </div>
          )}
        </div>
        <button
          onClick={onExchange}
          disabled={!canExchange}
          className={`w-full mt-3 py-2 rounded-xl text-xs font-medium transition-colors ${
            canExchange
              ? 'bg-primary text-white hover:bg-primary-dark active:scale-[0.97] transition-all'
              : 'bg-gray-100 text-text-tertiary cursor-not-allowed'
          }`}
        >
          {soldOut ? '已兑换完' : enough ? '立即兑换' : `还差 ${item.points - child.balance}`}
        </button>
      </div>
    </div>
  );
}

function ExchangeModal({
  item,
  child,
  onClose,
  onConfirm,
}: {
  item: RedeemItem;
  child: { id: number; nickname: string; balance: number };
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
        <div className="aspect-[16/9] bg-gray-100 relative overflow-hidden">
          {item.image && (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-2 text-text-tertiary text-sm">
            为 <span className="font-bold text-text-primary">{child.nickname}</span> 兑换
          </div>
          <h3 className="text-xl font-bold text-text-primary">{item.name}</h3>
          {item.description && (
            <p className="text-text-secondary text-sm mt-2">{item.description}</p>
          )}

          <div className="bg-bg rounded-xl p-4 mt-4 text-left">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-text-secondary">当前积分</span>
              <span className="font-bold text-success">{child.balance}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">本次消耗</span>
              <span className="font-bold text-lg text-danger">-{item.points}</span>
            </div>
            <div className="border-t border-gray-200 my-3" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">兑换后剩余</span>
              <span className="font-bold text-primary text-lg">{child.balance - item.points}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 pt-0">
          <button
            onClick={onClose}
            className="py-3 bg-bg text-text-secondary rounded-xl font-medium hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={child.balance < item.points}
            className="py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            确认兑换
          </button>
        </div>
      </div>
    </div>
  );
}

export function MallPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const childStore = useChildStore();
  const [items, setItems] = useState<RedeemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exchangingItem, setExchangingItem] = useState<RedeemItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');

  const children = childStore.children;
  const [selectedChildId, setSelectedChildId] = useState<number | null>(() => {
    const id = searchParams.get('child_id');
    return id ? Number(id) : (childStore.currentChildId || (children[0]?.id ?? null));
  });

  const selectedChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  useEffect(() => {
    if (selectedChildId) {
      setSearchParams({ child_id: String(selectedChildId) }, { replace: true });
    }
  }, [selectedChildId, setSearchParams]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const params: { category?: number; page: number; pageSize: number } = {
          page: 1,
          pageSize: 50,
        };
        if (activeCategory !== 'all') params.category = activeCategory;
        const result = await redeemService.getItems(params);
        if (mounted) setItems(result.items);
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
  }, [activeCategory]);

  const handleChildSelect = (id: number) => {
    setSelectedChildId(id);
    childStore.setCurrentChildId(id);
  };

  const handleExchange = async () => {
    if (!selectedChild || !exchangingItem) return;
    try {
      const result = await redeemService.redeem(exchangingItem.id, selectedChild.id);
      childStore.updateBalance(selectedChild.id, result.new_balance);
      const itemsResult = await redeemService.getItems(
        activeCategory === 'all' ? { page: 1, pageSize: 50 } : { category: activeCategory, page: 1, pageSize: 50 }
      );
      setItems(itemsResult.items);
      setExchangingItem(null);
    } catch (e: any) {
      setError(e.message || '兑换失败');
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
      <div className="bg-gradient-to-br from-purple to-accent-dark pt-8 pb-12 px-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">积分商城</h1>
              <p className="text-white/80 text-sm mt-0.5">用努力换取奖励</p>
            </div>
            <button
              onClick={() => navigate('/mall/new')}
              className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
            >
              <Plus size={16} /> 新建
            </button>
          </div>

          <ChildTabs children={children} selectedId={selectedChild.id} onSelect={handleChildSelect} />

          <div className="bg-white/15 backdrop-blur rounded-2xl p-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/80 text-xs">兑换人</div>
                <div className="text-white font-semibold text-lg mt-0.5">{selectedChild.nickname}</div>
              </div>
              <div className="text-right">
                <div className="text-white/80 text-xs">积分余额</div>
                <div className="text-white text-2xl font-bold mt-0.5">{selectedChild.balance}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 -mt-3">
        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'all', label: '全部' },
            { id: 0, label: '物质奖励' },
            { id: 1, label: '体验奖励' },
            { id: 2, label: '其他' },
          ].map((cat) => (
            <button
              key={String(cat.id)}
              onClick={() => setActiveCategory(cat.id as 'all' | number)}
              className={`px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-medium transition-all ${activeCategory === cat.id ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-card text-text-secondary hover:bg-white'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                child={{ id: selectedChild.id, nickname: selectedChild.nickname, balance: selectedChild.balance }}
                onExchange={() => setExchangingItem(item)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-2xl shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Gift size={24} className="text-primary" />
            </div>
            <p className="text-text-primary font-medium">暂无商品</p>
            <p className="text-text-tertiary text-sm mt-1">还没有可兑换的奖励</p>
            <button onClick={() => navigate('/mall/new')} className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary-dark transition-colors">
              发布商品
            </button>
          </div>
        )}

        <div className="h-12" />
      </div>

      {exchangingItem && (
        <ExchangeModal
          item={exchangingItem}
          child={{ id: selectedChild.id, nickname: selectedChild.nickname, balance: selectedChild.balance }}
          onClose={() => setExchangingItem(null)}
          onConfirm={handleExchange}
        />
      )}
    </div>
  );
}

export default MallPage;
