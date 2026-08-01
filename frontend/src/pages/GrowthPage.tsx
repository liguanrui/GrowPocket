import { useState, useEffect } from 'react';
import { ChevronRight, Share2, Sparkles, Image, FileText, Send, X, Target, Check, Sliders, History, BookOpen, ArrowRight, Gift } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import type { Child } from '../stores/childStore';
import { useAuthStore } from '../stores/authStore';
import { ChildTabs } from '../components/ChildTabs';
import * as tasksService from '../services/tasks';
import type { Task } from '../services/tasks';
import * as communityService from '../services/community';
import { getChildScores, getGrowthIndex, getAbilities } from '../services/ability';
import type { ChildAbilityScore, AbilityDimension } from '../services/ability';
import { IPPAvatar } from '../components/IPPAvatar';
import { getCurrentCycle, setGoal, createCycle, updateCycle } from '../services/growthCycle';
import type { DimensionProgress } from '../services/growthCycle';
import { listStories, parseAbilitySummary } from '../services/growthStory';
import type { GrowthStory } from '../services/growthStory';
import { useToastStore } from '../stores/toastStore';

// 维度颜色映射
const DIMENSION_COLORS = ['#10b981', '#6DBF7B', '#5B9BD5', '#F0B848', '#E87461'];

function getDimensionColor(index: number): string {
  return DIMENSION_COLORS[index % DIMENSION_COLORS.length];
}

function getLevelInfo(growthIndex: number) {
  if (growthIndex < 20) return { level: 1, name: '种子期' };
  if (growthIndex < 40) return { level: 2, name: '萌芽期' };
  if (growthIndex < 60) return { level: 3, name: '小苗期' };
  if (growthIndex < 80) return { level: 4, name: '小树期' };
  return { level: 5, name: '大树期' };
}

