import { useState, useEffect } from 'react';
import { ChevronRight, Share2, Sparkles, Image, FileText, Send, X, Target, Check, Sliders, History, BookOpen, ArrowRight, Gift, HelpCircle, ChevronDown, Star } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useChildStore } from '../stores/childStore';
import type { Child } from '../stores/childStore';
import { useAuthStore } from '../stores/authStore';
import { ChildTabs } from '../components/ChildTabs';
import * as tasksService from '../services/tasks';
import type { Task } from '../services/tasks';
import * as communityService from '../services/community';
import { getChildScores, getGrowthIndex, getAbilities } from '../services/ability';
import type { ChildAbilityScore, AbilityDimension, FocusLevel } from '../services/ability';
import { IPPAvatar } from '../components/IPPAvatar';
import { MobileDatePicker } from '../components/MobileDatePicker';
import { getCurrentCycle, setGoal, createCycle, updateCycle } from '../services/growthCycle';
import type { DimensionProgress } from '../services/growthCycle';
import { listStories, parseAbilitySummary } from '../services/growthStory';
import type { GrowthStory } from '../services/growthStory';
import { useToastStore } from '../stores/toastStore';
import { masterChallengeApi } from '../services/masterChallenge';
import { academicApi } from '../services/academic';
import type { AcademicTrendEntry, AcademicMilestone } from '../services/academic';
import { ABC_VALUE_MAP, ABC_LABEL_MAP, TREND_METRIC } from '../services/academic';

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

// ===== V3.1 模块 A：分阶段能力增长 =====

// 临时 focus_level 映射（后端 Task A4 上线后可移除）
// 数据源：V3.1 PRD「年级 × 维度权重矩阵」
// key: grade(1-6)，value: { dimension_code: focus_level }
const FOCUS_LEVEL_FALLBACK: Record<number, Record<string, FocusLevel>> = {
  1: { self_care: 'primary', independence: 'latent', hands_on: 'secondary', learning: 'primary', social_emotional: 'latent', health: 'primary' },
  2: { self_care: 'primary', independence: 'latent', hands_on: 'primary', learning: 'secondary', social_emotional: 'secondary', health: 'primary' },
  3: { self_care: 'secondary', independence: 'secondary', hands_on: 'primary', learning: 'primary', social_emotional: 'secondary', health: 'secondary' },
  4: { self_care: 'latent', independence: 'secondary', hands_on: 'secondary', learning: 'primary', social_emotional: 'primary', health: 'secondary' },
  5: { self_care: 'secondary', independence: 'primary', hands_on: 'secondary', learning: 'primary', social_emotional: 'primary', health: 'secondary' },
  6: { self_care: 'primary', independence: 'primary', hands_on: 'primary', learning: 'secondary', social_emotional: 'primary', health: 'primary' },
};

// 蓄势维儿童发展小贴士（按 dimension_code 动态切换）
const LATENT_TIPS: Record<string, string> = {
  independence: '这个阶段的孩子还在发展基础自理能力，独立决策能力会在 3 年级后加速发展。现在多给选择权，不急于求成。',
  social_emotional: '低年级孩子的社交正在从"平行游戏"向"合作游戏"过渡。不必急于要求高阶共情，先从分享和轮流开始。',
};
const DEFAULT_LATENT_TIP = '这个维度在孩子当前年级属于「蓄势期」，能力发展有其自然节奏。现阶段以轻量体验为主，不必追求分数提升，等身心准备好后自然会加速成长。';

// 能力等级名称映射（专家模式关闭时显示等级名称，开启时显示原始分数）
function getAbilityLevelName(score: number): string {
  if (score >= 95) return '精通⭐';
  if (score >= 85) return '熟练🌻';
  if (score >= 60) return '精进🌳';
  if (score >= 30) return '成长🌿';
  return '启蒙🌱';
}

