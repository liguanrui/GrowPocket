import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import * as cyclePlanService from '../services/cyclePlan';
import type {
  CycleLengthWeeks,
  CyclePlanPreviewResponse,
  CyclePlanStatus,
} from '../types';
import { CycleCalendarGrid } from '../components/CycleCalendarGrid';
import { GoalSettingModal } from '../components/GoalSettingModal';
import { DailyTaskEditPanel } from '../components/DailyTaskEditPanel';
import { ThemeWeekConfigPanel } from '../components/ThemeWeekConfigPanel';

const LENGTH_OPTIONS: CycleLengthWeeks[] = [1, 2, 3, 4];

const STATUS_META: Record<CyclePlanStatus, { label: string; bg: string; text: string }> = {
  draft: { label: '草稿', bg: 'bg-gray-100', text: 'text-gray-600' },
  locked: { label: '已锁版', bg: 'bg-success/10', text: 'text-success' },
  applied: { label: '已应用', bg: 'bg-primary/10', text: 'text-primary' },
  expired: { label: '已过期', bg: 'bg-gray-100', text: 'text-text-tertiary' },
};

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 取某日所在周的周一(周一为一周起点)
function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDateKey(d);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

function formatRangeLabel(monday: string): string {
  const d = new Date(`${monday}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function CyclePlanPage() {
  const navigate = useNavigate();
  const authStore = useAuthStore();
  const childStore = useChildStore();
  const toast = useToastStore();
  const isParent = authStore.user?.role === 'parent';

  const [cycleLengthWeeks, setCycleLengthWeeks] = useState<CycleLengthWeeks>(2);
  const [cycleOffset, setCycleOffset] = useState<0 | 1>(0); // 0=本周, 1=下周
  const [preview, setPreview] = useState<CyclePlanPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showThemeWeekPanel, setShowThemeWeekPanel] = useState(false);
  const loadSeqRef = useRef(0);

  const thisMonday = getMondayOfWeek(new Date());
  const startMonday = cycleOffset === 0 ? thisMonday : addDays(thisMonday, 7);
  const currentChild = childStore.getCurrentChild();

  const loadData = async (showLoading = true) => {
    const child = useChildStore.getState().getCurrentChild();
    if (!child) {
      setLoading(false);
      return;
    }
    const reqId = ++loadSeqRef.current;
    if (showLoading) setLoading(true);
    try {
      const res = await cyclePlanService.preview(child.id, startMonday, cycleLengthWeeks);
      if (reqId !== loadSeqRef.current) return;
      setPreview(res);
    } catch (e: any) {
      if (reqId !== loadSeqRef.current) return;
      toast.error(e.message || '周期课程表加载失败');
    } finally {
      if (reqId === loadSeqRef.current && showLoading) setLoading(false);
    }
  };

  // mount:拉取孩子列表
  useEffect(() => {
    if (!isParent) return;
    childStore.fetchChildren();
  }, []);

  // 周期长度 / 周期偏移 / 当前孩子变化时重新预览
  useEffect(() => {
    if (!isParent || !currentChild) return;
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleLengthWeeks, cycleOffset, currentChild?.id]);

  const handleRegenerate = async () => {
    if (!preview) return;
    setActionLoading(true);
    try {
      await cyclePlanService.regenerate(preview.cycle_plan.id);
      toast.success('已重新生成周期课程表');
      await loadData(false);
    } catch (e: any) {
      toast.error(e.message || '重新生成失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLock = async () => {
    if (!preview || !authStore.user) return;
    setActionLoading(true);
    try {
      await cyclePlanService.lock(preview.cycle_plan.id, {
        lock_version: preview.lock_version,
        action: 'lock',
        locked_by_parent_id: authStore.user.id,
      });
      toast.success('已确认锁版');
      await loadData(false);
    } catch (e: any) {
      toast.error(e.message || '锁版失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!preview) return;
    setActionLoading(true);
    try {
      const blob = await cyclePlanService.exportPdf(preview.cycle_plan.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cycle-plan-${preview.cycle_plan.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF 导出成功');
    } catch (e: any) {
      toast.error(e.message || '导出失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 阶段目标设定:打开 GoalSettingModal
  const handleGoalEntry = () => {
    setShowGoalModal(true);
  };

  // 目标设定成功:重新调 preview 接口刷新课程表
  const handleGoalSuccess = () => {
    loadData(false);
  };

  // 主题周配置入口(Task 18)
  const handleThemeWeekEntry = () => {
    setShowThemeWeekPanel(true);
  };

  const handleCellClick = (date: string) => {
    setSelectedDate(date);
    setShowEditPanel(true);
  };

  // 非家长:家长专属提示
  if (!isParent) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm max-w-sm">
          <div className="text-5xl mb-3">🔒</div>
          <div className="text-text-primary font-medium text-lg">家长专属</div>
          <p className="text-sm text-text-tertiary mt-2">
            周期课程表仅对家长开放,请爸爸妈妈登录后查看。
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary-dark transition-colors"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-gray-200 animate-spin" style={{ borderTopColor: '#F59E6B' }} />
        <div className="text-text-secondary text-sm">周期课程表加载中...</div>
      </div>
    );
  }

  // 无孩子档案
  if (!currentChild) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm max-w-sm">
          <div className="text-text-primary font-medium">暂无孩子档案</div>
          <p className="text-sm text-text-tertiary mt-2">请先添加孩子信息</p>
          <button
            onClick={() => navigate('/family')}
            className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            去家庭管理
          </button>
        </div>
      </div>
    );
  }

  const cyclePlan = preview?.cycle_plan;
  const status: CyclePlanStatus = cyclePlan?.status ?? 'draft';
  const statusMeta = STATUS_META[status];
  const isDraft = status === 'draft';

  // 维度占比统计
  const ratio = preview?.dimension_ratio;
  const mainPct = ratio ? Math.round(ratio.main_dim_pct * 100) : 0;
  const secondaryPct = ratio ? Math.round(ratio.secondary_pct * 100) : 0;
  const latentPct = ratio ? Math.round(ratio.latent_pct * 100) : 0;
  const mainOk = mainPct >= 60;

  const themeActive = !!preview?.theme_week_config?.active;

  return (
    <div className="min-h-screen bg-bg pb-32">
      {/* 顶部栏 */}
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">周期课程表</h1>
                <p className="text-white/80 text-sm mt-0.5">{currentChild.nickname} 的成长计划</p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusMeta.bg} ${statusMeta.text}`}
            >
              🔒 {statusMeta.label}
            </span>
          </div>

          {/* 周期选择:本周 / 下周 */}
          <div className="flex gap-2 mb-3">
            {([
              { id: 0 as const, label: `本周 (${formatRangeLabel(thisMonday)})` },
              { id: 1 as const, label: `下周 (${formatRangeLabel(addDays(thisMonday, 7))})` },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setCycleOffset(opt.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                  cycleOffset === opt.id
                    ? 'bg-white text-primary shadow'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 周期长度档位切换器 */}
          <div className="flex gap-2 mb-3">
            {LENGTH_OPTIONS.map((w) => (
              <button
                key={w}
                onClick={() => setCycleLengthWeeks(w)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                  cycleLengthWeeks === w
                    ? 'bg-white text-primary shadow'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {w} 周
              </button>
            ))}
          </div>

          {/* 入口按钮:🎯 设定本周期目标 / 🌟 主题周 */}
          <div className="flex gap-2">
            <button
              onClick={handleGoalEntry}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white/15 text-white text-xs font-medium rounded-xl hover:bg-white/25 transition-colors"
            >
              <span>🎯</span>
              <span>设定本周期目标</span>
            </button>
            <button
              onClick={handleThemeWeekEntry}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-colors ${
                themeActive
                  ? 'bg-yellow-400/30 text-yellow-100 ring-1 ring-yellow-300/50'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <span>🌟</span>
              <span>主题周{themeActive ? '·已开启' : ''}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4 space-y-4">
        {/* 整 Cycle 维度占比统计条(能力占比仪表盘) */}
        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-text-primary">能力占比</div>
            {!mainOk && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-danger/10 text-danger font-medium">
                ⚠️ 主维占比偏低
              </span>
            )}
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
            <div className="bg-primary" style={{ width: `${mainPct}%` }} />
            <div className="bg-blue-300" style={{ width: `${secondaryPct}%` }} />
            <div className="bg-purple-300" style={{ width: `${latentPct}%` }} />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-text-secondary">主维</span>
              <span className={`font-medium ${mainOk ? 'text-text-primary' : 'text-danger'}`}>{mainPct}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-300" />
              <span className="text-text-secondary">次维</span>
              <span className="font-medium text-text-primary">{secondaryPct}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-300" />
              <span className="text-text-secondary">潜维</span>
              <span className="font-medium text-text-primary">{latentPct}%</span>
            </div>
          </div>
        </div>

        {/* CycleCalendarGrid 日历表格 */}
        <div className="bg-card rounded-2xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-sm font-medium text-text-primary">
              {cycleLengthWeeks} 周课程表
            </div>
            <div className="text-xs text-text-tertiary">
              起 {formatRangeLabel(startMonday)}
            </div>
          </div>
          {preview ? (
            <CycleCalendarGrid
              dailyInstances={preview.daily_instances}
              cycleLengthWeeks={cycleLengthWeeks}
              startDate={startMonday}
              onClickCell={handleCellClick}
            />
          ) : (
            <div className="text-center py-10 text-sm text-text-tertiary">暂无预览数据</div>
          )}
        </div>
      </div>

      {/* 底部悬浮操作条(仅 draft 状态显示) */}
      {isDraft && preview && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
          <div className="max-w-lg mx-auto bg-card rounded-2xl shadow-lg border border-gray-100 p-2 flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={actionLoading}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-gray-50 text-text-secondary hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <span className="text-base">🔄</span>
              <span className="text-[11px] font-medium">重新生成</span>
            </button>
            <button
              onClick={handleExportPdf}
              disabled={actionLoading}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-gray-50 text-text-secondary hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <span className="text-base">📤</span>
              <span className="text-[11px] font-medium">导出 PDF</span>
            </button>
            <button
              onClick={handleLock}
              disabled={actionLoading}
              className="flex-[1.4] flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              <span className="text-base">✅</span>
              <span className="text-[11px] font-medium">{actionLoading ? '处理中...' : '确认锁版'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 阶段目标设定弹层 */}
      <GoalSettingModal
        open={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        childId={currentChild.id}
        startMonday={startMonday}
        onSuccess={handleGoalSuccess}
      />

      {/* 单日任务编辑面板(Task 17) */}
      {selectedDate && preview && (
        <DailyTaskEditPanel
          open={showEditPanel}
          onClose={() => {
            setShowEditPanel(false);
            setSelectedDate(null);
          }}
          date={selectedDate}
          tasks={preview.daily_instances[selectedDate] || []}
          cyclePlanId={preview.cycle_plan.id}
          childId={currentChild.id}
          mainDimPct={Math.round((preview.dimension_ratio.main_dim_pct ?? 0) * 100)}
          onChanged={() => loadData(false)}
        />
      )}

      {/* 主题周配置面板(Task 18) */}
      {preview && (
        <ThemeWeekConfigPanel
          open={showThemeWeekPanel}
          onClose={() => setShowThemeWeekPanel(false)}
          cyclePlanId={preview.cycle_plan.id}
          cycleLengthWeeks={preview.cycle_plan.cycle_length_weeks}
          currentConfig={preview.theme_week_config}
          onChanged={() => loadData(false)}
        />
      )}
    </div>
  );
}

export default CyclePlanPage;
