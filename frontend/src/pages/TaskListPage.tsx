import { useState, useEffect, useRef } from 'react';
import { Plus, Clock, CheckCircle2, Inbox, FileText, BookOpen, Home, Smile, Dumbbell, MoreHorizontal, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import { useUIStore } from '../stores/uiStore';
import * as tasksService from '../services/tasks';
import type { Task, TaskStatus } from '../services/tasks';
import type { TaskCategory } from '../types';
import { AcademicMilestoneModal } from '../components/AcademicMilestoneModal';
import { getTaskTags } from '../utils/taskTags';

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

export function TaskListPage() {
  const navigate = useNavigate();
  const childStore = useChildStore();
  const uiStore = useUIStore();
  const [statusTab, setStatusTab] = useState<'all' | TaskStatus>(1);
  const [categoryTab, setCategoryTab] = useState<'all' | TaskCategory>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAcademicModal, setShowAcademicModal] = useState(false);
  const loadSeqRef = useRef(0);

  const loadData = async (showLoading = true) => {
    const child = useChildStore.getState().getCurrentChild();
    if (!child) {
      if (showLoading) setLoading(false);
      return;
    }
    const reqId = ++loadSeqRef.current;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const params: { childId: number; status?: TaskStatus; taskKind: string; page: number; pageSize: number } = {
        childId: child.id,
        taskKind: 'daily,habit_daily,child,parent',
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
      // 最新请求结束必须清 loading，避免 true/false 并发顶替后一直转圈
      if (reqId === loadSeqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    childStore.fetchChildren().then(() => loadData(true));
  }, []);

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

  // 过滤分类 + 排除子任务（子任务不独立显示，跟随父任务）
  const filteredTasks = tasks.filter((task) => {
    if (task.task_kind === 'child') return false;
    if (categoryTab === 'all') return true;
    return task.category === categoryTab;
  });

  // 为主题父任务从全量 tasks 计算进度与当前进行中阶段
  const calcParentThemeMeta = (task: Task) => {
    if (task.task_kind !== 'parent') return undefined;
    const childs = tasks
      .filter((t) => t.parent_id === task.id && t.task_kind === 'child')
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    // 从 sub_task_outline 解析总阶段数（包含未实例化的）
    let outlineTotal = 0;
    if (task.sub_task_outline) {
      try {
        const outline = JSON.parse(task.sub_task_outline);
        outlineTotal = Array.isArray(outline) ? outline.length : 0;
      } catch { /* ignore */ }
    }
    const total = Math.max(outlineTotal, childs.length);
    const completed = childs.filter((c) => c.status === 3).length;
    let currentStage = childs.find((c) => c.status === 1);
    if (!currentStage) currentStage = childs.find((c) => c.status === 2);
    if (!currentStage) currentStage = childs.find((c) => c.status === 4);
    if (!currentStage) currentStage = childs.find((c) => c.status !== 3);
    return {
      isParentTheme: true as const,
      childCompletedCount: completed,
      childTotalCount: total,
      currentStageTitle: currentStage?.title,
      currentStageSequence: currentStage?.sequence,
    };
  };

  const currentChild = useChildStore.getState().getCurrentChild();
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
      <div className="bg-gradient-to-br from-primary to-primary-dark pt-6 pb-6 px-4 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">任务列表</h1>
              <p className="text-white/80 text-sm mt-0.5">
                {currentChild.nickname} 的所有任务
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAcademicModal(true)}
                className="flex items-center gap-1 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
                title="录一件学业上的好事"
              >
                <span>📚</span>
                <span className="hidden sm:inline">录好事</span>
              </button>
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

      <div className="px-4 max-w-lg mx-auto">
        {filteredTasks.length > 0 ? (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const tags = getTaskTags(task);
              const visibleTags = tags.slice(0, 3);
              const hiddenTagCount = tags.length - visibleTags.length;
              const showStreak = task.task_kind === 'habit_daily' && (task.streak_count || 0) > 0;
              const showSequence = task.task_kind === 'child' && (task.sequence || 0) > 0;
              const themeMeta = calcParentThemeMeta(task);
              const isParentTheme = !!themeMeta;
              return (
                <div
                  key={task.id}
                  onClick={() => navigate(`/task/${task.id}`)}
                  className="cursor-pointer bg-card rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="font-medium text-text-primary truncate">{task.title}</div>
                        {isParentTheme && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary flex-shrink-0">
                            主题任务
                          </span>
                        )}
                      </div>
                      {/* 统一标签区：分类 + getTaskTags + streak + sequence + 当前阶段 + 状态 */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {task.category && (
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${(() => {
                            if (task.category === '学习') return 'bg-blue-50 text-blue-600';
                            if (task.category === '家务') return 'bg-emerald-50 text-emerald-600';
                            if (task.category === '行为习惯') return 'bg-amber-50 text-amber-600';
                            if (task.category === '运动') return 'bg-rose-50 text-rose-600';
                            return 'bg-purple-50 text-purple-600';
                          })()}`}>
                            {task.category}
                          </span>
                        )}
                        {visibleTags.map((tag) => (
                          <span
                            key={tag.label}
                            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${tag.color}`}
                          >
                            {tag.label === 'AI 生成' ? (
                              <span className="inline-flex items-center gap-0.5">
                                <Sparkles size={10} />
                                {tag.label}
                              </span>
                            ) : (
                              tag.label
                            )}
                          </span>
                        ))}
                        {hiddenTagCount > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                            +{hiddenTagCount}
                          </span>
                        )}
                        {showStreak && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-600">
                            🔥 连续 {task.streak_count} 天
                          </span>
                        )}
                        {showSequence && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                            阶段 #{task.sequence}
                          </span>
                        )}
                        {isParentTheme && themeMeta?.currentStageTitle && (themeMeta.currentStageSequence || 0) > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                            阶段 #{themeMeta.currentStageSequence} · {themeMeta.currentStageTitle}
                          </span>
                        )}
                        <span className="text-[11px] text-text-tertiary">
                          {task.status === 1 ? '进行中' : task.status === 2 ? '待验收' : task.status === 3 ? '已完成' : '已拒绝'}
                        </span>
                      </div>
                      {isParentTheme && themeMeta?.currentStageTitle && (
                        <div className="text-sm text-text-tertiary mt-1.5 line-clamp-1">
                          当前进行中：{themeMeta.currentStageTitle}
                        </div>
                      )}
                    </div>
                    {isParentTheme ? (
                      <div className="text-right ml-3 flex-shrink-0">
                        <div className="text-sm font-semibold text-primary leading-tight">
                          {themeMeta?.childCompletedCount ?? 0}/{themeMeta?.childTotalCount ?? 0}
                        </div>
                        <div className="text-xs text-text-tertiary mt-0.5">阶段进度</div>
                      </div>
                    ) : (
                      <div className="text-right ml-3 flex-shrink-0">
                        <span className="text-sm font-semibold text-primary">+{task.points}</span>
                        <div className="text-xs text-text-tertiary">积分</div>
                      </div>
                    )}
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
        {/* V3.1 模块 D：录一件学业上的好事（圆形小按钮） */}
        <button
          onClick={() => setShowAcademicModal(true)}
          className="w-12 h-12 bg-amber-500 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-amber-600 transition-all flex items-center justify-center"
          title="录一件学业上的好事"
          aria-label="录一件学业上的好事"
        >
          <span className="text-xl leading-none">📚</span>
        </button>
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
    </div>
  );
}

export default TaskListPage;
