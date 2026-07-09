import { useState, useEffect, useRef } from 'react';
import { Camera, Calendar, Trophy, Star, ChevronLeft, ChevronRight, Share2, Lock, Unlock, Sparkles, Image, FileText, Send, X, ChevronDown, Plus, Medal } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useChildStore } from '../stores/childStore';
import type { Child } from '../stores/childStore';
import { ChildTabs } from '../components/ChildTabs';
import * as growthService from '../services/growth';
import type { AlbumPhoto, TimelineEvent, TimelineDay, UserAchievement } from '../services/growth';
import * as tasksService from '../services/tasks';
import type { Task } from '../services/tasks';
import * as communityService from '../services/community';

function AchievementCard({ achievement }: { achievement: UserAchievement }) {
  const { Achievement, unlocked, current_value, award_count } = achievement;
  const targetValue = Achievement.counter_target || Achievement.target_value || 0;
  const progress = Math.min((current_value / Math.max(targetValue, 1)) * 100, 100);

  return (
    <div
      className={`relative rounded-2xl p-3 transition-all ${
        unlocked
          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 shadow-lg shadow-amber-100/50'
          : 'bg-gray-50 border-2 border-gray-100'
      }`}
    >
      {unlocked && (
        <div className="absolute top-2.5 right-2.5">
          <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            {award_count > 1 ? `已获得 x${award_count}` : '已获得'}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
              unlocked
                ? 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-200/50'
                : 'bg-gray-200'
            }`}
          >
            {unlocked ? (
              <span className="drop-shadow">{Achievement.icon}</span>
            ) : (
              <Lock size={18} className="text-gray-400" />
            )}
          </div>
          {unlocked && award_count > 1 && (
            <div className="absolute -bottom-1 -right-1 bg-amber-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full shadow-sm min-w-[18px] text-center">
              x{award_count}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm ${unlocked ? 'text-amber-900' : 'text-text-secondary'}`}>
              {Achievement.name}
            </span>
          </div>
          <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{Achievement.description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={`text-xs font-bold ${unlocked ? 'text-amber-600' : 'text-primary'}`}>
              +{Achievement.points} 积分
            </span>
            {Achievement.is_custom && (
              <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                自定义
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 w-20">
          <div className="text-xs text-text-tertiary">
            <span className="font-medium text-text-secondary">{current_value}</span>
            <span className="text-text-tertiary">/{targetValue}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                unlocked
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-500'
                  : 'bg-gradient-to-r from-primary to-amber-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareModal({
  onClose,
  child,
  tasks,
  album,
}: {
  onClose: () => void;
  child: Child;
  tasks: Task[];
  album: AlbumPhoto[];
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
              {album.map((photo, idx) => {
                const isSelected = selectedImages.includes(photo.photo);
                const selectedIndex = selectedImages.indexOf(photo.photo);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleImage(photo.photo)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all relative ${
                      isSelected ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={photo.photo} alt="" className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">{selectedIndex + 1}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {album.length === 0 && (
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
  const [album, setAlbum] = useState<AlbumPhoto[]>([]);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [albumExpanded, setAlbumExpanded] = useState(false);
  const [achievementsExpanded, setAchievementsExpanded] = useState(false);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const [albumResult, timelineResult, achievementsResult, tasksResult] = await Promise.all([
          growthService.getAlbum(selectedChildId, 1, 12),
          growthService.getTimeline(selectedChildId),
          growthService.getAchievements(selectedChildId),
          tasksService.getTasks({ childId: selectedChildId, page: 1, pageSize: 20 }),
        ]);
        if (mounted) {
          setAlbum(albumResult.items);
          setTimeline(timelineResult);
          setAchievements(achievementsResult);
          setTasks(tasksResult.items);
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

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  const DEFAULT_ALBUM_COUNT = 6;
  const DEFAULT_ACHIEVEMENT_COUNT = 3;
  const DEFAULT_TIMELINE_COUNT = 3;

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

  const displayAlbum = albumExpanded ? album : album.slice(0, DEFAULT_ALBUM_COUNT);
  const displayAchievements = achievementsExpanded ? achievements : achievements.slice(0, DEFAULT_ACHIEVEMENT_COUNT);
  const displayTimeline = timelineExpanded ? timeline : timeline.slice(0, DEFAULT_TIMELINE_COUNT);

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
                <div className="text-white font-bold text-lg">{unlockedCount}/{totalCount}</div>
                <div className="text-white/70 text-xs">勋章</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-white font-bold text-lg">{album.length}</div>
                <div className="text-white/70 text-xs">图集</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-white font-bold text-lg">{timeline.length}</div>
                <div className="text-white/70 text-xs">天数</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3">
        {/* 图集 Section */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <SectionHeader
            icon={Camera}
            title="图集"
            count={album.length}
            onToggle={album.length > DEFAULT_ALBUM_COUNT ? () => setAlbumExpanded(!albumExpanded) : undefined}
            expanded={albumExpanded}
          />
          {album.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {displayAlbum.map((photo, idx) => (
                <div key={idx} className="aspect-square rounded-xl bg-gray-100 overflow-hidden relative group">
                  <img src={photo.photo} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      +{photo.points} 积分
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary text-sm">
              <Image size={32} className="mx-auto mb-2 text-gray-300" />
              暂无照片
            </div>
          )}
        </div>

        {/* 勋章 Section */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Trophy size={16} className="text-amber-600" />
              </div>
              <span className="font-semibold text-text-primary">勋章</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-amber-600">{unlockedCount}</span>
              <span className="text-sm text-text-tertiary">/ {totalCount}</span>
            </div>
          </div>

          {unlockedCount > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {achievements
                .filter((a) => a.unlocked)
                .map((achievement) => (
                  <div
                    key={achievement.id}
                    className="flex-shrink-0 flex flex-col items-center gap-1 w-14"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-2xl shadow-md shadow-amber-200">
                        {achievement.Achievement.icon}
                      </div>
                      {achievement.award_count > 1 && (
                        <div className="absolute -top-1 -right-1 bg-amber-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-sm min-w-[18px] text-center">
                          x{achievement.award_count}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-text-secondary text-center line-clamp-1 w-full">
                      {achievement.Achievement.name}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Medal size={16} />
              </div>
              <h2 className="font-semibold text-text-primary">全部勋章</h2>
              <span className="text-xs text-text-tertiary bg-gray-100 px-2 py-0.5 rounded-full">{achievements.length}</span>
            </div>
            <button
              onClick={() => navigate(`/achievements?child_id=${selectedChildId}`)}
              className="flex items-center gap-1 text-sm text-text-tertiary hover:text-primary transition-colors"
            >
              <span>更多</span>
              <ChevronDown size={16} />
            </button>
          </div>
          {achievements.length > 0 ? (
            <div className="space-y-3">
              {displayAchievements.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary text-sm">
              <Sparkles size={32} className="mx-auto mb-2 text-gray-300" />
              暂无勋章
            </div>
          )}
        </div>

        {/* 任务时间线 Section */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <SectionHeader
            icon={Calendar}
            title="任务时间线"
            count={timeline.length}
            onToggle={timeline.length > DEFAULT_TIMELINE_COUNT ? () => setTimelineExpanded(!timelineExpanded) : undefined}
            expanded={timelineExpanded}
          />
          {timeline.length > 0 ? (
            <div className="space-y-4">
              {displayTimeline.map((day, idx) => (
                <div key={idx}>
                  <div className="text-xs text-text-tertiary font-medium mb-2">{day.date}</div>
                  <div className="space-y-2">
                    {day.events.map((event, eIdx) => (
                      <div key={eIdx} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                          {event.type === 'task' ? <Star size={14} /> : event.type === 'redeem' ? <Camera size={14} /> : <Trophy size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-text-primary">{event.title}</div>
                          <div className="text-xs text-primary mt-1">+{event.points} 积分</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary text-sm">
              <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
              暂无时间线记录
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
          album={album}
        />
      )}
    </div>
  );
}

export default GrowthPage;
