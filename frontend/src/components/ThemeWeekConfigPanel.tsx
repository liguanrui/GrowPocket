import { useState, useEffect } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import { getAbilities, type AbilityDimension } from '../services/ability';
import * as cyclePlanService from '../services/cyclePlan';
import { useToastStore } from '../stores/toastStore';
import type { CycleLengthWeeks, ThemeWeekConfig, ThemeWeekPosition } from '../types';

interface ThemeWeekConfigPanelProps {
  open: boolean;
  onClose: () => void;
  cyclePlanId: number;
  cycleLengthWeeks: CycleLengthWeeks; // 1/2/3/4 周
  currentConfig: ThemeWeekConfig | null; // 当前主题周配置(无则 null)
  onChanged: () => void; // 配置变更后回调,触发父组件刷新
}

// 维度 icon(后端存的 lucide 图标名)→ emoji 占位符
const DIM_ICON_EMOJI: Record<string, string> = {
  home: '🏠',
  compass: '🧭',
  wrench: '🔧',
  book: '📚',
  heart: '❤️',
  activity: '⚽',
};

// 位置选项标签
const POSITION_LABELS: Record<ThemeWeekPosition, string> = {
  week1: '第 1 周',
  week2: '第 2 周',
  week3: '第 3 周',
  week4: '第 4 周',
};

// 根据 cycleLengthWeeks 推导可用的位置选项
function getAvailablePositions(weeks: CycleLengthWeeks): ThemeWeekPosition[] {
  const all: ThemeWeekPosition[] = ['week1', 'week2', 'week3', 'week4'];
  return all.slice(0, weeks);
}

