import { useState, useEffect } from 'react';
import { ArrowLeft, Edit2, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import type { Child } from '../stores/childStore';

function ChildProfileCard({
  child,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  child: Child;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-2xl p-4 shadow-sm transition-all border-2 ${isSelected ? 'border-primary bg-white' : 'border-warm-light bg-card'}`}>
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {child.avatar ? (
            <img src={child.avatar} alt={child.nickname} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-primary">{child.nickname.slice(0, 1)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-text-primary text-lg">{child.nickname}</h3>
            {isSelected && (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                当前选中
              </span>
            )}
          </div>
          <div className="text-sm text-text-tertiary mt-1">
            {child.gender === 0 ? '男孩' : child.gender === 1 ? '女孩' : '未设置'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-bg rounded-xl p-3 text-center">
          <div className="text-primary text-xl font-bold">{child.balance}</div>
          <div className="text-xs text-text-tertiary mt-0.5">积分余额</div>
        </div>
        <div className="bg-bg rounded-xl p-3 text-center">
          <div className="text-success text-xl font-bold">0</div>
          <div className="text-xs text-text-tertiary mt-0.5">已完成任务</div>
        </div>
        <div className="bg-bg rounded-xl p-3 text-center">
          <div className="text-yellow-600 text-xl font-bold">0</div>
          <div className="text-xs text-text-tertiary mt-0.5">累计获得</div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={onSelect} className={`flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors ${isSelected ? 'bg-gray-100 text-text-secondary' : 'bg-primary text-white hover:bg-primary-dark'}`}>
          {isSelected ? '✓ 当前选中' : '切换到这个孩子'}
        </button>
        <button onClick={onEdit} className="p-2.5 bg-bg hover:bg-gray-100 text-text-secondary rounded-xl transition-colors" title="编辑信息">
          <Edit2 size={18} />
        </button>
        <button onClick={onDelete} className="p-2.5 bg-bg hover:bg-red-50 text-text-secondary hover:text-danger rounded-xl transition-colors" title="删除档案">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

function ChildFormModal({
  mode,
  initialName,
  initialGender,
  onClose,
  onSubmit,
}: {
  mode: 'add' | 'edit';
  initialName?: string;
  initialGender?: 0 | 1;
  onClose: () => void;
  onSubmit: (name: string, gender?: 0 | 1) => void;
}) {
  const [name, setName] = useState(initialName || '');
  const [gender, setGender] = useState<0 | 1 | ''>(initialGender ?? '');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-text-primary text-lg">
            {mode === 'add' ? '添加孩子档案' : '编辑孩子信息'}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              姓名 <span className="text-danger">*</span>
            </label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：小明" className="w-full px-4 py-3 bg-bg rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">性别（可选）</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setGender(0)} className={`py-3 rounded-xl text-sm font-medium transition-colors ${gender === 0 ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-gray-100'}`}>👦 男孩</button>
              <button onClick={() => setGender(1)} className={`py-3 rounded-xl text-sm font-medium transition-colors ${gender === 1 ? 'bg-primary text-white' : 'bg-bg text-text-secondary hover:bg-gray-100'}`}>👧 女孩</button>
            </div>
          </div>
        </div>
        <div className="p-5 bg-gray-50 border-t border-gray-100">
          <button onClick={() => name.trim() && onSubmit(name.trim(), gender === '' ? undefined : gender)} disabled={!name.trim()} className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {mode === 'add' ? '添加孩子' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto bg-danger/10 rounded-full flex items-center justify-center text-danger">
            <Trash2 size={28} />
          </div>
          <h3 className="mt-4 font-semibold text-text-primary text-lg">删除 {name} 的档案？</h3>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            删除后该孩子的积分、任务记录和成长记录将同时被清除，此操作不可撤销。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 border-t border-gray-100">
          <button onClick={onCancel} className="py-3 bg-bg text-text-secondary rounded-xl font-medium hover:bg-gray-100 transition-colors">取消</button>
          <button onClick={onConfirm} className="py-3 bg-danger text-white rounded-xl font-medium hover:bg-red-700 transition-colors">确认删除</button>
        </div>
      </div>
    </div>
  );
}

export function FamilyPage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [deletingChild, setDeletingChild] = useState<Child | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        await childStore.fetchChildren();
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

  const children = childStore.children;
  const currentChild = childStore.getCurrentChild();

  const handleAddChild = async (name: string, gender?: 0 | 1) => {
    try {
      await childStore.addChild({ nickname: name, gender });
      setShowAdd(false);
    } catch (e: any) {
      setError(e.message || '添加失败');
    }
  };

  const handleSaveEdit = async (name: string, gender?: 0 | 1) => {
    if (!editingChild) return;
    try {
      await childStore.updateChild(editingChild.id, { nickname: name, gender });
      setEditingChild(null);
    } catch (e: any) {
      setError(e.message || '更新失败');
    }
  };

  const handleDeleteChild = async () => {
    if (!deletingChild) return;
    try {
      await childStore.removeChild(deletingChild.id);
      setDeletingChild(null);
    } catch (e: any) {
      setError(e.message || '删除失败');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-10 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 className="text-white font-semibold text-lg">家庭管理</h1>
            <div className="w-10 h-10" />
          </div>

          <div className="bg-white/15 backdrop-blur rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/70 text-xs">家庭</div>
                <div className="text-white font-semibold text-lg mt-0.5">温馨家庭</div>
                <div className="text-white/60 text-xs mt-0.5">{children.length} 个孩子</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        <button onClick={() => setShowAdd(true)} className="w-full rounded-2xl border-2 border-dashed border-primary/40 text-primary p-5 hover:bg-primary/5 hover:border-primary transition-colors">
          <div className="flex items-center justify-center gap-3">
            <Plus size={24} />
            <span className="font-medium">添加新的孩子档案</span>
          </div>
        </button>

        {children.length === 0 ? (
          <div className="bg-card rounded-2xl p-10 text-center">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Plus size={28} className="text-primary" />
            </div>
            <div className="mt-4 text-text-primary font-medium">还没有孩子档案</div>
            <div className="mt-1 text-sm text-text-tertiary">点击上方按钮，添加第一个孩子</div>
          </div>
        ) : (
          children.map((child) => (
            <ChildProfileCard key={child.id} child={child} isSelected={currentChild?.id === child.id} onSelect={() => childStore.setCurrentChildId(child.id)} onEdit={() => setEditingChild(child)} onDelete={() => setDeletingChild(child)} />
          ))
        )}

        <div className="bg-card rounded-2xl p-5 mt-4">
          <h3 className="font-semibold text-text-primary mb-3">💡 关于孩子档案</h3>
          <ul className="space-y-2 text-sm text-text-secondary leading-relaxed">
            <li className="flex gap-2"><span className="text-primary">•</span><span>每个孩子都有独立的积分账户，互不影响</span></li>
            <li className="flex gap-2"><span className="text-primary">•</span><span>在首页或各页面的顶部切换孩子，查看不同孩子的数据</span></li>
            <li className="flex gap-2"><span className="text-primary">•</span><span>任务、积分变动、兑换记录都会归属于被指派的孩子</span></li>
          </ul>
        </div>

        {error && (
          <div className="bg-danger/5 border border-danger/20 text-danger text-sm rounded-xl p-3">{error}</div>
        )}

        <div className="h-8" />
      </div>

      {showAdd && <ChildFormModal mode="add" onClose={() => setShowAdd(false)} onSubmit={handleAddChild} />}
      {editingChild && <ChildFormModal mode="edit" initialName={editingChild.nickname} initialGender={editingChild.gender} onClose={() => setEditingChild(null)} onSubmit={handleSaveEdit} />}
      {deletingChild && <ConfirmDeleteModal name={deletingChild.nickname} onCancel={() => setDeletingChild(null)} onConfirm={handleDeleteChild} />}
    </div>
  );
}

export default FamilyPage;
