import { useState, useEffect } from 'react';
import { Trophy, Star, ChevronLeft, ChevronRight, Share2, Sparkles, Image, FileText, Send, X, ChevronDown, Plus, Target, Check } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
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
            { id: 'text_task' as const, label: '任务', icon: Star },
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
                    {selectedTaskId === task.id && <Star size={16} className="text-primary" />}
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

function SectionHeader({
  icon: Icon,
  title,
  count,
  onToggle,
  expanded,
}: {
  icon: any;
  title: string;
  count: number;
  onToggle?: () => void;
  expanded?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Icon size={16} />
        </div>
        <h2 className="font-semibold text-text-primary">{title}</h2>
        <span className="text-xs text-text-tertiary bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      {onToggle && (
        <button
          onClick={onToggle}
          className="flex items-center gap-1 text-sm text-text-tertiary hover:text-primary transition-colors"
        >
          <span>{expanded ? '收起' : '更多'}</span>
          <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

export function GrowthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const childStore = useChildStore();
  const authStore = useAuthStore();
  const isParent = authStore.user?.role === 'parent';
  const [scores, setScores] = useState<ChildAbilityScore[]>([]);
  const [growthIndex, setGrowthIndex] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [stories, setStories] = useState<GrowthStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 阶段目标相关
  const toast = useToastStore();
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
  const [setupGoals, setSetupGoals] = useState<Record<number, number>>({}); // dimension_id -> target_score
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
          tasksService.getTasks({ childId: selectedChildId, page: 1, pageSize: 20 }),
          getCurrentCycle(selectedChildId),
          getAbilities(),
          listStories(selectedChildId, 1, 20),
        ]);
        if (mounted) {
          setScores(scoresResult);
          setGrowthIndex(growthIndexResult);
          setTasks(tasksResult.items);
          setTasksTotal(tasksResult.total);
          setStories(storiesResult.items);
          setDimensions(dimsResult);
          // 阶段目标数据
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
      // 编辑模式：加载当前周期时间区间和已有目标
      setSetupStartDate(cycleStartDate.slice(0, 10));
      setSetupEndDate(cycleEndDate.slice(0, 10));
      const goalsMap: Record<number, number> = {};
      progressList.forEach((p) => {
        if (p.target_score > 0) goalsMap[p.dimension_id] = p.target_score;
      });
      setSetupGoals(goalsMap);
    } else {
      // 创建模式：默认 30 天周期
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      setSetupStartDate(now.toISOString().slice(0, 10));
      setSetupEndDate(end.toISOString().slice(0, 10));
      setSetupGoals({});
    }
    setShowGoalSetup(true);
  };

  // 提交阶段目标设置（时间区间 + 多维度目标）
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
        // 创建周期
        const cycle = await createCycle(selectedChildId, name, startISO, endISO);
        finalCycleId = cycle.id;
      } else {
        // 更新周期时间区间
        await updateCycle(finalCycleId, name, startISO, endISO);
      }
      // 批量设置维度目标
      for (const [dimId, target] of goalEntries) {
        await setGoal(finalCycleId!, selectedChildId, Number(dimId), target);
      }
      toast.success('阶段目标已保存');
      setShowGoalSetup(false);
      // 重新加载
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

  const cycleDays = cycleStartDate && cycleEndDate
    ? Math.max(1, Math.ceil((new Date(cycleEndDate).getTime() - new Date(cycleStartDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

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

          <div className="bg-white/15 backdrop-blur rounded-2xl p-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white/80 text-xs">孩子</div>
                <div className="text-white font-semibold text-lg mt-0.5">{selectedChild.nickname}</div>
              </div>
              <div className="text-right">
                <div className="text-white/80 text-xs">累计积分</div>
                <div className="text-white text-2xl font-bold mt-0.5">{selectedChild.balance}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
              <div className="flex-1 text-center">
                <div className="text-white font-bold text-lg">{growthIndex}</div>
                <div className="text-white/70 text-xs">成长指数</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-white font-bold text-lg">{tasksTotal}</div>
                <div className="text-white/70 text-xs">累计任务</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-white font-bold text-lg">{cycleDays}</div>
                <div className="text-white/70 text-xs">阶段天数</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3">
        {/* 能力雷达图 Section */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles size={16} />
              </div>
              <h2 className="font-semibold text-text-primary">能力成长</h2>
            </div>
            <div className="text-right">
              <div className="text-xs text-text-tertiary">成长指数</div>
              <div className="text-xl font-bold text-primary">{growthIndex}</div>
            </div>
          </div>
          <div className="w-full h-64">
            {scores.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={scores}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="dimension_name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                  <Radar
                    name="能力"
                    dataKey="score"
                    stroke="#7EC850"
                    fill="#7EC850"
                    fillOpacity={0.4}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-text-tertiary text-sm">
                <div className="text-center">
                  <Sparkles size={32} className="mx-auto mb-2 text-gray-300" />
                  完成任务后展示能力成长
                </div>
              </div>
            )}
          </div>
          {/* IP 形态（Task 11 实现） */}
          <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-primary/5 rounded-xl">
            <IPPAvatar growthIndex={growthIndex} expression="proud" size={40} />
            <div className="text-sm text-text-secondary">
              {growthIndex < 20 ? '种子阶段' : growthIndex < 40 ? '萌芽阶段' : growthIndex < 60 ? '小苗阶段' : growthIndex < 80 ? '小树阶段' : '大树阶段'}
            </div>
          </div>
        </div>

        {/* 阶段目标 Section */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                <Target size={16} />
              </div>
              <h2 className="font-semibold text-text-primary">阶段目标</h2>
            </div>
            {cycleId && cycleEndDate && (
              <div className="text-xs text-text-tertiary">
                {cycleStartDate.slice(0, 10)} ~ {cycleEndDate.slice(0, 10)}
              </div>
            )}
          </div>

          {cycleId && progressList.length > 0 ? (
            <div className="space-y-3">
              {progressList.map((p) => (
                <div key={p.dimension_id} className="p-2 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-primary">{p.dimension_name}</span>
                    <span className="text-xs text-text-tertiary">
                      {p.current_score} / {p.target_score}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.progress >= 100 ? 'bg-green-500' : p.progress >= 60 ? 'bg-primary' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, p.progress)}%` }}
                    />
                  </div>
                </div>
              ))}
              {isParent && (
                <button
                  onClick={openGoalSetup}
                  className="w-full mt-2 py-2 text-sm text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
                >
                  调整阶段目标
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Target size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-text-tertiary mb-3">
                {cycleId ? '还没有设置维度目标' : '暂无成长周期'}
              </p>
              {isParent && (
                <button
                  onClick={openGoalSetup}
                  className="px-4 py-2 bg-primary text-white text-sm rounded-xl"
                >
                  设置阶段目标
                </button>
              )}
            </div>
          )}
        </div>

        {/* 积分兑换入口 */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <button
            onClick={() => navigate('/mall')}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Trophy size={20} className="text-amber-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-text-primary">积分兑换</div>
                <div className="text-xs text-text-tertiary">用积分兑换奖励</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-text-tertiary" />
          </button>
        </div>

        {/* 阶段回顾按钮（仅家长可见） */}
        {isParent && (
          <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
            <button
              onClick={() => navigate(`/growth/story?child_id=${selectedChild.id}`)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Sparkles size={20} className="text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-text-primary">阶段回顾</div>
                  <div className="text-xs text-text-tertiary">生成本阶段成长故事</div>
                </div>
              </div>
              <ChevronRight size={20} className="text-text-tertiary" />
            </button>
          </div>
        )}

        {/* 成长回顾历史时间轴 */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <SectionHeader
            icon={FileText}
            title="成长回顾历史"
            count={stories.length}
          />
          {stories.length > 0 ? (
            <div className="space-y-3">
              {stories.map((s) => {
                const deltas = parseAbilitySummary(s.ability_summary);
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/growth/story?cycle_id=${s.cycle_id}`)}
                    className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-text-primary line-clamp-1">{s.title}</span>
                      <ChevronRight size={16} className="text-text-tertiary flex-shrink-0 ml-2" />
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {new Date(s.created_at).toLocaleDateString()}
                    </div>
                    {deltas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {deltas.slice(0, 3).map((d, idx) => (
                          <span key={idx} className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                            {d.dimension_name} {d.delta >= 0 ? '+' : ''}{d.delta}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary text-sm">
              <FileText size={32} className="mx-auto mb-2 text-gray-300" />
              还没有成长回顾记录
            </div>
          )}
        </div>

        {/* 分享悬浮按钮 */}
        <button
          onClick={() => setShowShareModal(true)}
          className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-br from-primary to-amber-500 text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:shadow-xl transition-all z-40"
        >
          <Plus size={24} />
        </button>

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
