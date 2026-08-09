import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackHeader } from '../components/Header';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import * as childService from '../services/children';
import type { Child } from '../services/children';
import { Users, Plus, Edit2, Trash2, X, Check, Home, Sparkles, Copy, RefreshCw } from 'lucide-react';
import { IPPAvatar } from '../components/IPPAvatar';
import { MobileDatePicker } from '../components/MobileDatePicker';
import { useToastStore } from '../stores/toastStore';
import { gradeLabel as gradeName } from '../utils/gradeLabel';
import { saveChildDraft } from '../utils/childDraft';
import { copyText } from '../utils/clipboard';

// 与 OnboardingPage 共用的爱好标签
const HOBBY_TAGS = [
  { category: '运动', items: ['跑步', '球类', '游泳', '跳绳'] },
  { category: '艺术', items: ['绘画', '音乐', '手工', '舞蹈'] },
  { category: '学习', items: ['阅读', '拼搭积木', '自然观察', '棋类'] },
];
const ALL_HOBBIES = HOBBY_TAGS.flatMap((g) => g.items);

// 工具函数：生日 → 周岁
function computeAge(birthday: string | null | undefined): number {
  if (!birthday) return 0;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age < 0 ? 0 : age;
}

// 9/1 入学规则推算年级（0=幼儿园，1-6 小学）
function computeGrade(birthday: string | null | undefined): number {
  if (!birthday) return 0;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return 0;
  const now = new Date();
  const enrollAge = 6;
  let baseYear = now.getFullYear();
  if (now.getMonth() + 1 < 9) baseYear--;
  let enrollYear = b.getFullYear() + enrollAge;
  if (b.getMonth() + 1 >= 9) enrollYear++;
  let g = baseYear - enrollYear + 1;
  if (g < 0) g = 0;
  if (g > 6) g = 6;
  return g;
}
function formatBirthday(birthday: string | null | undefined): string {
  if (!birthday) return '';
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return '';
  return `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, '0')}-${String(b.getDate()).padStart(2, '0')}`;
}
function safeHobbiesJSON(hobbies?: string | null): string[] {
  if (!hobbies) return [];
  try {
    const arr = JSON.parse(hobbies);
    if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string');
  } catch {}
  return [];
}

