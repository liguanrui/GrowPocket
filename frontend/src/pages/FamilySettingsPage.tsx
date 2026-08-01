import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackHeader } from '../components/Header';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import * as childService from '../services/children';
import type { Child } from '../services/children';
import { Users, Plus, Edit2, Trash2, X, Check, Home, Sparkles } from 'lucide-react';
import { IPPAvatar } from '../components/IPPAvatar';

function ChildForm({
  child,
  onSubmit,
  onCancel,
}: {
  child?: Child;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const isEdit = !!child;
  const [form, setForm] = useState({
    nickname: child?.nickname || '',
    birthday: child?.birthday || '',
    gender: child?.gender ?? 0,
  });

  const handleSubmit = () => {
    if (!form.nickname.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">
            {isEdit ? '编辑孩子档案' : '添加孩子档案'}
          </h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">姓名 *</label>
            <input
              type="text"
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              placeholder="输入孩子姓名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">生日</label>
            <input
              type="date"
              value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">性别</label>
            <div className="flex gap-3">
              <button
                onClick={() => setForm({ ...form, gender: 0 })}
                className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                  form.gender === 0 ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-text-secondary'
                }`}
              >
                👦 男
              </button>
              <button
                onClick={() => setForm({ ...form, gender: 1 })}
                className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                  form.gender === 1 ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-text-secondary'
                }`}
              >
                👧 女
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-100 text-text-secondary rounded-xl font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.nickname.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium disabled:opacity-50"
          >
            {isEdit ? '保存' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function FamilySettingsPage() {
  const authStore = useAuthStore();
  const childStore = useChildStore();
  const navigate = useNavigate();
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [showChildForm, setShowChildForm] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | undefined>();

  useEffect(() => {
    if (childStore.children.length === 0) {
      childStore.fetchChildren();
    }
  }, []);

  useEffect(() => {
    if (childStore.children.length > 0) {
      setChildrenList(childStore.children);
    }
  }, [childStore.children]);

  const handleAddChild = async (data: any) => {
    try {
      const newChild = await childService.addChild(data);
      setShowChildForm(false);
      childStore.fetchChildren();
      // 创建儿童档案后跳转到初始能力评估问卷
      if (newChild && newChild.id) {
        navigate(`/questionnaire?stage=register&child_id=${newChild.id}`);
      }
    } catch (e) {
      console.error('添加孩子失败:', e);
    }
  };

  const handleUpdateChild = async (data: any) => {
    if (!editingChild) return;
    try {
      await childService.updateChild(editingChild.id, data);
      setShowChildForm(false);
      setEditingChild(undefined);
      childStore.fetchChildren();
    } catch (e) {
      console.error('更新孩子失败:', e);
    }
  };

  const handleDeleteChild = async (id: number) => {
    if (!confirm('确定删除这个孩子档案吗？')) return;
    try {
      await childService.deleteChild(id);
      childStore.fetchChildren();
    } catch (e) {
      console.error('删除孩子失败:', e);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <BackHeader title="家庭管理" />

      <div className="max-w-lg mx-auto px-4 -mt-3">
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Home size={20} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">家庭信息</h3>
            </div>
          </div>
          <div className="space-y-3 pl-13">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-text-secondary">家庭名称</span>
              <span className="text-text-primary font-medium">{authStore.family?.name || '未加入家庭'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-text-secondary">家庭成员</span>
              <span className="text-text-primary font-medium">{childrenList.length} 位孩子</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users size={20} className="text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">孩子档案</h3>
                <p className="text-xs text-text-tertiary">管理家庭成员</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingChild(undefined);
                setShowChildForm(true);
              }}
              className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="space-y-2">
            {childrenList.map((child) => (
              <div
                key={child.id}
                className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">
                    {child.gender === 0 ? '👦' : '👧'}
                  </div>
                  <div>
                    <div className="font-medium text-text-primary">{child.nickname}</div>
                    <div className="text-xs text-text-tertiary">
                      {child.birthday ? `${child.birthday} · ${child.gender === 0 ? '男' : '女'}` : (child.gender === 0 ? '男' : '女')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingChild(child);
                      setShowChildForm(true);
                    }}
                    className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-text-secondary hover:bg-gray-300"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteChild(child.id)}
                    className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {childrenList.length === 0 && (
              <button
                onClick={() => {
                  setEditingChild(undefined);
                  setShowChildForm(true);
                }}
                className="w-full mt-2 p-5 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <IPPAvatar growthIndex={0} expression="encourage" size={56} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles size={14} className="text-primary" />
                      <span className="font-semibold text-text-primary">添加第一个孩子档案</span>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">
                      录入孩子信息后，小芽将引导完成一次简短的能力评估，为孩子生成专属成长计划
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Plus size={18} className="text-white" />
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        <div className="h-8" />
      </div>

      {showChildForm && (
        <ChildForm
          child={editingChild}
          onSubmit={editingChild ? handleUpdateChild : handleAddChild}
          onCancel={() => {
            setShowChildForm(false);
            setEditingChild(undefined);
          }}
        />
      )}
    </div>
  );
}

export default FamilySettingsPage;