// 带必填 focus_level 的分数（API 返回或 fallback 兜底）
interface EnrichedScore extends ChildAbilityScore {
  focus_level: FocusLevel;
  // 解析后的精通星数（0-5）：优先用后端 mastery_stars，缺失时按 score 兜底
  mastery_stars: number;
}

// 获取维度 focus_level：优先用 API 返回值，否则用年级×维度 fallback 映射
function resolveFocusLevel(score: ChildAbilityScore, grade: number | null | undefined): FocusLevel {
  if (score.focus_level) return score.focus_level;
  const g = grade ?? 1;
  return FOCUS_LEVEL_FALLBACK[g]?.[score.dimension_code] || 'secondary';
}

// 解析维度精通星数：后端返回的 mastery_stars 优先；未返回时，精通（≥95）至少 1 星，否则 0 星
function resolveMasteryStars(score: ChildAbilityScore): number {
  if (typeof score.mastery_stars === 'number') return Math.max(0, Math.min(5, score.mastery_stars));
  return score.score >= 95 ? 1 : 0;
}

// 判断维度是否进入精通（score≥95）
function isMastered(score: { score: number }): boolean {
  return score.score >= 95;
}

// V3.1 模块 B：成长指数精通徽章
// masteryCount：精通维度数；isGrandMaster：6 维全精通且每维≥2 星
function MasteryBadge({ masteryCount, isGrandMaster }: { masteryCount: number; isGrandMaster: boolean }) {
  if (isGrandMaster) {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500">
        <span>🏆</span>小萌芽成长大师
      </span>
    );
  }
  let label = '';
  let stars = '';
  if (masteryCount >= 5) {
    label = '全面发展';
    stars = '⭐⭐⭐⭐⭐';
  } else if (masteryCount >= 3) {
    label = '三项全能';
    stars = '⭐⭐⭐';
  } else {
    label = '单项精通';
    stars = '⭐';
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md bg-gradient-to-r from-amber-400 to-yellow-500">
      {label} {stars}
    </span>
  );
}