function toggleArray<T>(arr: T[], v: T): T[] {
  if (arr.includes(v)) return arr.filter((x) => x !== v);
  return [...arr, v];
}

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
  const initialHobbies = useMemo(() => safeHobbiesJSON(child?.hobbies), [child?.hobbies]);
  const initialGrade = child?.grade ?? null;
  const initialGradeOverridden = !!child?.grade_overridden;

  const [nickname, setNickname] = useState(child?.nickname || '');
  const [gender, setGender] = useState<0 | 1>((child?.gender as 0 | 1) ?? 0);
  const [birthday, setBirthday] = useState<string>(formatBirthday(child?.birthday ?? null));
  const [grade, setGrade] = useState<number | null>(initialGradeOverridden ? initialGrade : null);
  const [gradeOverridden, setGradeOverridden] = useState<boolean>(initialGradeOverridden);
  const [hobbies, setHobbies] = useState<string[]>(initialHobbies);

  const derivedAge = computeAge(birthday);
  const derivedGrade = gradeOverridden && grade !== null ? grade : computeGrade(birthday);
  const canSubmit = nickname.trim().length > 0 && nickname.trim().length <= 20;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload: any = {
      nickname: nickname.trim(),
      gender,
      birthday: birthday || undefined,
      grade_overridden: gradeOverridden,
    };
    if (gradeOverridden && grade !== null) payload.grade = grade;
    // birthday 存在且未覆盖时：grade/age 交给后端派生，不传手动值
    if (!birthday) {
      if (grade !== null) payload.grade = grade;
    }
    payload.hobbies = JSON.stringify(hobbies);
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 my-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">
            {isEdit ? '编辑孩子档案' : '添加孩子档案'}
          </h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* 姓名 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">姓名 *</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary"
              placeholder="输入孩子姓名"
              maxLength={20}
            />
          </div>

          {/* 性别 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">性别</label>
            <div className="flex gap-3">
              <button
                onClick={() => setGender(0)}
                className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                  gender === 0 ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-text-secondary'
                }`}
              >
                👦 男
              </button>
              <button
                onClick={() => setGender(1)}
                className={`flex-1 py-3 rounded-xl border-2 transition-all ${
                  gender === 1 ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-text-secondary'
                }`}
              >
                👧 女
              </button>
            </div>
          </div>

          {/* 生日 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">生日</label>
            <MobileDatePicker
              value={birthday}
              max={new Date().toISOString().slice(0, 10)}
              min="2010-01-01"
              placeholder="选择出生日期"
              onChange={(v) => {
                setBirthday(v);
                if (gradeOverridden && !isEdit) setGradeOverridden(false);
              }}
            />
          </div>

          {/* 推算展示 + 年级手动覆盖 */}
          <div className="rounded-xl p-4 bg-gray-50 border border-gray-100">
            <div className="text-sm font-semibold text-text-primary mb-1">
              {birthday ? `${derivedAge} 岁 · ${gradeName(derivedGrade, derivedAge)}` : '选择生日后自动显示年龄和年级'}
            </div>
            <div className="text-xs text-text-tertiary mb-3">按 9 月 1 日入学规则自动推算</div>

            <button
              onClick={() => {
                if (!gradeOverridden) {
                  setGrade(derivedGrade);
                  setGradeOverridden(true);
                } else {
                  setGradeOverridden(false);
                }
              }}
              className="text-xs underline text-primary mb-2"
            >
              {gradeOverridden ? '使用系统推算年级' : '不对？手动调整年级'}
            </button>

            {gradeOverridden && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[0, 1, 2, 3, 4, 5, 6].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className="py-2 rounded-lg text-xs font-medium transition-all active:scale-95"
                    style={{
                      background: grade === g ? 'var(--tw-gradient-from, #F59E6B)' : '#F3F4F6',
                      color: grade === g ? '#fff' : '#2D2A26',
                      border: `2px solid ${grade === g ? 'var(--tw-gradient-from, #F59E6B)' : 'transparent'}`,
                      backgroundClip: grade === g ? undefined : undefined,
                      backgroundImage: grade === g ? 'linear-gradient(to right, var(--tw-gradient-from, #F59E6B), var(--tw-gradient-to, #F59E6B))' : undefined,
                    }}
                  >
                    {gradeName(g)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 爱好 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">爱好（可多选）</label>
            <div className="space-y-3">
              {HOBBY_TAGS.map((group) => (
                <div key={group.category}>
                  <p className="text-xs text-text-tertiary mb-2">{group.category}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((tag) => {
                      const selected = hobbies.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => setHobbies(toggleArray(hobbies, tag))}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95 flex items-center gap-1"
                          style={{
                            background: selected ? 'var(--tw-gradient-from, #F59E6B)' : '#F3F4F6',
                            color: selected ? '#fff' : '#2D2A26',
                            border: `2px solid ${selected ? 'var(--tw-gradient-from, #F59E6B)' : 'transparent'}`,
                            backgroundImage: selected ? 'linear-gradient(to right, var(--tw-gradient-from, #F59E6B), var(--tw-gradient-to, #F59E6B))' : undefined,
                          }}
                        >
                          {selected && <Check size={12} />}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-text-tertiary">已选 {hobbies.length} 项</div>
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
            disabled={!canSubmit}
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
  const toast = useToastStore();
  const [childrenList, setChildrenList] = useState<Child[]>([]);
  const [showChildForm, setShowChildForm] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | undefined>();
  const [shareCode, setShareCode] = useState(authStore.family?.share_code || '');
  const [familyName, setFamilyName] = useState(authStore.family?.name || '');
  const [regenLoading, setRegenLoading] = useState(false);

  useEffect(() => {
    if (childStore.children.length === 0) {
      childStore.fetchChildren();
    }
    childService
      .getFamily()
      .then((info) => {
        setShareCode(info.share_code || '');
        setFamilyName(info.name || '');
        authStore.setFamily({
          id: info.id,
          name: info.name,
          share_code: info.share_code,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (childStore.children.length > 0) {
      setChildrenList(childStore.children);
    }
  }, [childStore.children]);

  const handleCopyShareCode = async () => {
    if (!shareCode) {
      toast.error('暂无分享码');
      return;
    }
    const ok = await copyText(shareCode);
    if (ok) toast.success('分享码已复制');
    else toast.error('复制失败，请长按分享码手动复制');
  };

  const handleRegenerateShareCode = async () => {
    if (!confirm('重新生成后，旧分享码将失效。确定继续？')) return;
    setRegenLoading(true);
    try {
      const info = await childService.regenerateShareCode();
      setShareCode(info.share_code);
      authStore.setFamily({
        id: info.id,
        name: info.name,
        share_code: info.share_code,
      });
      toast.success('已生成新的分享码');
    } catch (e: any) {
      toast.error(e?.message || '重新生成失败');
    } finally {
      setRegenLoading(false);
    }
  };

  // 长按 + 按钮 3 秒 fallback：打开原始精简 ChildForm（极端场景兜底）
  const pressTimer = useRef<number | null>(null);
  const onAddPressStart = () => {
    pressTimer.current = window.setTimeout(() => {
      setEditingChild(undefined);
      setShowChildForm(true);
      toast.success('已打开兜底精简表单（长按 3s 触发）');
    }, 3000);
  };
  const onAddPressEnd = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const goAddChildOnboarding = () => {
    // PRD 7.1：+ 按钮默认跳 Onboarding 流程（完整 6 步）
    navigate('/onboarding?mode=add_child');
  };

  const handleAddChildLegacy = (data: any) => {
    // 兜底路径：仅存本地草稿，问卷全部答完后再创建孩子（与 Onboarding 一致）
    const grade =
      typeof data.grade === 'number'
        ? data.grade
        : data.birthday
          ? computeGrade(data.birthday)
          : 0;
    const levelMap: Record<number, string> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5', 6: 'L6' };
    const level = levelMap[grade] || 'L1';
    saveChildDraft({
      nickname: data.nickname,
      birthday: data.birthday,
      grade: data.grade,
      grade_overridden: data.grade_overridden,
      age: data.age,
      hobbies: data.hobbies,
      level,
      mode: 'add_child',
    });
    setShowChildForm(false);
    navigate(
      `/questionnaire?stage=register&level=${level}&draft=1&return=${encodeURIComponent('onboarding&mode=add_child')}`,
      { replace: true },
    );
  };

  const handleUpdateChild = async (data: any) => {
    if (!editingChild) return;
    try {
      await childService.updateChild(editingChild.id, data);
      setShowChildForm(false);
      setEditingChild(undefined);
      childStore.fetchChildren();
      toast.success('儿童信息已更新');
      const gradeOrBirthdayChanged = 'birthday' in data || 'grade' in data || 'grade_overridden' in data;
      if (gradeOrBirthdayChanged) {
        setTimeout(() => toast.success('问卷档位与任务生成偏好将在下次生成时调整'), 600);
      }
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : '更新孩子失败');
    }
  };

  const handleDeleteChild = async (id: number) => {
    if (!confirm('确定删除这个孩子档案吗？')) return;
    try {
      await childService.deleteChild(id);
      childStore.fetchChildren();
      toast.success('已删除');
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : '删除孩子失败');
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
              <span className="text-text-primary font-medium">{familyName || authStore.family?.name || '未加入家庭'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-text-secondary">家庭成员</span>
              <span className="text-text-primary font-medium">{childrenList.length} 位孩子</span>
            </div>
            <div className="py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary">家庭分享码</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyShareCode}
                    className="text-xs text-primary font-medium flex items-center gap-1"
                  >
                    <Copy size={14} />
                    复制
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRegenerateShareCode()}
                    disabled={regenLoading}
                    className="text-xs text-text-tertiary font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={regenLoading ? 'animate-spin' : ''} />
                    重新生成
                  </button>
                </div>
              </div>
              <div className="rounded-xl bg-[#FFF1E6] border border-[#F5E6D3] px-4 py-3 text-center">
                <p className="text-2xl font-bold tracking-[0.2em] text-[#2D2A26] font-mono">
                  {shareCode || '--------'}
                </p>
              </div>
              <p className="text-[11px] text-text-tertiary mt-2 leading-relaxed">
                把分享码给另一位家长，注册时填写即可加入本家庭，共同管理孩子档案。
              </p>
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
                <p className="text-xs text-text-tertiary">管理家庭成员（点 + 进入新手指引，长按 3 秒兜底精简表单）</p>
              </div>
            </div>
            <button
              onClick={goAddChildOnboarding}
              onMouseDown={onAddPressStart}
              onMouseUp={onAddPressEnd}
              onMouseLeave={onAddPressEnd}
              onTouchStart={onAddPressStart}
              onTouchEnd={onAddPressEnd}
              onTouchCancel={onAddPressEnd}
              className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20"
              title="点一下=走Onboarding；长按3秒=兜底精简表单"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="space-y-3">
            {childrenList.map((child) => {
              const age = child.derived_age ?? computeAge(child.birthday ?? null) ?? (child.age ?? 0);
              const grade = child.derived_grade ?? (child.grade_overridden ? (child.grade ?? 0) : computeGrade(child.birthday ?? null)) ?? 0;
              const hobbiesArr = safeHobbiesJSON(child.hobbies);
              const gender = child.gender === 1 ? '女' : '男';
              const firstHobbies = hobbiesArr.slice(0, 3);
              const extra = hobbiesArr.length - firstHobbies.length;
              return (
                <div
                  key={child.id}
                  className="flex items-center justify-between py-3 px-3 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl flex-shrink-0">
                      {child.gender === 0 ? '👦' : '👧'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-text-primary flex items-center gap-1.5">
                        <span className="truncate">{child.nickname}</span>
                        {child.is_birthday_today && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-600 font-medium">🎂 生日</span>
                        )}
                      </div>
                      <div className="text-xs text-text-tertiary mt-0.5 truncate">
                        {age > 0 ? `${age} 岁 · ` : ''}
                        {gradeName(grade, age)}
                        {child.birthday ? ` · ${formatBirthday(child.birthday)}` : ''}
                        {` · ${gender}`}
                      </div>
                      {hobbiesArr.length > 0 && (
                        <div className="text-[11px] text-text-tertiary mt-0.5 truncate">
                          爱好：{firstHobbies.join('、')}
                          {extra > 0 ? ` +${extra}` : ''}
                        </div>
                      )}
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
              );
            })}
            {childrenList.length === 0 && (
              <button
                onClick={goAddChildOnboarding}
                onMouseDown={onAddPressStart}
                onMouseUp={onAddPressEnd}
                onMouseLeave={onAddPressEnd}
                onTouchStart={onAddPressStart}
                onTouchEnd={onAddPressEnd}
                onTouchCancel={onAddPressEnd}
                className="w-full mt-2 p-5 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <IPPAvatar expression="encourage" size={56} />
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
          onSubmit={editingChild ? handleUpdateChild : handleAddChildLegacy}
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
