import { useState, useEffect, useRef } from 'react';
import { Plus, Clock, CheckCircle2, Inbox, FileText, BookOpen, Home, Smile, Dumbbell, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useUIStore } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import * as tasksService from '../services/tasks';
import type { Task, TaskStatus } from '../services/tasks';
import type { TaskCategory, CyclePlanPreviewResponse, ThemeWeekConfig } from '../types';
import * as cyclePlanService from '../services/cyclePlan';
import { getAbilities, type AbilityDimension } from '../services/ability';
import { AcademicMilestoneModal } from '../components/AcademicMilestoneModal';
import { AcademicTrendModal } from '../components/AcademicTrendModal';

const STATUS_TABS: { id: 'all' | TaskStatus; label: string; icon: any }[] = [
  { id: 'all', label: '全部', icon: FileText },
  { id: 1, label: '进行中', icon: Clock },
  { id: 2, label: '待验收', icon: Inbox },
  { id: 3, label: '已完成', icon: CheckCircle2 },
  { id: 4, label: '已拒绝', icon: CheckCircle2 },
];

const CATEGORY_TABS: { id: 'all' | TaskCategory; label: string; icon: any; color: string }[] = [
  { id: 'all', label: '全部', icon: FileText, color: 'text-text-secondary' },
  { id: '学习', label: '学习', icon: BookOpen, color: 'text-blue-500' },
  { id: '家务', label: '家务', icon: Home, color: 'text-emerald-500' },
  { id: '行为习惯', label: '习惯', icon: Smile, color: 'text-amber-500' },
  { id: '运动', label: '运动', icon: Dumbbell, color: 'text-rose-500' },
  { id: '其他', label: '其他', icon: MoreHorizontal, color: 'text-purple-500' },
];

// 维度分 Tab:全部 / 主维 / 次维 / 潜维 / 🌟主题周(主题周激活时显示)
type DimTab = 'all' | 'primary' | 'secondary' | 'latent' | 'theme';

// 年级→主/次/潜维 code 映射(参考 GoalSettingModal 的 GRADE_PRIMARY_DIMS,扩展次维/潜维)
// ability_dimension 表实际 code:self_care / independence / hands_on / learning / social_emotional / health
const GRADE_DIM_MAPPING: Record<number, { primary: string[]; secondary: string[]; latent: string[] }> = {
  1: { primary: ['self_care', 'independence'], secondary: ['hands_on', 'learning'], latent: ['social_emotional', 'health'] },
  2: { primary: ['self_care', 'independence'], secondary: ['hands_on', 'learning'], latent: ['social_emotional', 'health'] },
  3: { primary: ['hands_on', 'learning'], secondary: ['self_care', 'social_emotional'], latent: ['independence', 'health'] },
  4: { primary: ['hands_on', 'learning'], secondary: ['self_care', 'social_emotional'], latent: ['independence', 'health'] },
  5: { primary: ['social_emotional', 'health'], secondary: ['hands_on', 'learning'], latent: ['self_care', 'independence'] },
  6: { primary: ['social_emotional', 'health'], secondary: ['hands_on', 'learning'], latent: ['self_care', 'independence'] },
};

// === 工具函数 ===
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

// 通过 birthday 推断年级(简化实现,与 GoalSettingModal 一致)
function inferGrade(birthday?: string | null): number {
  if (!birthday) return 3;
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  if (age <= 7) return 1;
  if (age <= 8) return 2;
  if (age <= 9) return 3;
  if (age <= 10) return 4;
  if (age <= 11) return 5;
  return 6;
}

// 判断今天是否在主题周区间内
function isThemeWeekActiveNow(tw: ThemeWeekConfig | null | undefined): boolean {
  if (!tw || !tw.active) return false;
  const today = formatDateKey(new Date());
  return today >= tw.start_date && today <= tw.end_date;
}