// 原生 SVG 五维雷达图
function RadarChartSVG({ scores }: { scores: ChildAbilityScore[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 70;
  const labelRadius = 90;
  const levels = [maxRadius, maxRadius * 2 / 3, maxRadius / 3];
  const n = scores.length;
  const angles = Array.from({ length: n }, (_, i) => -90 + (360 / n) * i);

  function getPoint(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function polygonPoints(radius: number) {
    return angles.map(a => {
      const p = getPoint(a, radius);
      return `${p.x},${p.y}`;
    }).join(' ');
  }

  const dataPoints = scores.map((s, i) => {
    const radius = (Math.max(0, Math.min(100, s.score)) / 100) * maxRadius;
    return getPoint(angles[i], radius);
  });
  const dataPolygonStr = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={180} height={180} viewBox={`0 0 ${size} ${size}`}>
      {/* 三层同心五边形网格 */}
      {levels.map((r, i) => (
        <polygon key={i} points={polygonPoints(r)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {/* 五条轴线 */}
      {angles.map((a, i) => {
        const p = getPoint(a, maxRadius);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {/* 数据多边形 */}
      {n > 0 && (
        <>
          <polygon points={dataPolygonStr} fill="rgba(126, 200, 80, 0.15)" stroke="#7EC850" strokeWidth="2" />
          {/* 数据点 */}
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill="#7EC850" />
          ))}
        </>
      )}
      {/* 轴标签：维度名+分数 */}
      {scores.map((s, i) => {
        const p = getPoint(angles[i], labelRadius);
        return (
          <text key={i} x={p.x} y={p.y} fontSize="10" fill="#6b7280" textAnchor="middle" dominantBaseline="middle">
            {s.dimension_name} {s.score}
          </text>
        );
      })}
    </svg>
  );
}

function ShareModal({
  onClose,
  child,
  tasks,
  photos,
}: {
  onClose: () => void;
  child: Child;
  tasks: Task[];
  photos: string[];
}) {
  const [shareType, setShareType] = useState<'text' | 'text_image' | 'text_task'>('text');
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const MAX_IMAGES = 9;

  const completedTasks = tasks.filter((t) => t.status === 3);

  useEffect(() => {
    if (shareType === 'text_task' && selectedTaskId) {
      const task = completedTasks.find((t) => t.id === selectedTaskId);
      if (task) {
        const defaultContent = `我家宝宝（${child.nickname}）完成了${task.title}，表现棒棒哒`;
        if (!content.trim() || content.startsWith('我家宝宝（')) {
          setContent(defaultContent);
        }
        if (task.photo && !selectedImages.includes(task.photo)) {
          setSelectedImages([task.photo]);
        }
      }
    }
  }, [shareType, selectedTaskId, child.nickname, completedTasks]);

  const toggleImage = (photo: string) => {
    if (selectedImages.includes(photo)) {
      setSelectedImages(selectedImages.filter((p) => p !== photo));
    } else if (selectedImages.length < MAX_IMAGES) {
      setSelectedImages([...selectedImages, photo]);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const task = selectedTaskId ? completedTasks.find((t) => t.id === selectedTaskId) : null;

      await communityService.createShare({
        share_type: shareType,
        content: content.trim(),
        photos: selectedImages.length > 0 ? selectedImages : undefined,
        task_id: task?.id,
        task_title: task?.title,
        task_points: task?.points,
        child_name: child.nickname,
      });

      onClose();
    } catch (e: any) {
      console.error('分享失败:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTypeChange = (type: 'text' | 'text_image' | 'text_task') => {
    setShareType(type);
    if (type === 'text') {
      setSelectedImages([]);
      setSelectedTaskId(null);
    } else if (type === 'text_image') {
      setSelectedTaskId(null);
    } else if (type === 'text_task') {
      setSelectedImages([]);
      setContent('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-24 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary text-lg">分享成长</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { id: 'text' as const, label: '文字', icon: FileText },
            { id: 'text_image' as const, label: '图文', icon: Image },
            { id: 'text_task' as const, label: '任务', icon: Sparkles },
          ].map((type) => {
            const Icon = type.icon;
            const isActive = shareType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => handleTypeChange(type.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
                  isActive ? 'bg-primary text-white' : 'bg-gray-100 text-text-secondary'
                }`}
              >
                <Icon size={16} />
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={shareType === 'text_task' ? '分享孩子的成长喜悦...' : '分享孩子的成长故事...'}
          rows={4}
          className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-text-primary text-sm resize-none"
        />

        {shareType === 'text_image' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-text-primary mb-2">
              选择图片 <span className="text-text-tertiary">({selectedImages.length}/{MAX_IMAGES})</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, idx) => {
                const isSelected = selectedImages.includes(url);
                const selectedIndex = selectedImages.indexOf(url);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleImage(url)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all relative ${
                      isSelected ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{selectedIndex + 1}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {photos.length === 0 && (
              <p className="text-sm text-text-tertiary text-center py-4">暂无图片，请先完成任务并上传照片</p>
            )}
          </div>
        )}

        {shareType === 'text_task' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-text-primary mb-2">选择完成的任务</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {completedTasks.length === 0 ? (
                <p className="text-sm text-text-tertiary text-center py-4">暂无已完成的任务</p>
              ) : (
                completedTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      if (selectedTaskId === task.id) {
                        setSelectedTaskId(null);
                        setContent('');
                        setSelectedImages([]);
                      } else {
                        setSelectedTaskId(task.id);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-colors flex items-center justify-between ${
                      selectedTaskId === task.id ? 'bg-primary/10 border border-primary' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {task.photo && (
                        <img src={task.photo} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-text-primary">{task.title}</div>
                        <div className="text-xs text-text-tertiary">+{task.points} 积分</div>
                      </div>
                    </div>
                    {selectedTaskId === task.id && <Sparkles size={16} className="text-primary" />}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!content.trim() || submitting || (shareType === 'text_task' && !selectedTaskId)}
          className="w-full mt-6 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={16} />
          {submitting ? '发布中...' : '发布分享'}
        </button>
      </div>
    </div>
  );
}

export function GrowthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const childStore = useChildStore();
  const authStore = useAuthStore();
  const isParent = authStore.user?.role === 'parent';
  const toast = useToastStore();
  const [scores, setScores] = useState<ChildAbilityScore[]>([]);
  const [growthIndex, setGrowthIndex] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [stories, setStories] = useState<GrowthStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 阶段目标相关
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [progressList, setProgressList] = useState<DimensionProgress[]>([]);
  const [cycleName, setCycleName] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');
  const [cycleEndDate, setCycleEndDate] = useState('');
  const [dimensions, setDimensions] = useState<AbilityDimension[]>([]);
  // 阶段目标设置面板
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [setupStartDate, setSetupStartDate] = useState('');
  const [setupEndDate, setSetupEndDate] = useState('');
  const [setupGoals, setSetupGoals] = useState<Record<number, number>>({});
  const [goalSubmitting, setGoalSubmitting] = useState(false);

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
      if (!selectedChildId) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [scoresResult, growthIndexResult, tasksResult, cycleResult, dimsResult, storiesResult] = await Promise.all([
          getChildScores(selectedChildId),
          getGrowthIndex(selectedChildId),
          tasksService.getTasks({ childId: selectedChildId, page: 1, pageSize: 100 }),
          getCurrentCycle(selectedChildId),
          getAbilities(),
          listStories(selectedChildId, 1, 20),
        ]);
        if (mounted) {
          setScores(scoresResult);
          setGrowthIndex(growthIndexResult);
          setTasks(tasksResult.items);
          setStories(storiesResult.items);
          setDimensions(dimsResult);
          if (cycleResult.cycle) {
            setCycleId(cycleResult.cycle.id);
            setCycleName(cycleResult.cycle.name);
            setCycleStartDate(cycleResult.cycle.start_date);
            setCycleEndDate(cycleResult.cycle.end_date);
            setProgressList(cycleResult.progress || []);
          } else {
            setCycleId(null);
            setProgressList([]);
          }
        }
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
  }, [selectedChildId]);

  useEffect(() => {
    if (children.length === 0) {
      childStore.fetchChildren();
    }
  }, [children.length, childStore]);

  const handleChildSelect = (id: number) => {
    setSelectedChildId(id);
    childStore.setCurrentChildId(id);
  };

  // 打开阶段目标设置面板
  const openGoalSetup = () => {
    if (cycleId) {
      setSetupStartDate(cycleStartDate.slice(0, 10));
      setSetupEndDate(cycleEndDate.slice(0, 10));
      const goalsMap: Record<number, number> = {};
      progressList.forEach((p) => {
        if (p.target_score > 0) goalsMap[p.dimension_id] = p.target_score;
      });
      setSetupGoals(goalsMap);
    } else {
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      setSetupStartDate(now.toISOString().slice(0, 10));
      setSetupEndDate(end.toISOString().slice(0, 10));
      setSetupGoals({});
    }
    setShowGoalSetup(true);
  };

  // 提交阶段目标设置
  const handleSaveGoalSetup = async () => {
    if (!selectedChildId) return;
    if (!setupStartDate || !setupEndDate) {
      toast.error('请选择时间区间');
      return;
    }
    const goalEntries = Object.entries(setupGoals).filter(([, v]) => v > 0);
    if (goalEntries.length === 0) {
      toast.error('请至少为一个维度设置目标');
      return;
    }
    setGoalSubmitting(true);
    try {
      const startISO = new Date(setupStartDate + 'T00:00:00').toISOString();
      const endISO = new Date(setupEndDate + 'T23:59:59').toISOString();
      const name = `${setupStartDate.slice(5)}-${setupEndDate.slice(5)} 成长阶段`;

      let finalCycleId = cycleId;
      if (!finalCycleId) {
        const cycle = await createCycle(selectedChildId, name, startISO, endISO);
        finalCycleId = cycle.id;
      } else {
        await updateCycle(finalCycleId, name, startISO, endISO);
      }
      for (const [dimId, target] of goalEntries) {
        await setGoal(finalCycleId!, selectedChildId, Number(dimId), target);
      }
      toast.success('阶段目标已保存');
      setShowGoalSetup(false);
      const cycleResult = await getCurrentCycle(selectedChildId);
      if (cycleResult.cycle) {
        setCycleId(cycleResult.cycle.id);
        setCycleName(cycleResult.cycle.name);
        setCycleStartDate(cycleResult.cycle.start_date);
        setCycleEndDate(cycleResult.cycle.end_date);
        setProgressList(cycleResult.progress || []);
      }
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setGoalSubmitting(false);
    }
  };

  // 综合进度计算
  const overallProgress = progressList.length > 0
    ? Math.round(progressList.reduce((sum, p) => sum + p.progress, 0) / progressList.length)
    : 0;
  const completedDimensions = progressList.filter(p => p.progress >= 100).length;
  const levelInfo = getLevelInfo(growthIndex);
  const stageLabel = cycleName || '未设置阶段';
  const goalText = progressList.length > 0
    ? `提升${progressList.map(p => p.dimension_name).join('、')}能力`
    : '为孩子的成长设定阶段性目标';

  // 是否已设置目标（有周期且至少一个维度有目标分）
  const hasGoals = !!cycleId && progressList.some(p => p.target_score > 0);
  // 是否存在未达标的目标
  const hasUncompletedGoals = progressList.some(p => p.target_score > 0 && p.progress < 100);
  // 阶段时间区间内是否有已完成任务
  const hasCompletedTasksInCycle = (() => {
    if (!cycleStartDate || !cycleEndDate) return false;
    const start = new Date(cycleStartDate).getTime();
    const end = new Date(cycleEndDate).getTime();
    return tasks.some(t => {
      if (t.status !== 3) return false;
      const taskDate = new Date(t.updated_at || t.created_at).getTime();
      return taskDate >= start && taskDate <= end;
    });
  })();

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

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header：绿色渐变 */}
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 pt-8 pb-10 px-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-white">成长记录</h1>
              <p className="text-white/80 text-sm mt-0.5">记录每一个成长瞬间</p>
            </div>
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/20 text-white text-sm rounded-xl hover:bg-white/30 transition-colors"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">分享</span>
            </button>
          </div>
          <ChildTabs children={children} selectedId={selectedChild.id} onSelect={handleChildSelect} />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3">
        {/* 1. 阶段目标（三按钮 + 单一进度条 + 阶段标签） */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">阶段目标</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {stageLabel}
              </span>
            </div>
            <button
              onClick={() => navigate(`/growth/stories?child_id=${selectedChild.id}`)}
              className="flex items-center gap-1 text-xs text-text-tertiary hover:text-primary transition-colors"
            >
              查看详情
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 目标文本 */}
          <p className="text-sm text-text-tertiary mt-3">{goalText}</p>

          {/* 单一进度条 */}
          <div className="mt-3">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, overallProgress)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs text-text-tertiary">进度 {overallProgress}%</span>
              <span className="text-xs text-primary font-medium">
                {completedDimensions}/{progressList.length} 维度达标
              </span>
            </div>
          </div>

          {/* 按钮区：无目标时只显示「设置目标」，有目标时显示「调整目标」+「触发回顾」 */}
          {isParent && (
            <div className="flex gap-2 mt-4">
              {!hasGoals ? (
                <button
                  onClick={openGoalSetup}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors"
                >
                  <Target size={15} />
                  设置目标
                </button>
              ) : (
                <>
                  <button
                    onClick={openGoalSetup}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-card border border-gray-200 text-text-primary hover:bg-gray-50 transition-colors"
                  >
                    <Sliders size={15} />
                    调整目标
                  </button>
                  <button
                    onClick={() => {
                      if (!hasUncompletedGoals) {
                        toast.error('当前所有目标已达标，无需触发回顾');
                        return;
                      }
                      if (!hasCompletedTasksInCycle) {
                        toast.error('该阶段尚无已完成的任务数据，无法回顾');
                        return;
                      }
                      navigate(`/growth/story?child_id=${selectedChild.id}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors"
                  >
                    <History size={15} />
                    触发回顾
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 2. 成长维度图（SVG雷达图 + IP等级 + 维度评分列表） */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">成长维度</h2>
            <span className="text-xs text-text-tertiary">
              {new Date().toLocaleDateString()} 更新
            </span>
          </div>

          {scores.length > 0 ? (
            <>
              {/* 雷达图 + IP 形象区 */}
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0">
                  <RadarChartSVG scores={scores} />
                </div>
                <div className="flex-1 flex flex-col items-center gap-2">
                  <IPPAvatar growthIndex={growthIndex} expression="proud" size={64} />
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    Lv.{levelInfo.level} {levelInfo.name}
                  </span>
                  <span className="text-xs text-text-tertiary">成长值 {selectedChild.balance}</span>
                </div>
              </div>

              {/* 维度评分列表 */}
              <div
                className="grid gap-1 mt-3"
                style={{ gridTemplateColumns: `repeat(${scores.length}, 1fr)` }}
              >
                {scores.map((s, i) => (
                  <div key={s.dimension_id} className="flex flex-col items-center gap-0.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getDimensionColor(i) }}
                    />
                    <span className="text-xs font-semibold text-text-primary">{s.score}</span>
                    <span className="text-[10px] text-text-tertiary">{s.dimension_name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-tertiary text-sm">
              <div className="text-center">
                <Sparkles size={32} className="mx-auto mb-2 text-gray-300" />
                完成任务后展示能力成长
              </div>
            </div>
          )}
        </div>

        {/* 3. 积分兑换（增强入口卡片） */}
        <div
          className="rounded-2xl p-4 shadow-sm mb-3 border border-gray-100"
          style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #FFFFFF 100%)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Gift size={20} className="text-primary" />
                <h2 className="text-sm font-semibold text-text-primary">积分兑换</h2>
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-bold text-primary">{selectedChild.balance}</span>
                <span className="text-sm text-text-tertiary">积分</span>
              </div>
              <p className="text-xs text-text-tertiary mt-1">用积分兑换心仪奖励</p>
            </div>
            <button
              onClick={() => navigate(`/mall?child_id=${selectedChild.id}`)}
              className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors"
            >
              进入兑换
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* 4. 成长故事预览（2条预览 + 查看全部） */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-text-primary">成长故事</h2>
            </div>
            <button
              onClick={() => navigate(`/growth/stories?child_id=${selectedChild.id}`)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors"
            >
              查看全部
              <ChevronRight size={14} />
            </button>
          </div>

          {stories.length > 0 ? (
            <div className="space-y-2">
              {stories.slice(0, 2).map((s) => {
                const deltas = parseAbilitySummary(s.ability_summary);
                const dimLabel = deltas.length > 0 ? deltas[0].dimension_name : '综合';
                const previewText = s.content.replace(/[#*\-]/g, '').slice(0, 60);
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/growth/story?cycle_id=${s.cycle_id}&child_id=${selectedChild.id}`)}
                    className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {dimLabel}
                      </span>
                      <span className="text-xs text-text-tertiary">
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-text-primary line-clamp-1">{s.title}</div>
                    <div className="text-xs text-text-tertiary line-clamp-1 mt-0.5">{previewText}</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-text-tertiary text-sm">
              <BookOpen size={32} className="mx-auto mb-2 text-gray-300" />
              还没有成长故事记录
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>

      {showShareModal && (
        <ShareModal
          onClose={() => setShowShareModal(false)}
          child={selectedChild}
          tasks={tasks}
          photos={tasks.filter((t) => t.photo).map((t) => t.photo!)}
        />
      )}

      {/* 阶段目标设置面板 */}
      {showGoalSetup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-text-primary">
                {cycleId ? '调整阶段目标' : '设置阶段目标'}
              </h3>
              <button
                onClick={() => setShowGoalSetup(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* 时间区间 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-text-primary mb-2">阶段时间区间</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={setupStartDate}
                  onChange={(e) => setSetupStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-text-primary"
                />
                <span className="text-text-tertiary">~</span>
                <input
                  type="date"
                  value={setupEndDate}
                  onChange={(e) => setSetupEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-text-primary"
                />
              </div>
              <p className="text-xs text-text-tertiary mt-1.5">阶段结束时将触发成长回顾</p>
            </div>

            {/* 多维度目标 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-text-primary mb-2">
                维度目标（可多选）
              </label>
              <p className="text-xs text-text-tertiary mb-3">
                AI 将基于目标和累计完成情况每日自动生成任务
              </p>
              <div className="space-y-2">
                {dimensions.map((dim) => {
                  const currentScore = scores.find((s) => s.dimension_id === dim.id)?.score || 0;
                  const target = setupGoals[dim.id] || 0;
                  return (
                    <div key={dim.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <button
                        onClick={() => {
                          setSetupGoals((prev) => {
                            const next = { ...prev };
                            if (target > 0) {
                              delete next[dim.id];
                            } else {
                              next[dim.id] = 20;
                            }
                            return next;
                          });
                        }}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          target > 0 ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {target > 0 && <Check size={14} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary">{dim.name}</div>
                        <div className="text-xs text-text-tertiary">当前 {currentScore} 分</div>
                      </div>
                      {target > 0 && (
                        <select
                          value={target}
                          onChange={(e) =>
                            setSetupGoals((prev) => ({ ...prev, [dim.id]: Number(e.target.value) }))
                          }
                          className="px-2 py-1 bg-white rounded-lg border border-gray-200 text-sm text-text-primary"
                        >
                          {[10, 20, 30, 40, 50, 60, 80, 100].map((v) => (
                            <option key={v} value={v}>
                              目标 {v}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowGoalSetup(false)}
                className="flex-1 py-3 bg-gray-100 text-text-secondary rounded-xl font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSaveGoalSetup}
                disabled={goalSubmitting}
                className="flex-1 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {goalSubmitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GrowthPage;