// 原生 SVG 雷达图（自适应维度数，V3.1 模块 B 追加精通星环 + 金色六边形）
// 轴标签仅显示短名；分数/等级在展开列表中展示，避免与雷达图重复拥挤
function RadarChartSVG({ scores }: { scores: EnrichedScore[] }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 78;
  const labelRadius = 100;
  const levels = [maxRadius, maxRadius * 2 / 3, maxRadius / 3];
  const n = scores.length;
  const angles = Array.from({ length: n }, (_, i) => -90 + (360 / n) * i);

  // V3.1 模块 B：精通相关计算
  const masteredCount = scores.filter(s => isMastered(s)).length;
  const showStarRing = masteredCount >= 1; // ≥1 维度精通时叠加星环
  const allMastered = n > 0 && masteredCount === n; // 6 维全精通 → 金色六边形
  // 星环配置：每组 5 颗小圆点，沿轴向外排列
  const starStart = 81;
  const starStep = 3;
  const starR = 1.7;
  const GOLD = '#F0B848';
  const GRAY = '#d1d5db';

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

  // 某维度在星环中应实心金色的颗数：全精通时统一 5 颗；精通维至少 1 颗；未精通按 mastery_stars（通常 0）
  function filledStarsFor(s: EnrichedScore): number {
    if (allMastered) return 5;
    return isMastered(s) ? Math.max(s.mastery_stars, 1) : s.mastery_stars;
  }

  return (
    <svg width={240} height={240} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
      {/* 三层同心多边形网格 */}
      {levels.map((r, i) => (
        <polygon key={i} points={polygonPoints(r)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {/* 轴线 */}
      {angles.map((a, i) => {
        const p = getPoint(a, maxRadius);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {/* 数据多边形（全精通时变金色六边形） */}
      {n > 0 && (
        <>
          <polygon
            points={dataPolygonStr}
            fill={allMastered ? 'rgba(240, 184, 72, 0.18)' : 'rgba(126, 200, 80, 0.15)'}
            stroke={allMastered ? GOLD : '#7EC850'}
            strokeWidth={allMastered ? 2.5 : 2}
          />
          {/* 数据点 */}
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill={allMastered ? GOLD : '#7EC850'} />
          ))}
        </>
      )}
      {/* V3.1 模块 B：精通星环（每组 5 颗，沿各轴向外排列） */}
      {showStarRing && scores.map((s, i) => {
        const filled = filledStarsFor(s);
        return Array.from({ length: 5 }, (_, k) => {
          const r = starStart + k * starStep;
          const p = getPoint(angles[i], r);
          const isFilled = k < filled;
          return (
            <circle
              key={`star-${i}-${k}`}
              cx={p.x}
              cy={p.y}
              r={starR}
              fill={isFilled ? GOLD : '#ffffff'}
              stroke={isFilled ? GOLD : GRAY}
              strokeWidth={isFilled ? 0 : 1}
            />
          );
        });
      })}
      {/* 轴标签：仅短名 + 主轴星标（分数/等级见展开列表） */}
      {scores.map((s, i) => {
        const p = getPoint(angles[i], labelRadius);
        const isPrimary = s.focus_level === 'primary';
        return (
          <text key={i} x={p.x} y={p.y} fontSize="11" fill="#6b7280" textAnchor="middle" dominantBaseline="middle">
            {isPrimary ? '★ ' : ''}{s.dimension_name}
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

// ===== V3.1 模块 D：学习认知详情面板（4 条趋势折线 + 里程碑历史）=====

// 4 个 metric_type 配置：标题 + 颜色 + 接口参数
const TREND_METRICS: { key: string; label: string; color: string }[] = [
  { key: TREND_METRIC.HOMEWORK, label: '作业完成档', color: '#10b981' },
  { key: TREND_METRIC.QUIZ, label: '测验档', color: '#5B9BD5' },
  { key: TREND_METRIC.MIDTERM_FINAL, label: '期中期末档', color: '#F0B848' },
  { key: TREND_METRIC.SELF_STUDY_DURATION, label: '自主学习时长档', color: '#E87461' },
];

// 把趋势条目转为折线图数据点：取最近 6 条并按时间正序（旧→新）
function buildTrendChartData(entries: AcademicTrendEntry[]) {
  const recent = entries.slice(0, 6).reverse(); // 后端返回倒序，取前 6 后反转
  return recent.map((e) => ({
    week: e.occurred_week ? e.occurred_week.replace(/^\d{4}-W/, 'W') : '·',
    value: ABC_VALUE_MAP[e.value_abc] ?? 0,
    label: e.value_abc,
  }));
}

// 单条折线图卡片
function TrendLineCard({ label, color, data }: { label: string; color: string; data: { week: string; value: number; label: string }[] }) {
  const hasData = data.length > 0;
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-xs font-medium text-text-secondary mb-2">{label}</div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={90}>
          <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[2, 5]}
              ticks={[2, 3, 4, 5]}
              tickFormatter={(v: number) => ABC_LABEL_MAP[v] || ''}
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={24}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', padding: '4px 8px' }}
              formatter={(_value: number, _name: string, item: any) => [`档位 ${item?.payload?.label || '-'}`, label]}
              labelFormatter={(l) => `周次 ${l}`}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[90px] flex items-center justify-center text-xs text-text-tertiary">暂无数据</div>
      )}
    </div>
  );
}

// 学习认知详情面板：4 条折线 + 里程碑历史（最近 5 条）
function LearningDetailPanel({ childId }: { childId: number }) {
  const [loading, setLoading] = useState(true);
  const [trendMap, setTrendMap] = useState<Record<string, AcademicTrendEntry[]>>({});
  const [milestones, setMilestones] = useState<AcademicMilestone[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        // 并行拉取 4 条趋势 + 里程碑历史；任一失败不阻塞其它
        const [hw, quiz, mid, self, ms] = await Promise.all([
          academicApi.getTrends(childId, TREND_METRIC.HOMEWORK, 6).catch(() => [] as AcademicTrendEntry[]),
          academicApi.getTrends(childId, TREND_METRIC.QUIZ, 6).catch(() => [] as AcademicTrendEntry[]),
          academicApi.getTrends(childId, TREND_METRIC.MIDTERM_FINAL, 6).catch(() => [] as AcademicTrendEntry[]),
          academicApi.getTrends(childId, TREND_METRIC.SELF_STUDY_DURATION, 6).catch(() => [] as AcademicTrendEntry[]),
          academicApi.getMilestones(childId, 5).catch(() => [] as AcademicMilestone[]),
        ]);
        if (mounted) {
          setTrendMap({
            [TREND_METRIC.HOMEWORK]: hw,
            [TREND_METRIC.QUIZ]: quiz,
            [TREND_METRIC.MIDTERM_FINAL]: mid,
            [TREND_METRIC.SELF_STUDY_DURATION]: self,
          });
          setMilestones(ms);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [childId]);

  // 4 条折线是否全部无数据
  const allEmpty = Object.values(trendMap).every((arr) => !arr || arr.length === 0);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      <div className="flex items-center gap-1.5">
        <BookOpen size={14} className="text-primary" />
        <span className="text-xs font-semibold text-text-primary">学习认知详情</span>
      </div>

      {loading ? (
        <div className="py-4 text-center text-xs text-text-tertiary">加载中...</div>
      ) : allEmpty ? (
        <div className="py-4 text-center text-xs text-text-tertiary">
          暂无学业趋势数据，点击「📚 录好事」记录吧
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {TREND_METRICS.map((m) => (
            <TrendLineCard
              key={m.key}
              label={m.label}
              color={m.color}
              data={buildTrendChartData(trendMap[m.key] || [])}
            />
          ))}
        </div>
      )}

      {/* 里程碑历史（最近 5 条） */}
      <div className="flex items-center gap-1.5 pt-1">
        <Star size={14} className="text-amber-400" />
        <span className="text-xs font-semibold text-text-primary">学业里程碑（最近 5 条）</span>
      </div>
      {milestones.length > 0 ? (
        <div className="space-y-1.5">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
              <span className="flex items-center gap-0.5 flex-shrink-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Star
                    key={i}
                    size={10}
                    className={i < m.star_level ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                  />
                ))}
              </span>
              <span className="text-xs font-medium text-text-primary flex-1 truncate">{m.title}</span>
              <span className="text-[10px] text-text-tertiary flex-shrink-0">
                {m.occurred_at ? new Date(m.occurred_at).toLocaleDateString() : ''}
              </span>
              <span className="text-[10px] font-medium text-primary flex-shrink-0">+{m.points_awarded}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-2 text-center text-xs text-text-tertiary">暂无里程碑记录</div>
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
  // 专家模式开关（localStorage 持久化）：关闭显示等级名称，开启显示原始 0-100 分数
  const [expertMode, setExpertMode] = useState<boolean>(() => localStorage.getItem('growthExpertMode') === 'true');
  // 蓄势维小贴士弹窗（点击问号图标触发，值为 dimension_code）
  const [latentTipDim, setLatentTipDim] = useState<string | null>(null);
  // V3.1 模块 D：能力维度详情展开（点击维度名展开，值为 dimension_id）
  const [expandedDimId, setExpandedDimId] = useState<number | null>(null);
  // 成长维度：各维度列表默认收起，降低首屏密度
  const [showDimList, setShowDimList] = useState(false);
  // V3.1 模块 B：大师挑战横幅摘要（进行中数 / 可挑战数）
  const [masterSummary, setMasterSummary] = useState<{ inProgress: number; available: number } | null>(null);

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

  // 专家模式选择持久化到 localStorage
  useEffect(() => {
    localStorage.setItem('growthExpertMode', String(expertMode));
  }, [expertMode]);

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

  // V3.1：为分数追加 focus_level（API 优先，fallback 兜底）+ 主轴维度统计
  const childGrade = selectedChild?.derived_grade || selectedChild?.grade || null;
  const enrichedScores: EnrichedScore[] = scores.map(s => ({
    ...s,
    focus_level: resolveFocusLevel(s, childGrade),
    mastery_stars: resolveMasteryStars(s),
  }));
  const primaryCount = enrichedScores.filter((s) => s.focus_level === 'primary').length;

  // V3.1 模块 B：精通统计
  const masteredDims = enrichedScores.filter(s => isMastered(s));
  const masteryCount = masteredDims.length; // 精通维度数（score≥95）
  const allMastered = enrichedScores.length > 0 && enrichedScores.every(s => isMastered(s));
  // 小萌芽成长大师：6 维全精通 + 每维≥2 星
  const isGrandMaster =
    allMastered &&
    enrichedScores.length > 0 &&
    enrichedScores.every(s => s.mastery_stars >= 2);

  // V3.1 模块 B：当孩子 ≥1 项精通时，拉取大师挑战摘要（进行中 / 可挑战）用于顶部横幅
  // 注意：放在 masteryCount 计算之后、早退 return 之前，保证 hooks 调用顺序稳定
  useEffect(() => {
    let mounted = true;
    if (!selectedChildId || masteryCount < 1) {
      setMasterSummary(null);
      return;
    }
    async function loadMasterSummary() {
      try {
        const [instancesRes, templatesRes] = await Promise.all([
          masterChallengeApi.getInstances(selectedChildId!),
          masterChallengeApi.getTemplates(selectedChildId!),
        ]);
        if (!mounted) return;
        // 进行中 = in_progress + submitted（未完成验收）
        const inProgress = instancesRes.items.filter(
          (i) => i.status === 'in_progress' || i.status === 'submitted',
        ).length;
        setMasterSummary({ inProgress, available: templatesRes.total });
      } catch {
        if (mounted) setMasterSummary(null);
      }
    }
    loadMasterSummary();
    return () => {
      mounted = false;
    };
  }, [selectedChildId, masteryCount]);

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
        {/* V3.1 模块 B：大师挑战横幅（≥1 项精通时显示） */}
        {masteryCount >= 1 && masterSummary && (masterSummary.inProgress > 0 || masterSummary.available > 0) && (
          <button
            onClick={() => navigate(`/master-challenges?child_id=${selectedChild.id}`)}
            className="w-full mb-3 flex items-center gap-2 p-3 rounded-2xl text-white text-sm font-medium shadow-md transition-transform active:scale-[0.99] bg-gradient-to-r from-amber-400 to-yellow-500"
          >
            <span className="text-base">⭐</span>
            <span className="flex-1 text-left">
              大师挑战 {masterSummary.inProgress} 个进行中 / {masterSummary.available} 个可挑战
            </span>
            <ChevronRight size={16} />
          </button>
        )}

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

        {/* 2. 成长维度图（全宽雷达 + 紧凑状态行 + 按需展开列表） */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary">成长维度</h2>
            <button
              onClick={() => setExpertMode((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-primary transition-colors"
              title="开启后显示原始 0-100 分数"
            >
              <span className={expertMode ? 'text-primary font-medium' : ''}>专家模式</span>
              <span className={`relative inline-block w-7 h-4 rounded-full transition-colors ${expertMode ? 'bg-primary' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${expertMode ? 'translate-x-3' : ''}`} />
              </span>
            </button>
          </div>

          {scores.length > 0 ? (
            <>
              {/* 全宽雷达主视觉 */}
              <div className="flex justify-center">
                <RadarChartSVG scores={enrichedScores} />
              </div>

              {/* IP + 等级 + 成长值 + 冲刺简短提示 */}
              <div className="flex flex-col items-center gap-2 mt-1 mb-1">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`relative flex-shrink-0 ${isGrandMaster ? 'p-0.5 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 shadow-md shadow-amber-400/30' : ''}`}
                  >
                    <IPPAvatar growthIndex={growthIndex} expression="proud" size={40} />
                    {isGrandMaster && (
                      <span className="absolute -top-1 -right-0.5 text-xs select-none" title="成长大师">🌿</span>
                    )}
                  </div>
                  {masteryCount >= 1 ? (
                    <MasteryBadge masteryCount={masteryCount} isGrandMaster={isGrandMaster} />
                  ) : (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                      Lv.{levelInfo.level} {levelInfo.name}
                    </span>
                  )}
                  <span className="text-xs text-text-tertiary">成长值 {selectedChild.balance}</span>
                </div>
                {primaryCount > 0 && (
                  <p className="text-xs text-text-tertiary">
                    本阶段重点 <span className="text-primary font-medium">{primaryCount}/6</span>
                  </p>
                )}
              </div>

              {/* 查看各维度：折叠列表（分数/蓄势/学习详情） */}
              <button
                type="button"
                onClick={() => setShowDimList((v) => !v)}
                className="w-full mt-3 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium text-text-secondary bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {showDimList ? '收起各维度' : '查看各维度'}
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showDimList ? 'rotate-180' : ''}`}
                />
              </button>

              {(showDimList || expandedDimId !== null) && (
                <div className="mt-3 space-y-2">
                  {enrichedScores.map((s, i) => {
                    const isLearning = s.dimension_code === 'learning' || s.dimension_id === 4;
                    const isExpanded = expandedDimId === s.dimension_id;
                    return (
                      <div key={s.dimension_id}>
                        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-gray-50">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getDimensionColor(i) }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!isLearning) return;
                              setShowDimList(true);
                              setExpandedDimId((cur) => (cur === s.dimension_id ? null : s.dimension_id));
                            }}
                            className={`flex-1 min-w-0 text-left text-sm font-medium text-text-primary flex items-center gap-1 ${
                              isLearning ? 'hover:text-primary' : ''
                            }`}
                            title={isLearning ? `查看${s.dimension_name}详情` : undefined}
                          >
                            {s.dimension_name}
                            {s.focus_level === 'primary' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                                重点
                              </span>
                            )}
                            {s.focus_level === 'latent' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-gray-200 text-text-tertiary">
                                蓄势
                              </span>
                            )}
                            {isLearning && (
                              <ChevronDown
                                size={14}
                                className={`text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              />
                            )}
                          </button>
                          <span className="text-xs font-semibold text-text-primary flex-shrink-0">
                            {expertMode ? s.score : getAbilityLevelName(s.score)}
                          </span>
                          {s.focus_level === 'latent' && (
                            <button
                              type="button"
                              onClick={() => setLatentTipDim(s.dimension_code)}
                              className="flex items-center gap-0.5 text-[10px] text-text-tertiary hover:text-primary transition-colors flex-shrink-0"
                            >
                              <span>成长中</span>
                              <HelpCircle size={12} />
                            </button>
                          )}
                        </div>
                        {isExpanded && isLearning && selectedChildId && (
                          <div className="mt-2">
                            <LearningDetailPanel childId={selectedChildId} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                <MobileDatePicker
                  value={setupStartDate}
                  onChange={setSetupStartDate}
                  placeholder="开始"
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-left flex items-center justify-between"
                />
                <span className="text-text-tertiary">~</span>
                <MobileDatePicker
                  value={setupEndDate}
                  onChange={setSetupEndDate}
                  placeholder="结束"
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-left flex items-center justify-between"
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

      {/* 蓄势维小贴士弹窗 */}
      {latentTipDim && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setLatentTipDim(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-text-primary text-base flex items-center gap-1.5">
                <span>🔒</span> 成长中
              </h3>
              <button
                onClick={() => setLatentTipDim(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {LATENT_TIPS[latentTipDim] || DEFAULT_LATENT_TIP}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GrowthPage;