export function TaskListPage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const uiStore = useUIStore();
  const authStore = useAuthStore();
  const isParent = authStore.user?.role === 'parent';
  const [statusTab, setStatusTab] = useState<'all' | TaskStatus>(1);
  const [categoryTab, setCategoryTab] = useState<'all' | TaskCategory>('all');
  const [dimTab, setDimTab] = useState<DimTab>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAcademicModal, setShowAcademicModal] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  // 周期概览(静默加载,失败不影响主流程)
  const [cyclePreview, setCyclePreview] = useState<CyclePlanPreviewResponse | null>(null);
  const [cycleLoading, setCycleLoading] = useState(false);
  // 能力维度列表(用于维度 ID→code 映射)
  const [dimensions, setDimensions] = useState<AbilityDimension[]>([]);
  const loadSeqRef = useRef(0);

  const loadData = async (showLoading = true) => {
    const child = useChildStore.getState().getCurrentChild();
    if (!child) return;
    const reqId = ++loadSeqRef.current;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const params: { childId: number; status?: TaskStatus; page: number; pageSize: number } = {
        childId: child.id,
        page: 1,
        pageSize: 50,
      };
      if (statusTab !== 'all') {
        params.status = statusTab;
      }
      const result = await tasksService.getTasks(params);
      if (reqId !== loadSeqRef.current) return;
      setTasks(result.items);
    } catch (e: any) {
      if (reqId !== loadSeqRef.current) return;
      setError(e.message || '加载失败');
    } finally {
      if (reqId === loadSeqRef.current && showLoading) setLoading(false);
    }
  };

  // 加载周期概览(静默失败,不影响今日任务列表)
  const loadCyclePreview = async (childId: number) => {
    const thisMonday = getMondayOfWeek(new Date());
    setCycleLoading(true);
    try {
      const res = await cyclePlanService.preview(childId, thisMonday, undefined);
      setCyclePreview(res);
    } catch {
      // 静默处理:周期概览加载失败不影响主流程
      setCyclePreview(null);
    } finally {
      setCycleLoading(false);
    }
  };

  useEffect(() => {
    childStore.fetchChildren().then(() => loadData(true));
    // 能力维度列表(用于维度 Tab 映射),静默失败
    getAbilities()
      .then(setDimensions)
      .catch(() => {});
  }, []);

  // 当前孩子切换时重新拉取周期概览
  useEffect(() => {
    const child = useChildStore.getState().getCurrentChild();
    if (child) loadCyclePreview(child.id);
  }, [useChildStore.getState().currentChildId]);

  useEffect(() => {
    loadData(true);
  }, [statusTab]);

  // 监听全局刷新信号（从任务详情页返回、拒绝/验收操作后）
  useEffect(() => {
    if (uiStore.needRefreshTasks) {
      uiStore.setNeedRefreshTasks(false);
      loadData(false);
    }
  }, [uiStore.needRefreshTasks]);

  // 页面可见性变化时刷新（从其他页面返回时）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadData(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // === 周期概览统计 ===
  const cyclePlan = cyclePreview?.cycle_plan;
  const cycleLengthWeeks = cyclePlan?.cycle_length_weeks ?? 0;
  const cycleStartDate = cyclePlan?.start_date;

  // 已完成周数 X:floor((today - start) / 7),clamp [0, cycle_length_weeks]
  let completedWeeks = 0;
  if (cycleStartDate) {
    const start = new Date(`${cycleStartDate}T00:00:00`);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
    completedWeeks = Math.max(0, Math.min(cycleLengthWeeks, Math.floor(diffDays / 7)));
  }

  // 完成率 & 预计积分(从 daily_instances 聚合)
  const dailyInstances = cyclePreview?.daily_instances || {};
  let totalCycleTasks = 0;
  let completedCycleTasks = 0;
  let completedPoints = 0;
  Object.values(dailyInstances).forEach((arr) => {
    arr.forEach((t) => {
      totalCycleTasks++;
      if (t.status === 'completed') {
        completedCycleTasks++;
        completedPoints += t.points || 0;
      }
    });
  });
  const completionRate = totalCycleTasks > 0 ? Math.round((completedCycleTasks / totalCycleTasks) * 100) : 0;

  const ratio = cyclePreview?.dimension_ratio;
  const mainPct = ratio ? Math.round(ratio.main_dim_pct * 100) : 0;
  const secondaryPct = ratio ? Math.round(ratio.secondary_pct * 100) : 0;
  const latentPct = ratio ? Math.round(ratio.latent_pct * 100) : 0;

  // === 主题周判断 ===
  const themeActive = isThemeWeekActiveNow(cyclePreview?.theme_week_config);
  const themeTitle = cyclePreview?.theme_week_config?.theme_title || '';
  const themeDimId = cyclePreview?.theme_week_config?.dim;

  // === 维度映射 ===
  const currentChild = useChildStore.getState().getCurrentChild();
  const grade = currentChild?.derived_grade ?? inferGrade(currentChild?.birthday);
  const dimMapping = GRADE_DIM_MAPPING[grade] || GRADE_DIM_MAPPING[3];

  // 维度 ID→code 映射
  const dimIdToCode = new Map<number, string>();
  dimensions.forEach((d) => dimIdToCode.set(d.id, d.code));

  // 判断单个任务属于哪个维度 Tab
  const getTaskDimTab = (task: Task): DimTab | null => {
    if (!task.ability_dimension_id) return null;
    // 主题周激活时,主题维任务归入 theme tab
    if (themeActive && themeDimId && task.ability_dimension_id === themeDimId) return 'theme';
    const code = dimIdToCode.get(task.ability_dimension_id);
    if (!code) return null;
    if (dimMapping.primary.includes(code)) return 'primary';
    if (dimMapping.secondary.includes(code)) return 'secondary';
    if (dimMapping.latent.includes(code)) return 'latent';
    return null;
  };

  // 主题周关闭时,若 dimTab=='theme' 应回退到 'all'
  useEffect(() => {
    if (!themeActive && dimTab === 'theme') {
      setDimTab('all');
    }
  }, [themeActive, dimTab]);

  // 是否存在拓展任务(有 ability_dimension_id 的任务),决定是否显示维度 Tab
  const hasExtTasks = tasks.some((t) => t.ability_dimension_id);

  const filteredTasks = tasks.filter((task) => {
    if (categoryTab !== 'all' && task.category !== categoryTab) return false;
    if (dimTab !== 'all') {
      const tab = getTaskDimTab(task);
      if (tab !== dimTab) return false;
    }
    return true;
  });

  const childrenList = useChildStore.getState().children;

  const inProgressCount = tasks.filter((t) => t.status === 1).length;
  const submittedCount = tasks.filter((t) => t.status === 2).length;
  const completedCount = tasks.filter((t) => t.status === 3).length;

  const categoryStats = tasks.reduce((acc, task) => {
    const cat = task.category || '其他';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!currentChild) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-text-primary font-medium">暂无孩子档案</div>
          <p className="text-sm text-text-tertiary mt-2">请先添加孩子</p>
          <button
            onClick={() => navigate('/family')}
            className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            添加孩子
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* 顶部一级 Tab:📘 今日任务(默认) / 📅 周期课程表(家长专属) */}
      <div className="px-4 pt-3">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-2 bg-card rounded-2xl p-1 shadow-sm">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium bg-primary text-white shadow"
            >
              <span>📘</span>
              <span>今日任务</span>
            </button>
            <button
              onClick={() => isParent && navigate('/cycle-plan')}
              disabled={!isParent}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all ${
                !isParent ? 'text-text-tertiary opacity-60 cursor-not-allowed' : 'text-text-secondary hover:bg-gray-50'
              }`}
              title={isParent ? '查看周期课程表' : '仅家长可查看'}
            >
              <span>📅</span>
              <span>周期课程表</span>
            </button>
          </div>
        </div>
      </div>

      {/* 周期概览卡(按 cycle_length_weeks 显示进度条 + 完成率 + 预计积分) */}
      {(cycleLoading || cyclePreview) && (
        <div className="px-4 mt-3">
          <div className="max-w-lg mx-auto">
            <div className="bg-card rounded-2xl p-4 shadow-sm">
              {cycleLoading ? (
                <div className="text-center text-text-tertiary text-sm py-3">周期概览加载中...</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">周期概览</div>
                      <div className="text-xs text-text-tertiary mt-0.5">
                        {completedWeeks}/{cycleLengthWeeks} 周
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">{completionRate}%</div>
                      <div className="text-xs text-text-tertiary">完成率</div>
                    </div>
                  </div>

                  {/* 周进度条 */}
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 mb-3">
                    <div
                      className="bg-primary transition-all"
                      style={{ width: `${(completedWeeks / Math.max(1, cycleLengthWeeks)) * 100}%` }}
                    />
                  </div>

                  {/* 维度占比条(主维/次维/潜维 3 色横条) */}
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
                    <div className="bg-primary" style={{ width: `${mainPct}%` }} title={`主维 ${mainPct}%`} />
                    <div className="bg-blue-300" style={{ width: `${secondaryPct}%` }} title={`次维 ${secondaryPct}%`} />
                    <div className="bg-purple-300" style={{ width: `${latentPct}%` }} title={`潜维 ${latentPct}%`} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-text-secondary">主维 {mainPct}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-300" />
                      <span className="text-text-secondary">次维 {secondaryPct}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-300" />
                      <span className="text-text-secondary">潜维 {latentPct}%</span>
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-primary font-medium">
                      <span className="text-text-tertiary">预计积分</span>
                      <span>{completedPoints}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-6 px-4 rounded-b-3xl mt-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">任务列表</h1>
              <p className="text-white/80 text-sm mt-0.5">
                {currentChild.nickname} 的所有任务
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isParent && (
                <>
                  <button
                    onClick={() => setShowAcademicModal(true)}
                    className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
                    title="录一件学业上的好事（发积分）"
                  >
                    <span>📚</span>
                    <span className="hidden sm:inline">录好事</span>
                  </button>
                  <button
                    onClick={() => setShowTrendModal(true)}
                    className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
                    title="记录作业/测验档位（影响AI任务推荐）"
                  >
                    <span>📝</span>
                    <span className="hidden sm:inline">记学习</span>
                  </button>
                </>
              )}
              <button
                onClick={() => navigate('/tasks/new')}
                className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
              >
                <Plus size={16} /> 新建
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-5">
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-white text-2xl font-bold">{tasks.length}</div>
              <div className="text-white/70 text-xs mt-0.5">全部</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-white text-2xl font-bold">{inProgressCount}</div>
              <div className="text-white/70 text-xs mt-0.5">进行中</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-yellow-200 text-2xl font-bold">{submittedCount}</div>
              <div className="text-white/70 text-xs mt-0.5">待验收</div>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl p-3 text-center">
              <div className="text-emerald-200 text-2xl font-bold">{completedCount}</div>
              <div className="text-white/70 text-xs mt-0.5">已完成</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-2 mb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-2 overflow-x-auto bg-card rounded-2xl p-1 shadow-sm">
            {STATUS_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={String(tab.id)}
                  onClick={() => setStatusTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl whitespace-nowrap text-xs font-medium transition-all flex-1 justify-center ${
                    statusTab === tab.id
                      ? 'bg-primary text-white shadow'
                      : 'text-text-secondary hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="max-w-lg mx-auto">
          <div className="flex gap-2 overflow-x-auto bg-bg rounded-xl p-1">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = categoryTab === tab.id;
              return (
                <button
                  key={String(tab.id)}
                  onClick={() => setCategoryTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white shadow-sm text-text-primary'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-white/50'
                  }`}
                >
                  <Icon size={14} className={isActive ? tab.color : ''} />
                  <span>{tab.label}</span>
                  {tab.id !== 'all' && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-text-tertiary'}`}>
                      {categoryStats[tab.id] || 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 维度分 Tab(仅当存在拓展任务时显示):全部 / 主维 / 次维 / 潜维 / 🌟主题周(激活时显示) */}
      {hasExtTasks && (
        <div className="px-4 mb-4">
          <div className="max-w-lg mx-auto">
            <div className="flex gap-2 overflow-x-auto bg-bg rounded-xl p-1">
              {([
                { id: 'all' as const, label: '全部' },
                { id: 'primary' as const, label: '主维' },
                { id: 'secondary' as const, label: '次维' },
                { id: 'latent' as const, label: '潜维' },
                ...(themeActive ? [{ id: 'theme' as const, label: `🌟${themeTitle}主题周` }] : []),
              ]).map((tab) => {
                const isActive = dimTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setDimTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap text-xs font-medium transition-all ${
                      isActive
                        ? tab.id === 'theme'
                          ? 'bg-white shadow-sm text-yellow-700'
                          : 'bg-white shadow-sm text-text-primary'
                        : tab.id === 'theme'
                        ? 'text-yellow-600 hover:bg-white/50'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-white/50'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 max-w-lg mx-auto">
        {filteredTasks.length > 0 ? (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              // 锚任务徽标:每日保底(根据 frequency==='daily' 判断,后端 task_kind 未回填时的近似)
              const isDailyAnchor = task.frequency === 'daily' || task.task_kind === 'daily_fixed';
              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/task/${task.id}`)}
                  className="cursor-pointer bg-card rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-primary">{task.title}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {isDailyAnchor && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap">
                            🛡️ 每日保底
                          </span>
                        )}
                        {task.category && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${(() => {
                            const catConfig = CATEGORY_TABS.find((c) => c.id === task.category);
                            if (catConfig) {
                              if (catConfig.id === '学习') return 'bg-blue-50 text-blue-500';
                              if (catConfig.id === '家务') return 'bg-emerald-50 text-emerald-500';
                              if (catConfig.id === '行为习惯') return 'bg-amber-50 text-amber-500';
                              if (catConfig.id === '运动') return 'bg-rose-50 text-rose-500';
                              return 'bg-purple-50 text-purple-500';
                            }
                            return 'bg-gray-100 text-text-tertiary';
                          })()}`}>
                            {task.category}
                          </span>
                        )}
                        <span className="text-xs text-text-tertiary">
                          {task.status === 1 ? '进行中' : task.status === 2 ? '待验收' : task.status === 3 ? '已完成' : '已拒绝'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      {/* 主题周金色徽标(主题周激活时,每个任务卡片右上角显示) */}
                      {themeActive && (
                        <div className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium mb-1 whitespace-nowrap">
                          🌟{themeTitle}主题周
                        </div>
                      )}
                      <span className="text-sm font-semibold text-primary">+{task.points}</span>
                      <span className="text-xs text-text-tertiary">积分</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-2xl shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-3xl">📋</span>
            </div>
            <p className="text-text-primary font-medium">暂无任务</p>
            <p className="text-text-tertiary text-sm mt-1">
              {currentChild.nickname} 这个分类下没有任务
            </p>
            <button
              onClick={() => navigate('/tasks/new')}
              className="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-xl hover:bg-primary-dark transition-colors"
            >
              发布任务
            </button>
          </div>
        )}
      </div>

      <div className="fixed bottom-24 right-4 flex flex-col items-center gap-3 z-40">
        {/* V3.1 模块 D：录一件学业上的好事（圆形小按钮） + 记学习档位 */}
        {isParent && (
          <button
            onClick={() => setShowTrendModal(true)}
            className="w-12 h-12 bg-blue-500 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center"
            title="记录学习档位（影响AI任务推荐）"
            aria-label="记录学习档位"
          >
            <span className="text-xl leading-none">📝</span>
          </button>
        )}
        {isParent && (
          <button
            onClick={() => setShowAcademicModal(true)}
            className="w-12 h-12 bg-amber-500 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-amber-600 transition-all flex items-center justify-center"
            title="录一件学业上的好事（发积分）"
            aria-label="录一件学业上的好事"
          >
            <span className="text-xl leading-none">📚</span>
          </button>
        )}
        <button
          onClick={() => navigate('/tasks/new')}
          className="w-14 h-14 bg-primary text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* 学业里程碑录入弹窗 */}
      <AcademicMilestoneModal
        open={showAcademicModal}
        childId={currentChild?.id ?? null}
        onClose={() => setShowAcademicModal(false)}
      />

      {/* 学习档位录入弹窗 */}
      <AcademicTrendModal
        open={showTrendModal}
        childId={currentChild?.id ?? null}
        onClose={() => setShowTrendModal(false)}
      />
    </div>
  );
}

export default TaskListPage;