export function ThemeWeekConfigPanel({
  open,
  onClose,
  cyclePlanId,
  cycleLengthWeeks,
  currentConfig,
  onChanged,
}: ThemeWeekConfigPanelProps) {
  const toast = useToastStore();

  const [dimensions, setDimensions] = useState<AbilityDimension[]>([]);
  const [loadingDims, setLoadingDims] = useState(false);
  const [selectedDimId, setSelectedDimId] = useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<ThemeWeekPosition>('week1');
  const [editMode, setEditMode] = useState(false); // 是否显示配置区(未开启时点击开关进入)
  const [submitting, setSubmitting] = useState(false);

  // 打开弹窗时初始化 + 加载维度列表
  useEffect(() => {
    if (!open) return;
    setSelectedDimId(currentConfig?.dim ?? null);
    setSelectedPosition(currentConfig?.position ?? 'week1');
    setEditMode(!!currentConfig?.active);
    setLoadingDims(true);
    getAbilities()
      .then((list) => setDimensions(list))
      .catch((e: any) => {
        toast.error(e.message || '维度列表加载失败');
      })
      .finally(() => setLoadingDims(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // cycleLengthWeeks 变化时,若当前选中位置超出可用范围则回退到 week1
  useEffect(() => {
    const available = getAvailablePositions(cycleLengthWeeks);
    if (!available.includes(selectedPosition)) {
      setSelectedPosition('week1');
    }
  }, [cycleLengthWeeks, selectedPosition]);

  if (!open) return null;

  const isActive = !!currentConfig?.active; // 后端实际开启状态
  const showConfigSections = editMode; // 显示维度/位置选择区
  const availablePositions = getAvailablePositions(cycleLengthWeeks);
  const showPositionSection = cycleLengthWeeks >= 2;

  // 顶部开关点击
  const handleToggle = async () => {
    // 已开启 → 直接调 API 关闭
    if (isActive) {
      await handleDisable();
      return;
    }
    // 未开启 + 已进入配置模式 → 取消(退出配置)
    if (editMode) {
      setEditMode(false);
      setSelectedDimId(null);
      setSelectedPosition('week1');
      return;
    }
    // 未开启 + 未进入配置模式 → 进入配置模式
    setEditMode(true);
  };

  // 关闭主题周(底部红色按钮 / 开关关闭路径)
  const handleDisable = async () => {
    setSubmitting(true);
    try {
      await cyclePlanService.toggleThemeWeek(cyclePlanId, {
        theme_dim_id: 0,
        position: 'week1',
        enable: false,
      });
      toast.success('主题周已关闭');
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e.message || '关闭失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 保存(开启 / 调整维度或位置)
  const handleSave = async () => {
    if (selectedDimId === null) {
      toast.warning('请选择一个主题维度');
      return;
    }
    setSubmitting(true);
    try {
      await cyclePlanService.toggleThemeWeek(cyclePlanId, {
        theme_dim_id: selectedDimId,
        position: selectedPosition,
        enable: true,
      });
      toast.success('主题周已开启');
      onChanged();
      onClose();
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* 顶栏:标题 + 关闭 */}
        <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <h3 className="font-semibold text-text-primary text-lg">🌟 主题周配置</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Section 1: 主题周开关 */}
          <section>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary">🌟 主题周</div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {isActive
                    ? '已开启 · 整周聚焦弱维突破'
                    : editMode
                      ? '配置中 · 选择维度与位置后保存'
                      : '关闭中 · 点击开关配置主题周'}
                </div>
              </div>
              <button
                onClick={handleToggle}
                disabled={submitting}
                className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                  isActive || editMode ? 'bg-primary' : 'bg-gray-300'
                }`}
                aria-label="主题周开关"
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isActive || editMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Section 2 & 3: 仅在配置模式 / 已开启时显示 */}
          {showConfigSections && (
            <>
              {/* Section 2: 主题维度选择 */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="text-sm font-medium text-text-primary">主题维度</h4>
                  <span className="text-xs text-text-tertiary">单选 · 主题周聚焦的弱维</span>
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
                      const checked = selectedDimId === dim.id;
                      return (
                        <button
                          key={dim.id}
                          onClick={() => setSelectedDimId(dim.id)}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                            checked
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-lg flex-shrink-0">
                            {DIM_ICON_EMOJI[dim.icon] || '⭐'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-medium truncate ${
                                checked ? 'text-primary' : 'text-text-primary'
                              }`}
                            >
                              {dim.name}
                            </div>
                            <div className="text-[10px] text-text-tertiary truncate">{dim.code}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section 3: 位置选择(仅 2-4 周 Cycle 显示) */}
              {showPositionSection && (
                <section>
                  <div className="flex items-baseline justify-between mb-2">
                    <h4 className="text-sm font-medium text-text-primary">主题周位置</h4>
                    <span className="text-xs text-text-tertiary">
                      {cycleLengthWeeks} 周周期 · 选 1 周作为主题周
                    </span>
                  </div>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${availablePositions.length}, minmax(0, 1fr))` }}
                  >
                    {availablePositions.map((pos) => {
                      const checked = selectedPosition === pos;
                      return (
                        <button
                          key={pos}
                          onClick={() => setSelectedPosition(pos)}
                          className={`py-3 rounded-xl text-sm font-medium transition-all ${
                            checked
                              ? 'bg-primary text-white shadow-md shadow-primary/20'
                              : 'bg-gray-50 text-text-secondary hover:bg-gray-100'
                          }`}
                        >
                          {POSITION_LABELS[pos]}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-text-tertiary mt-2">
                    1 周 Cycle 时整周期即主题周,无需选择位置
                  </p>
                </section>
              )}
            </>
          )}
        </div>

        {/* 底部固定操作区 */}
        <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0 space-y-2">
          {/* 保存按钮:配置模式或已开启时显示 */}
          {showConfigSections && (
            <button
              onClick={handleSave}
              disabled={submitting || selectedDimId === null || loadingDims}
              className="w-full py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {submitting ? '保存中...' : isActive ? '保存调整' : '开启主题周'}
            </button>
          )}
          {/* 关闭主题周按钮:仅在已开启时显示 */}
          {isActive && (
            <button
              onClick={handleDisable}
              disabled={submitting}
              className="w-full py-2.5 bg-red-50 text-danger text-sm font-medium rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <>🗑️ 关闭主题周</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ThemeWeekConfigPanel;
