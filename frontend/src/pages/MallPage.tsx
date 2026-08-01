import { useState, useEffect } from 'react';
import { Plus, Gift, Edit3, MoreHorizontal, Trash2, TrendingUp, ShoppingBag, CheckCircle2, Receipt, ChevronLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { ChildTabs } from '../components/ChildTabs';
import * as redeemService from '../services/redeem';
import { getRedeems } from '../services/redeem';
import type { RedeemItem, RedeemRecord } from '../services/redeem';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function CircleProgress({ percentage }: { percentage: number }) {
  const r = 24;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <div className="flex flex-col items-center">
      <svg width={56} height={56} viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} stroke="rgba(255,255,255,0.3)" strokeWidth="4" fill="none" />
        <circle cx="28" cy="28" r={r} stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 28 28)" />
        <text x="28" y="31" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">{percentage}%</text>
      </svg>
      <span className="text-[10px] text-white/70 mt-0.5">本周目标</span>
    </div>
  );
}

function ItemCard({ item, child, onExchange, onEdit }: { item: RedeemItem; child: { nickname: string; balance: number; id: number }; onExchange: () => void; onEdit: () => void }) {
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
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="absolute top-2 left-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center hover:bg-black/60 transition-colors"
          title="编辑商品"
        >
          <Edit3 size={14} className="text-white" />
        </button>
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

function RedeemedCard({ record }: { record: RedeemRecord }) {
  return (
    <div className="bg-card rounded-2xl overflow-hidden shadow-sm">
      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
        {record.itemImage ? (
          <img src={record.itemImage} alt={record.itemName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-warm-light text-primary/30">
            <Gift size={48} />
          </div>
        )}
        <div className="absolute top-2 right-2 bg-success text-white text-xs font-bold px-2 py-1 rounded-full">
          已兑换
        </div>
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold text-text-primary line-clamp-1">{record.itemName}</div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1 text-primary">
            <span className="font-bold text-base">{record.points}</span>
            <span className="text-xs text-text-tertiary">积分</span>
          </div>
          <div className="text-xs text-text-tertiary">{formatDate(record.created_at)}</div>
        </div>
        <div className="w-full mt-3 py-2 rounded-xl text-xs font-medium bg-gray-100 text-text-tertiary text-center">
          已兑换
        </div>
      </div>
    </div>
  );
}

function RecordList({ records }: { records: RedeemRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">暂无兑换记录</div>
    );
  }
  return (
    <div className="bg-card rounded-xl border border-gray-100 divide-y divide-gray-100">
      {records.map((record) => (
        <div key={record.id} className="flex items-center gap-3 p-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Gift size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-text-primary line-clamp-1">{record.itemName}</div>
            <div className="text-xs text-text-tertiary">{formatDate(record.created_at)}</div>
          </div>
          <div className="text-sm font-medium text-text-tertiary flex-shrink-0">-{record.points}</div>
        </div>
      ))}
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
  const uiStore = useUIStore();
  const toast = useToastStore();
  const [items, setItems] = useState<RedeemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exchangingItem, setExchangingItem] = useState<RedeemItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'available' | 'redeemed' | 'records'>('available');
  const [redeemRecords, setRedeemRecords] = useState<RedeemRecord[]>([]);

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

  useEffect(() => {
    if (uiStore.needRefreshItems) {
      uiStore.setNeedRefreshItems(false);
      const loadData = async () => {
        try {
          const params: { category?: number; page: number; pageSize: number } = {
            page: 1,
            pageSize: 50,
          };
          if (activeCategory !== 'all') params.category = activeCategory;
          const result = await redeemService.getItems(params);
          setItems(result.items);
        } catch (e: any) {
          toast.error(e.message || '刷新失败');
        }
      };
      loadData();
    }
  }, [uiStore.needRefreshItems, activeCategory]);

  useEffect(() => {
    if (!selectedChildId) return;
    getRedeems(selectedChildId, 1, 50).then(res => setRedeemRecords(res.items)).catch(() => {});
  }, [selectedChildId]);

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
      getRedeems(selectedChild.id, 1, 50).then(res => setRedeemRecords(res.items)).catch(() => {});
      setExchangingItem(null);
      toast.success('兑换成功');
    } catch (e: any) {
      toast.error(e.message || '兑换失败');
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
          <p className="text-sm text-text-tertiary mt-2">请先添加孩子信息</p>
          <button onClick={() => navigate('/family')} className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-xl">去家庭管理</button>
        </div>
      </div>
    );
  }

  const weeklyPercentage = Math.min(100, Math.round((selectedChild.balance % 500) / 500 * 100));

  const tabs = [
    { key: 'available' as const, label: '可兑换', icon: ShoppingBag },
    { key: 'redeemed' as const, label: '已兑换', icon: CheckCircle2 },
    { key: 'records' as const, label: '兑换记录', icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 pt-8 pb-12 px-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">积分商城</h1>
                <p className="text-white/80 text-sm mt-0.5">用努力换取奖励</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/mall/new')}
              className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
            >
              <Plus size={16} /> 新建
            </button>
          </div>

          <ChildTabs children={children} selectedId={selectedChild.id} onSelect={handleChildSelect} />

          <div
            className="rounded-2xl p-5 text-white mt-4"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #16a34a 100%)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/80">我的积分</div>
                <div className="text-3xl font-bold text-white mt-1">{selectedChild.balance}</div>
              </div>
              <CircleProgress percentage={weeklyPercentage} />
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <TrendingUp size={14} className="text-white/80" />
              <span className="text-xs text-white/80">本周已赚积分</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 -mt-3">
        {/* Tab bar */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-full mb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive ? 'bg-card text-primary' : 'text-text-tertiary'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: 可兑换 */}
        {activeTab === 'available' && (
          <>
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
                    onEdit={() => navigate(`/mall/${item.id}/edit`)}
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

            {/* Recent exchange records */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-text-primary">最近兑换</h2>
                {redeemRecords.length > 0 && (
                  <button onClick={() => setActiveTab('records')} className="text-xs text-primary">
                    查看全部
                  </button>
                )}
              </div>
              <RecordList records={redeemRecords.slice(0, 5)} />
            </div>
          </>
        )}

        {/* Tab 2: 已兑换 */}
        {activeTab === 'redeemed' && (
          <>
            {redeemRecords.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {redeemRecords.map((record) => (
                  <RedeemedCard key={record.id} record={record} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-card rounded-2xl shadow-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-primary" />
                </div>
                <p className="text-text-primary font-medium">暂无已兑换商品</p>
                <p className="text-text-tertiary text-sm mt-1">去商城兑换喜欢的奖励吧</p>
              </div>
            )}
          </>
        )}

        {/* Tab 3: 兑换记录 */}
        {activeTab === 'records' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary">兑换记录</h2>
            </div>
            <RecordList records={redeemRecords} />
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
