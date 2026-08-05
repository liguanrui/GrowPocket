import { useState, useEffect } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import { getAbilities, getChildScores, type AbilityDimension, type ChildAbilityScore } from '../services/ability';
import { setGoalByChildId, type GrowthCycle, type SetGoalInput } from '../services/growthCycle';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import type { CycleLengthWeeks } from '../types';

interface GoalSettingModalProps {
  open: boolean;
  onClose: () => void;
  childId: number;
  // V1.3: 改为可选，不传则后端自动按当前日期推算下个周一
  startMonday?: string; // yyyy-mm-dd
  onSuccess?: (cycle: GrowthCycle) => void;
}

const LENGTH_OPTIONS: CycleLengthWeeks[] = [1, 2, 3, 4];

// 提升分档位：+5/+10/+15/+20
const DELTA_OPTIONS = [5, 10, 15, 20];

// 本年级主维映射(基于后端 ability_dimension 表实际 code:
// self_care/independence/hands_on/learning/social_emotional/health)
const GRADE_PRIMARY_DIMS: Record<number, string[]> = {
  1: ['self_care', 'independence'],
  2: ['self_care', 'independence'],
  3: ['hands_on', 'learning'],
  4: ['hands_on', 'learning'],
  5: ['social_emotional', 'health'],
  6: ['social_emotional', 'health'],
};

// 根据 cycleLengthWeeks 推荐默认提升分
function recommendDelta(weeks: CycleLengthWeeks): number {
  switch (weeks) {
    case 1:
      return 5;
    case 2:
      return 10;
    case 3:
      return 15;
    case 4:
      return 20;
  }
}

// 通过 birthday 计算年龄
function computeAge(birthday: string): number {
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// 通过 birthday 推断年级(简化实现)
function inferGrade(birthday?: string | null): number {
  if (!birthday) return 3;
  const age = computeAge(birthday);
  if (age <= 7) return 1;
  if (age <= 8) return 2;
  if (age <= 9) return 3;
  if (age <= 10) return 4;
  if (age <= 11) return 5;
  return 6;
}

// 维度 icon(后端存的 lucide 图标名)→ emoji 占位符,避免动态导入
const DIM_ICON_EMOJI: Record<string, string> = {
  home: '🏠',
  compass: '🧭',
  wrench: '🔧',
  book: '📚',
  heart: '❤️',
  activity: '⚽',
};

export function GoalSettingModal({
  open,
  onClose,
  childId,
  startMonday,
  onSuccess,
}: GoalSettingModalProps) {
  const toast = useToastStore();
  const childStore = useChildStore();

  const [cycleLengthWeeks, setCycleLengthWeeks] = useState<CycleLengthWeeks>(2);
  const [focusDims, setFocusDims] = useState<number[]>([]);
  // V1.3.1: 每维度独立提升分 dimID → delta
  const [dimTargets, setDimTargets] = useState<Record<number, number>>({});
  const [dimensions, setDimensions] = useState<AbilityDimension[]>([]);
  const [childScores, setChildScores] = useState<ChildAbilityScore[]>([]);
  const [loadingDims, setLoadingDims] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开弹窗时初始化默认值 + 加载维度列表 + 加载当前能力分 + 默认勾选本年级主维
  useEffect(() => {
    if (!open) return;
    setCycleLengthWeeks(2);
    setDimTargets({});
    setFocusDims([]);
    setError(null);
    setLoadingDims(true);
    Promise.all([getAbilities(), getChildScores(childId)])
      .then(([list, scores]) => {
        setDimensions(list);
        setChildScores(scores);
        // 默认勾选本年级主维(优先用后端派生的 derived_grade,否则本地推算)
        const child = childStore.getCurrentChild();
        const grade = child?.derived_grade ?? inferGrade(child?.birthday);
        const primaryCodes = GRADE_PRIMARY_DIMS[grade] || [];
        const defaultIds = list
          .filter((d) => primaryCodes.includes(d.code))
          .map((d) => d.id);
        setFocusDims(defaultIds);
        // 为每个默认维度初始化提升分（按周期长度推荐）
        const defaultDelta = recommendDelta(2);
        const initTargets: Record<number, number> = {};
        for (const id of defaultIds) {
          initTargets[id] = defaultDelta;
        }
        setDimTargets(initTargets);
      })
      .catch((e: any) => {
        setError(e.message || '维度列表加载失败');
      })
      .finally(() => setLoadingDims(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, childId]);

  // 切换周期长度时联动所有维度的推荐提升分
  const handleCycleLengthChange = (w: CycleLengthWeeks) => {
    setCycleLengthWeeks(w);
    const recommended = recommendDelta(w);
    // 仅更新当前值等于旧推荐值的维度，避免覆盖家长已自定义的值
    const oldRecommended = recommendDelta(cycleLengthWeeks);
    setDimTargets((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        const numId = Number(id);
        if (next[numId] === oldRecommended) {
          next[numId] = recommended;
        }
      }
      return next;
    });
  };

  // 维度多选(最多 3 个)，同步 dimTargets
  const handleToggleDim = (dimId: number) => {
    const recommended = recommendDelta(cycleLengthWeeks);
    setFocusDims((prev) => {
      let next: number[];
      if (prev.includes(dimId)) {
        next = prev.filter((id) => id !== dimId);
      } else {
        if (prev.length >= 3) {
          toast.warning('最多选择 3 个重点维度');
          return prev;
        }
        next = [...prev, dimId];
      }
      // 同步 dimTargets：移除取消的维度，新增的维度填默认提升分
      setDimTargets((prevT) => {
        const nextT = { ...prevT };
        if (next.includes(dimId)) {
          if (nextT[dimId] === undefined) {
            nextT[dimId] = recommended;
          }
        } else {
          delete nextT[dimId];
        }
        return nextT;
      });
      return next;
    });
  };

  // 修改某维度的提升分
  const handleDeltaChange = (dimId: number, delta: number) => {
    setDimTargets((prev) => ({ ...prev, [dimId]: delta }));
  };

  // 取某维度当前分
  const getScore = (dimId: number): number => {
    const s = childScores.find((x) => x.dimension_id === dimId);
    return s?.score ?? 0;
  };

  const handleSubmit = async () => {
    if (focusDims.length === 0) {
      toast.warning('请至少选择 1 个重点维度');
      return;
    }
    if (Object.keys(dimTargets).length === 0) {
      toast.warning('请为每个维度设置提升分');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const input: SetGoalInput = {
        child_id: childId,
        cycle_length_weeks: cycleLengthWeeks,
        focus_dims: focusDims,
        dim_targets: dimTargets,
      };
      if (startMonday) {
        input.start_monday = startMonday;
      }
      const cycle = await setGoalByChildId(input);
      toast.success('目标已设定，课程表已自动生成');
      onSuccess?.(cycle);
      onClose();
    } catch (e: any) {
      const msg = e.message || '保存失败';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  // 总提升分汇总（展示用）
  const totalDelta = Object.values(dimTargets).reduce((sum, v) => sum + v, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[92vh] flex flex-col">
        {/* 顶栏:标题 + 关闭 */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <h3 className="font-semibold text-text-primary text-lg">🎯 设定本周期目标</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区(可滚动) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1: 周期长度 */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-sm font-medium text-text-primary">周期长度</h4>
              <span className="text-xs text-text-tertiary">默认 2 周</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {LENGTH_OPTIONS.map((w) => (
                <button
                  key={w}
                  onClick={() => handleCycleLengthChange(w)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all ${
                    cycleLengthWeeks === w
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-gray-50 text-text-secondary hover:bg-gray-100'
                  }`}
                >
                  {w} 周
                </button>
              ))}
            </div>
          </section>

          {/* Section 2: 重点能力维度 */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-sm font-medium text-text-primary">重点能力维度</h4>
              <span className="text-xs text-text-tertiary">
                已选 {focusDims.length}/3 · 必选 1-3 个
              </span>
            </div>
            {loadingDims ? (
              <div className="flex items-center justify-center py-6 text-text-secondary text-sm">
                <Loader2 size={16} className="animate-spin mr-2" />
                加载维度中...
              </div>
            ) : dimensions.length === 0 ? (
              <div className="py-6 text-center text-text-tertiary text-sm">暂无维度数据</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {dimensions.map((dim) => {
                  const checked = focusDims.includes(dim.id);
                  return (
                    <button
                      key={dim.id}
                      onClick={() => handleToggleDim(dim.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                        checked
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-lg flex-shrink-0">
                        {DIM_ICON_EMOJI[dim.icon] || '⭐'}
                      </span>
                      <span
                        className={`flex-1 text-sm font-medium truncate ${
                          checked ? 'text-primary' : 'text-text-primary'
                        }`}
                      >
                        {dim.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Section 3: 各维度目标提升分（V1.3.1 替换原总积分档位） */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <h4 className="text-sm font-medium text-text-primary">各维度目标提升分</h4>
              <span className="text-xs text-text-tertiary">
                合计 +{totalDelta} 分
              </span>
            </div>
            {focusDims.length === 0 ? (
              <div className="py-4 text-center text-text-tertiary text-sm">
                请先选择重点维度
              </div>
            ) : (
              <div className="space-y-3">
                {focusDims.map((dimId) => {
                  const dim = dimensions.find((d) => d.id === dimId);
                  if (!dim) return null;
                  const current = getScore(dimId);
                  const delta = dimTargets[dimId] ?? recommendDelta(cycleLengthWeeks);
                  const target = current + delta;
                  return (
                    <div key={dimId} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {DIM_ICON_EMOJI[dim.icon] || '⭐'}
                          </span>
                          <span className="text-sm font-medium text-text-primary">
                            {dim.name}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary">
                          <span className="text-text-tertiary">{current}</span>
                          <span className="mx-1 text-text-tertiary">→</span>
                          <span className="text-primary font-medium">{target}</span>
                          <span className="text-text-tertiary ml-1">分</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {DELTA_OPTIONS.map((d) => (
                          <button
                            key={d}
                            onClick={() => handleDeltaChange(dimId, d)}
                            className={`py-2 rounded-lg text-sm font-medium transition-all ${
                              delta === d
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-white text-text-secondary hover:bg-gray-100 border border-gray-100'
                            }`}
                          >
                            +{d}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-text-tertiary mt-2">
              为每个重点维度设置本周期提升目标，课程表将按维度加权生成
            </p>
          </section>

          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        {/* 底部固定保存按钮 */}
        <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0">
          <button
            onClick={handleSubmit}
            disabled={submitting || focusDims.length === 0 || Object.keys(dimTargets).length === 0 || loadingDims}
            className="w-full py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {submitting ? '保存中...' : '保存并生成课程表'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoalSettingModal;
