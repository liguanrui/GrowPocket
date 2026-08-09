import { useState, useEffect, useMemo } from 'react';
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
import { getChildScores, getAbilities } from '../services/ability';
// V3.1 思路 C：移除 IP 阶段形态（Lv.X 种子期/萌芽期）+ 成长值 展示，不再需要 getGrowthIndex
import type { ChildAbilityScore, AbilityDimension, FocusLevel } from '../services/ability';
// 注意：IPPAvatar 不在此页使用（阶段名+成长值块已移除），如需添加请从 '../components/IPPAvatar' 引入
import { MobileDatePicker } from '../components/MobileDatePicker';
import { DayStepper } from '../components/DayStepper';
import { SoftSelect } from '../components/SoftSelect';
import { MediaUploader } from '../components/MediaUploader';
import { AcademicMilestoneModal } from '../components/AcademicMilestoneModal';
import { getCurrentCycle, setGoalsBatch, createCycle, updateCycle } from '../services/growthCycle';
import type { DimensionProgress, Goal } from '../services/growthCycle';
import { getPresetHabits, createCustomHabit } from '../services/habits';
import type { Habit } from '../services/habits';
import {
  getPresetTemplates,
  createCustomTemplate,
  createParentTask,
  deleteParentTask,
  generateChildren,
} from '../services/parentTasks';
import type { ParentTaskTemplate } from '../services/parentTasks';
import { getTask } from '../services/tasks';
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

// 主题任务类别选项（与后端 parent_task_template seed 一致）
const THEME_CATEGORIES = [
  { value: 'nature', label: '自然探索' },
  { value: 'family_creation', label: '家庭共创' },
  { value: 'creative', label: '创意表达' },
  { value: 'craft', label: '手工制作' },
  { value: 'financial', label: '财商培养' },
  { value: 'community', label: '社区公益' },
  { value: 'other', label: '其他' },
];
// 解析 sub_task_outline（JSON 字符串）为数组长度，用于提示生成子任务数
function countSubTaskOutline(outline?: string): number {
  if (!outline) return 0;
  try {
    const parsed = JSON.parse(outline);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

// 根据孩子信息推算年龄：优先 derived_age → age → 从 birthday 计算；默认 6 岁
function computeChildAge(child: { derived_age?: number; age?: number | null; birthday?: string | null } | null): number {
  if (!child) return 6;
  if (typeof child.derived_age === 'number' && child.derived_age > 0) return child.derived_age;
  if (typeof child.age === 'number' && child.age > 0) return child.age;
  if (child.birthday) {
    const birth = new Date(child.birthday);
    if (!isNaN(birth.getTime())) {
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return Math.max(0, age);
    }
  }
  return 6;
}

// V3.1 思路 C：旧的 5 阶段等级（种子期/萌芽期/小苗期/小树期/大树期）已移除，
// 精通熟练度 5 星在雷达图外圈星环 + 精通徽章（MasteryBadge，原本页内嵌实现未使用，保留作备用）体现，
// 成长阶段叙事交给「大师挑战 PBL 项目」模块承载。

// ===== V3.1 模块 A：分阶段能力增长 =====

// 临时 focus_level 映射（后端 Task A4 上线后可移除）
// 数据源：V3.1 PRD「年级 × 维度权重矩阵」
// key: grade(1-6)，value: { dimension_code: focus_level }
const FOCUS_LEVEL_FALLBACK: Record<number, Record<string, FocusLevel>> = {
  1: { self_care: 'primary', independence: 'primary', hands_on: 'secondary', learning: 'latent', social_emotional: 'latent', health: 'primary' },
  2: { self_care: 'primary', independence: 'primary', hands_on: 'secondary', learning: 'secondary', social_emotional: 'latent', health: 'primary' },
  3: { self_care: 'secondary', independence: 'secondary', hands_on: 'primary', learning: 'primary', social_emotional: 'secondary', health: 'secondary' },
  4: { self_care: 'secondary', independence: 'secondary', hands_on: 'primary', learning: 'primary', social_emotional: 'primary', health: 'secondary' },
  5: { self_care: 'secondary', independence: 'secondary', hands_on: 'primary', learning: 'primary', social_emotional: 'primary', health: 'primary' },
  6: { self_care: 'primary', independence: 'primary', hands_on: 'primary', learning: 'primary', social_emotional: 'primary', health: 'primary' },
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
  const toast = useToastStore();
  const [shareType, setShareType] = useState<'text' | 'text_image' | 'text_task'>('text');
  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const MAX_IMAGES = 9;

  const completedTasks = useMemo(() => tasks.filter((t) => t.status === 3), [tasks]);
  // 去重后的任务照片，供图文模式快捷勾选
  const taskPhotoPool = useMemo(() => Array.from(new Set(photos.filter(Boolean))), [photos]);

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
    if (shareType === 'text_image' && selectedImages.length === 0) {
      toast.error('请至少选择或上传一张图片');
      return;
    }

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

      toast.success('分享已发布');
      onClose();
    } catch (e: any) {
      toast.error(e?.message || '分享失败');
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
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
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
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-text-primary">
              添加图片 <span className="text-text-tertiary">({selectedImages.length}/{MAX_IMAGES})</span>
            </label>
            <MediaUploader
              mediaUrls={selectedImages}
              onChange={setSelectedImages}
              maxCount={MAX_IMAGES}
              size="compact"
              label="上传图片"
              emptyHint="从相册选择或拍照"
              onUploadingChange={setUploading}
            />

            {taskPhotoPool.length > 0 && (
              <div>
                <p className="text-xs text-text-tertiary mb-2">或从任务照片中选择</p>
                <div className="grid grid-cols-4 gap-2">
                  {taskPhotoPool.map((url, idx) => {
                    const isSelected = selectedImages.includes(url);
                    const selectedIndex = selectedImages.indexOf(url);
                    return (
                      <button
                        key={`${url}-${idx}`}
                        type="button"
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
              </div>
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
          disabled={
            !content.trim() ||
            submitting ||
            uploading ||
            (shareType === 'text_task' && !selectedTaskId) ||
            (shareType === 'text_image' && selectedImages.length === 0)
          }
          className="w-full mt-6 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Send size={16} />
          {uploading ? '上传中...' : submitting ? '发布中...' : '发布分享'}
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

// 学科/指标/档位选项（趋势录入用）
const TREND_SUBJECTS = [
  { value: 'chinese', label: '语文' },
  { value: 'math', label: '数学' },
  { value: 'english', label: '英语' },
  { value: 'other', label: '其他' },
];
const TREND_METRIC_OPTIONS = [
  { value: TREND_METRIC.HOMEWORK, label: '作业档' },
  { value: TREND_METRIC.QUIZ, label: '测验档' },
  { value: TREND_METRIC.MIDTERM_FINAL, label: '期中期末档' },
  { value: TREND_METRIC.SELF_STUDY_DURATION, label: '自习时长档' },
];
const ABC_OPTIONS = ['A+', 'A', 'B', 'C'];

// 计算当前周号（ISO 周，形如 "2026-W31"）
function currentISOWeek(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum}`;
}

// 学习认知详情面板：4 条折线 + 里程碑历史（最近 5 条）+ 录入入口
function LearningDetailPanel({ childId }: { childId: number }) {
  const toast = useToastStore();
  const [loading, setLoading] = useState(true);
  const [trendMap, setTrendMap] = useState<Record<string, AcademicTrendEntry[]>>({});
  const [milestones, setMilestones] = useState<AcademicMilestone[]>([]);
  // 录入入口
  const [showMilestone, setShowMilestone] = useState(false);
  const [showTrendForm, setShowTrendForm] = useState(false);
  const [trendSubmitting, setTrendSubmitting] = useState(false);
  const [trendSubject, setTrendSubject] = useState<string>('chinese');
  const [trendMetric, setTrendMetric] = useState<string>(TREND_METRIC.HOMEWORK);
  const [trendABC, setTrendABC] = useState<string>('A');
  const [trendNote, setTrendNote] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const [hw, quiz, mid, self, ms] = await Promise.all([
        academicApi.getTrends(childId, TREND_METRIC.HOMEWORK, 6).catch(() => [] as AcademicTrendEntry[]),
        academicApi.getTrends(childId, TREND_METRIC.QUIZ, 6).catch(() => [] as AcademicTrendEntry[]),
        academicApi.getTrends(childId, TREND_METRIC.MIDTERM_FINAL, 6).catch(() => [] as AcademicTrendEntry[]),
        academicApi.getTrends(childId, TREND_METRIC.SELF_STUDY_DURATION, 6).catch(() => [] as AcademicTrendEntry[]),
        academicApi.getMilestones(childId, 5).catch(() => [] as AcademicMilestone[]),
      ]);
      setTrendMap({
        [TREND_METRIC.HOMEWORK]: hw,
        [TREND_METRIC.QUIZ]: quiz,
        [TREND_METRIC.MIDTERM_FINAL]: mid,
        [TREND_METRIC.SELF_STUDY_DURATION]: self,
      });
      setMilestones(ms);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      await reload();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  // 4 条折线是否全部无数据
  const allEmpty = Object.values(trendMap).every((arr) => !arr || arr.length === 0);

  // 提交趋势录入
  const handleSubmitTrend = async () => {
    setTrendSubmitting(true);
    try {
      await academicApi.createTrend({
        child_id: childId,
        subject: trendSubject,
        metric_type: trendMetric,
        value_abc: trendABC,
        occurred_week: currentISOWeek(),
        note: trendNote.trim(),
      });
      toast.success('已记录本周趋势档位');
      setShowTrendForm(false);
      setTrendNote('');
      await reload();
    } catch (e: any) {
      toast.error(e.message || '录入失败');
    } finally {
      setTrendSubmitting(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BookOpen size={14} className="text-primary" />
          <span className="text-xs font-semibold text-text-primary">学习认知详情</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowTrendForm((v) => !v)}
            className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 text-text-secondary hover:bg-gray-200 transition-colors"
          >
            📝 录趋势
          </button>
          <button
            onClick={() => setShowMilestone(true)}
            className="text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            📚 录好事
          </button>
        </div>
      </div>

      {/* 趋势录入内联表单 */}
      {showTrendForm && (
        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 space-y-2.5">
          <p className="text-xs text-text-tertiary">记录本周学业档位（仅档位不发分，作 AI 阶段回顾参考）</p>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={trendSubject}
              onChange={(e) => setTrendSubject(e.target.value)}
              className="px-2 py-1.5 bg-white rounded-lg border border-gray-100 text-xs text-text-primary outline-none"
            >
              {TREND_SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={trendMetric}
              onChange={(e) => setTrendMetric(e.target.value)}
              className="px-2 py-1.5 bg-white rounded-lg border border-gray-100 text-xs text-text-primary outline-none"
            >
              {TREND_METRIC_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <div className="flex gap-1">
              {ABC_OPTIONS.map((abc) => (
                <button
                  key={abc}
                  onClick={() => setTrendABC(abc)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    trendABC === abc
                      ? 'bg-primary text-white'
                      : 'bg-white text-text-secondary border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {abc}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={trendNote}
            onChange={(e) => setTrendNote(e.target.value)}
            placeholder="备注（可选）"
            className="w-full px-3 py-1.5 bg-white rounded-lg border border-gray-100 text-xs text-text-primary outline-none"
          />
          <button
            onClick={handleSubmitTrend}
            disabled={trendSubmitting}
            className="w-full py-2 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {trendSubmitting ? '提交中...' : '提交本周档位'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-4 text-center text-xs text-text-tertiary">加载中...</div>
      ) : allEmpty ? (
        <div className="py-4 text-center text-xs text-text-tertiary">
          暂无学业趋势数据，点击「📝 录趋势」记录吧
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

      {/* 里程碑录入弹窗 */}
      <AcademicMilestoneModal
        open={showMilestone}
        childId={childId}
        onClose={() => setShowMilestone(false)}
        onSubmitted={reload}
      />
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [stories, setStories] = useState<GrowthStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 阶段目标相关
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [cycleGoals, setCycleGoals] = useState<Goal[]>([]); // 当前周期下所有 goals（dimension/habit/parent_task）
  const [progressList, setProgressList] = useState<DimensionProgress[]>([]);
  const [cycleName, setCycleName] = useState('');
  const [cycleStartDate, setCycleStartDate] = useState('');
  const [cycleEndDate, setCycleEndDate] = useState('');
  const [dimensions, setDimensions] = useState<AbilityDimension[]>([]);
  // 阶段目标设置面板
  const [showGoalSetup, setShowGoalSetup] = useState(false);
  const [setupStartDate, setSetupStartDate] = useState('');
  const [setupWeeks, setSetupWeeks] = useState(2); // 1-4 周，默认 2 周
  const [setupGoals, setSetupGoals] = useState<number[]>([]); // 选中的 dimension_id 列表
  const [goalSubmitting, setGoalSubmitting] = useState(false);
  // 习惯目标（在能力维度区之后展示，可选，最多 2 个）
  const [setupHabits, setSetupHabits] = useState<number[]>([]); // 选中的习惯 ID 列表，最多 2 个
  const [presetHabits, setPresetHabits] = useState<Habit[]>([]); // 预设习惯列表
  const [presetHabitsLoading, setPresetHabitsLoading] = useState(false);
  const [showCustomHabitForm, setShowCustomHabitForm] = useState(false); // 自定义习惯表单显示开关
  const [customHabitTitle, setCustomHabitTitle] = useState('');
  const [customHabitDesc, setCustomHabitDesc] = useState('');
  const [habitSubmitting, setHabitSubmitting] = useState(false);
  // 主题任务（在习惯目标区之后展示，单选，最多 1 个）
  const [setupExistingParentTask, setSetupExistingParentTask] = useState<{ id: number; title: string } | null>(null); // 当前周期已存在的主题任务（切换时先删后建）
  const [setupThemeTemplateId, setSetupThemeTemplateId] = useState<number | null>(null); // 选中的主题模板 ID
  const [presetThemeTemplates, setPresetThemeTemplates] = useState<ParentTaskTemplate[]>([]); // 预设主题模板列表
  const [presetThemesLoading, setPresetThemesLoading] = useState(false);
  const [showCustomThemeForm, setShowCustomThemeForm] = useState(false); // 自定义主题表单显示开关
  const [customThemeTitle, setCustomThemeTitle] = useState('');
  const [customThemeDesc, setCustomThemeDesc] = useState('');
  const [customThemeDays, setCustomThemeDays] = useState<number>(14); // 预计周期天数，默认 14 天
  const [customThemeCategory, setCustomThemeCategory] = useState<string>('nature');
  const [themeSubmitting, setThemeSubmitting] = useState(false);
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
        const [scoresResult, tasksResult, cycleResult, dimsResult, storiesResult] = await Promise.all([
          getChildScores(selectedChildId),
          tasksService.getTasks({ childId: selectedChildId, page: 1, pageSize: 100 }),
          getCurrentCycle(selectedChildId),
          getAbilities(),
          listStories(selectedChildId, 1, 20),
        ]);
        if (mounted) {
          setScores(scoresResult);
          setTasks(tasksResult.items);
          setStories(storiesResult.items);
          setDimensions(dimsResult);
          if (cycleResult.cycle) {
            setCycleId(cycleResult.cycle.id);
            setCycleName(cycleResult.cycle.name);
            setCycleStartDate(cycleResult.cycle.start_date);
            setCycleEndDate(cycleResult.cycle.end_date);
            setProgressList(cycleResult.progress || []);
            setCycleGoals(cycleResult.goals || []);
          } else {
            setCycleId(null);
            setProgressList([]);
            setCycleGoals([]);
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
    if (children.length > 0) return;
    if (childStore.loading) return; // 已经在请求中：直接跳过，避免和并发锁叠加产生无限 setState
    childStore.fetchChildren().catch(() => {
      // fetchChildren 失败不阻塞成长主页：用户可能是 child 角色，或接口在此时网络差
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children.length, childStore.loading]);

  const handleChildSelect = (id: number) => {
    setSelectedChildId(id);
    childStore.setCurrentChildId(id);
  };

  // 根据 startDate + 周数计算 endDate（YYYY-MM-DD）
  const computeEndDate = (startDate: string, weeks: number): string => {
    if (!startDate) return '';
    const start = new Date(startDate + 'T00:00:00');
    if (isNaN(start.getTime())) return '';
    const end = new Date(start);
    end.setDate(end.getDate() + weeks * 7);
    // 用本地日期拼接，避免 toISOString() 的本地→UTC 转换导致日期偏移一天
    const y = end.getFullYear();
    const m = String(end.getMonth() + 1).padStart(2, '0');
    const d = String(end.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // 打开阶段目标设置面板
  const openGoalSetup = async () => {
    if (cycleId) {
      setSetupStartDate(cycleStartDate.slice(0, 10));
      // 从现有周期时间反推周数（限制在 1-4 周）
      const start = new Date(cycleStartDate.slice(0, 10) + 'T00:00:00');
      const end = new Date(cycleEndDate.slice(0, 10) + 'T00:00:00');
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const weeks = Math.max(1, Math.min(4, Math.round(diffDays / 7)));
      setSetupWeeks(weeks);
      // 回填已设置的维度目标：所有 goal_type 空或 dimension 的 cycleGoals，或 progressList 里全部维度（为了兼容旧周期 target_score=0 未正确设置）
      const dimIdsFromGoals = cycleGoals
        .filter((g) => !g.goal_type || g.goal_type === 'dimension')
        .map((g) => g.dimension_id);
      const dimIdsFromProgress = progressList.map((p) => p.dimension_id);
      // 去重，优先按 cycleGoals（更准确的设置历史），不足再补 progressList 里的维度
      // 过滤掉 falsy 值（0/undefined），避免提交时 dimension_id 缺失导致后端 400
      const dedup: number[] = [];
      const seen = new Set<number>();
      for (const d of [...dimIdsFromGoals, ...dimIdsFromProgress]) {
        if (!d) continue;
        if (seen.has(d)) continue;
        seen.add(d);
        dedup.push(d);
      }
      setSetupGoals(dedup);
      // 回填已设置的习惯目标（goal_type === habit）
      const habitIds = cycleGoals
        .filter((g) => g.goal_type === 'habit' && g.habit_id)
        .map((g) => Number(g.habit_id));
      setSetupHabits(habitIds.slice(0, 2)); // 受最多 2 个上限约束
    } else {
      const now = new Date();
      setSetupStartDate(now.toISOString().slice(0, 10));
      setSetupWeeks(2); // 默认 2 周
      setSetupGoals([]);
      setSetupHabits([]);
    }
    // 重置习惯表单，并根据孩子年龄加载预设习惯
    setShowCustomHabitForm(false);
    setCustomHabitTitle('');
    setCustomHabitDesc('');
    setPresetHabits([]);
    // 重置主题任务相关状态（parent_task goal 没有保存 template_id，无法可靠回填；避免错填所以保持未选）
    // 回填已选主题任务：通过 cycleGoals 里 goal_type=parent_task 反查 parent_task_id，再查 task 详情
    // 只读展示标题，不回填到选择状态（避免模板/自定义混淆）；切换时走"删旧建新"
    setSetupExistingParentTask(null);
    const parentTaskGoal = cycleGoals.find((g) => g.goal_type === 'parent_task' && g.parent_task_id);
    if (parentTaskGoal && parentTaskGoal.parent_task_id) {
      try {
        const existingParent = await getTask(Number(parentTaskGoal.parent_task_id));
        if (existingParent && existingParent.id) {
          setSetupExistingParentTask({ id: existingParent.id, title: existingParent.title });
        }
      } catch {
        // parent task 可能已被删除，忽略错误
      }
    }
    // 重置主题任务选择状态（回填只展示已存在标题，不预选模板）
    setSetupThemeTemplateId(null);
    setShowCustomThemeForm(false);
    setCustomThemeTitle('');
    setCustomThemeDesc('');
    setCustomThemeDays(14);
    setCustomThemeCategory('nature');
    setPresetThemeTemplates([]);
    const age = computeChildAge(selectedChild);
    setPresetHabitsLoading(true);
    getPresetHabits(age)
      .then((list) => setPresetHabits(list || []))
      .catch(() => setPresetHabits([]))
      .finally(() => setPresetHabitsLoading(false));
    setPresetThemesLoading(true);
    getPresetTemplates(age)
      .then((list) => setPresetThemeTemplates(list || []))
      .catch(() => setPresetThemeTemplates([]))
      .finally(() => setPresetThemesLoading(false));
    setShowGoalSetup(true);
  };

  // 习惯目标多选 toggle：最多 2 个，超出阻止并提示
  const toggleSetupHabit = (habitId: number) => {
    setSetupHabits((prev) => {
      if (prev.includes(habitId)) {
        return prev.filter((id) => id !== habitId);
      }
      if (prev.length >= 2) {
        toast.error('最多只能选择 2 个习惯目标');
        return prev;
      }
      return [...prev, habitId];
    });
  };

  // 创建自定义习惯：成功后自动加入预设列表并选中（受 2 个上限约束）
  const handleCreateCustomHabit = async () => {
    if (!selectedChildId) return;
    if (!customHabitTitle.trim()) {
      toast.error('请输入习惯标题');
      return;
    }
    setHabitSubmitting(true);
    try {
      const habit = await createCustomHabit({
        child_id: selectedChildId,
        title: customHabitTitle.trim(),
        description: customHabitDesc.trim(),
        category: 'other',
      });
      setPresetHabits((prev) => [...prev, habit]);
      setSetupHabits((prev) => {
        if (prev.includes(habit.id)) return prev;
        if (prev.length >= 2) {
          toast.error('已选满 2 个习惯目标，请先取消一个再选');
          return prev;
        }
        return [...prev, habit.id];
      });
      setCustomHabitTitle('');
      setCustomHabitDesc('');
      setShowCustomHabitForm(false);
      toast.success('习惯已创建并自动选中');
    } catch (e: any) {
      toast.error(e.message || '创建失败');
    } finally {
      setHabitSubmitting(false);
    }
  };

  // 主题任务单选 toggle：再次点击同一个取消选中，点击其他切换选中
  const toggleSetupTheme = (templateId: number) => {
    setSetupThemeTemplateId((prev) => (prev === templateId ? null : templateId));
  };

  // 创建自定义主题模板：成功后加入预设列表并自动选中
  const handleCreateCustomTheme = async () => {
    if (!selectedChildId) return;
    if (!customThemeTitle.trim()) {
      toast.error('请输入主题标题');
      return;
    }
    if (!customThemeDays || customThemeDays <= 0) {
      toast.error('请输入有效的预计周期天数');
      return;
    }
    setThemeSubmitting(true);
    try {
      const template = await createCustomTemplate({
        child_id: selectedChildId,
        title: customThemeTitle.trim(),
        description: customThemeDesc.trim(),
        category: customThemeCategory,
        estimated_days: customThemeDays,
      });
      setPresetThemeTemplates((prev) => [...prev, template]);
      setSetupThemeTemplateId(template.id);
      setCustomThemeTitle('');
      setCustomThemeDesc('');
      setCustomThemeDays(14);
      setCustomThemeCategory('nature');
      setShowCustomThemeForm(false);
      toast.success('主题已创建并自动选中');
    } catch (e: any) {
      toast.error(e.message || '创建失败');
    } finally {
      setThemeSubmitting(false);
    }
  };

  // 提交阶段目标设置
  const handleSaveGoalSetup = async () => {
    if (!selectedChildId) return;
    if (!setupStartDate) {
      toast.error('请选择开始日期');
      return;
    }
    if (setupGoals.length === 0) {
      toast.error('请至少选择一个维度');
      return;
    }
    setGoalSubmitting(true);
    let finalCycleId = cycleId; // 提到 try 外，供主题任务创建部分使用
    try {
      const endDate = computeEndDate(setupStartDate, setupWeeks);
      const startISO = new Date(setupStartDate + 'T00:00:00').toISOString();
      const endISO = new Date(endDate + 'T23:59:59').toISOString();
      const name = `${setupStartDate.slice(5)}-${endDate.slice(5)} 成长阶段`;

      if (!finalCycleId) {
        const cycle = await createCycle(selectedChildId, name, startISO, endISO);
        finalCycleId = cycle.id;
      } else {
        await updateCycle(finalCycleId, name, startISO, endISO);
      }
      // 批量设置阶段目标（合并 dimension 和 habit 目标，不传 target_score）
      // 过滤掉无效的 dimension_id（0/undefined），避免后端 400
      const goals = [
        ...setupGoals
          .filter((dimId) => dimId > 0)
          .map((dimId) => ({
            goal_type: 'dimension',
            dimension_id: dimId,
          })),
        ...setupHabits.map((habitId) => ({
          goal_type: 'habit',
          habit_id: habitId,
        })),
      ];
      await setGoalsBatch({
        cycle_id: finalCycleId,
        child_id: selectedChildId,
        goals,
      });
      toast.success('阶段目标已保存');
      setShowGoalSetup(false);
      const cycleResult = await getCurrentCycle(selectedChildId);
      if (cycleResult.cycle) {
        setCycleId(cycleResult.cycle.id);
        setCycleName(cycleResult.cycle.name);
        setCycleStartDate(cycleResult.cycle.start_date);
        setCycleEndDate(cycleResult.cycle.end_date);
        setProgressList(cycleResult.progress || []);
        setCycleGoals(cycleResult.goals || []);
      }
    } catch (e: any) {
      toast.error(e.message || '保存失败');
      return;
    } finally {
      setGoalSubmitting(false);
    }

    // 主题任务创建：独立 try/catch，失败不阻断维度/习惯目标的保存
    // 切换逻辑：若已存在主题任务且用户选了新模板，先删除旧的再创建新的
    // 路径 1：选中了主题模板（预设或自定义创建）→ 走 template_id
    // 路径 2：用户未选新主题且已有存在主题任务 → 保留旧的，不操作
    const hasNewThemeSelection = setupThemeTemplateId !== null;
    if (hasNewThemeSelection) {
      // 切换：先删除旧的主题任务（含子任务和 goal 关联）
      if (setupExistingParentTask) {
        try {
          await deleteParentTask(setupExistingParentTask.id);
        } catch (e: any) {
          toast.error(e.message || '旧主题任务删除失败，已中止新主题创建以避免重复');
          return; // 删除失败时中断，避免同一周期出现重复 parent_task
        }
      }
      // 创建新主题任务并关联到当前周期
      try {
        const createData: Parameters<typeof createParentTask>[0] = {
          child_id: selectedChildId,
          cycle_id: finalCycleId || undefined,
        };
        if (setupThemeTemplateId !== null) {
          createData.template_id = setupThemeTemplateId;
        }
        const parentTask = await createParentTask(createData);
        // 后端 CreateParentTask 已自动生成子任务大纲；若返回为空则兜底触发一次生成
        if (!parentTask.sub_task_outline) {
          await generateChildren(parentTask.id);
          toast.success('主题任务已创建，子任务大纲生成中');
        } else {
          const count = countSubTaskOutline(parentTask.sub_task_outline);
          toast.success(
            count > 0
              ? `主题任务已创建，已生成 ${count} 个子任务大纲`
              : '主题任务已创建，已生成子任务大纲',
          );
        }
      } catch (e: any) {
        toast.error(e.message || '主题任务创建失败');
      }
    }
  };

  // 综合进度计算
  const overallProgress = progressList.length > 0
    ? Math.round(progressList.reduce((sum, p) => sum + p.progress, 0) / progressList.length)
    : 0;
  const completedDimensions = progressList.filter(p => p.progress >= 100).length;
  const stageLabel = cycleName || '未设置阶段';
  const dimensionGoalIds = cycleGoals
    .filter((g) => (g.goal_type || 'dimension') === 'dimension' && g.dimension_id > 0)
    .map((g) => g.dimension_id);
  const dimensionGoalNames = dimensionGoalIds
    .map((id) => dimensions.find((d) => d.id === id)?.name)
    .filter(Boolean) as string[];
  const goalText = dimensionGoalNames.length > 0
    ? `提升${dimensionGoalNames.join('、')}能力`
    : '为孩子的成长设定阶段性目标';

  // 是否存在未达标的目标（按任务完成进度判断）
  const hasUncompletedGoals = progressList.some(p => p.progress < 100);
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
  const masteryCount = enrichedScores.filter(s => isMastered(s)).length; // 精通维度数（score≥95）

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
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 pt-3 pb-4 px-4 rounded-b-2xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-base font-bold text-white">成长记录</h1>
              <p className="text-white/80 text-xs mt-0.5">记录每一个成长瞬间</p>
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
        {/* V3.1 模块 B：大师挑战入口（有精通星时显示进度横幅，否则显示轻量入口） */}
        {masteryCount >= 1 && masterSummary && (masterSummary.inProgress > 0 || masterSummary.available > 0) ? (
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
        ) : (
          <button
            onClick={() => navigate(`/master-challenges?child_id=${selectedChild.id}`)}
            className="w-full mb-3 flex items-center gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 text-sm font-medium transition-transform active:scale-[0.99]"
          >
            <span className="text-base">🎯</span>
            <span className="flex-1 text-left">大师挑战 · PBL 项目式挑战池</span>
            <ChevronRight size={16} />
          </button>
        )}

        {/* 1. 阶段目标（单一进度条 + 阶段标签） */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">阶段目标</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {stageLabel}
            </span>
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

          {/* 按钮区：家长可见。
              - 没有进行中的周期（cycleId 为空）→ 只显示「设置目标」
              - 有进行中的周期（cycleId 存在）→ 显示「调整目标」+「触发回顾」 */}
          {isParent && (
            <div className="flex gap-2 mt-4">
              {!cycleId ? (
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
                      if (progressList.length === 0) {
                        toast.error('当前阶段尚无维度进度数据，无法回顾');
                        return;
                      }
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

              {/* 本阶段重点简短提示（原 Lv.X + 成长值块已移除 — 思路 C） */}
              {primaryCount > 0 && (
                <div className="flex justify-center mt-1 mb-1">
                  <p className="text-xs text-text-tertiary">
                    本阶段重点 <span className="text-primary font-medium">{primaryCount}/6</span>
                  </p>
                </div>
              )}

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
                    const isLearning = s.dimension_code === 'learning';
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
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
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

            {/* 时间区间：开始日期 + 1-4 周按钮组 */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-text-primary mb-2">开始日期</label>
              <MobileDatePicker
                value={setupStartDate}
                onChange={setSetupStartDate}
                placeholder="请选择开始日期"
                className="w-full px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-left flex items-center justify-between"
              />
              <label className="block text-sm font-medium text-text-primary mb-2 mt-3">阶段时长</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSetupWeeks(w)}
                    className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                      setupWeeks === w
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                    }`}
                  >
                    {w} 周
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-tertiary mt-1.5">
                {setupStartDate
                  ? `阶段结束：${computeEndDate(setupStartDate, setupWeeks)}，阶段结束时将触发成长回顾`
                  : '阶段结束时将触发成长回顾'}
              </p>
            </div>

            {/* 多维度目标（仅勾选，不设目标分值） */}
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
                  const checked = setupGoals.includes(dim.id);
                  return (
                    <div key={dim.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setSetupGoals((prev) =>
                            prev.includes(dim.id)
                              ? prev.filter((id) => id !== dim.id)
                              : [...prev, dim.id],
                          );
                        }}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          checked ? 'border-primary bg-primary' : 'border-gray-300 bg-white'
                        }`}
                      >
                        {checked && <Check size={14} className="text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary">{dim.name}</div>
                        <div className="text-xs text-text-tertiary">当前 {currentScore} 分</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 习惯目标（可选，最多 2 个） */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-text-primary">
                  🌱 习惯目标（可选，最多 2 个）
                </label>
                {setupHabits.length > 0 && (
                  <span className="text-xs font-medium text-emerald-600">
                    已选 {setupHabits.length}/2
                  </span>
                )}
              </div>
              <p className="text-xs text-text-tertiary mb-3">
                培养良好习惯，每日打卡巩固成长
              </p>
              {presetHabitsLoading ? (
                <div className="py-3 text-center text-xs text-text-tertiary">加载预设习惯中...</div>
              ) : presetHabits.length > 0 ? (
                <div className="space-y-2">
                  {presetHabits.map((habit) => {
                    const checked = setupHabits.includes(habit.id);
                    return (
                      <div
                        key={habit.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                          checked
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-gray-50 border-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSetupHabit(habit.id)}
                          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            checked
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {checked && <Check size={14} className="text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                            {habit.title}
                            {!habit.is_system && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-medium">
                                自定义
                              </span>
                            )}
                          </div>
                          {habit.description && (
                            <div className="text-xs text-text-tertiary line-clamp-1">
                              {habit.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-text-tertiary">
                  暂无适配当前年龄的预设习惯
                </div>
              )}

              {/* 自定义习惯入口/表单 */}
              {!showCustomHabitForm ? (
                <button
                  type="button"
                  onClick={() => setShowCustomHabitForm(true)}
                  className="mt-2 w-full py-2 rounded-xl border border-dashed border-emerald-300 text-emerald-600 text-sm font-medium hover:bg-emerald-50 transition-colors"
                >
                  + 自定义习惯
                </button>
              ) : (
                <div className="mt-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2.5">
                  <input
                    type="text"
                    value={customHabitTitle}
                    onChange={(e) => setCustomHabitTitle(e.target.value)}
                    placeholder="习惯标题（如：每天阅读 20 分钟）"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm text-text-primary outline-none focus:border-emerald-400"
                  />
                  <input
                    type="text"
                    value={customHabitDesc}
                    onChange={(e) => setCustomHabitDesc(e.target.value)}
                    placeholder="描述（可选）"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm text-text-primary outline-none focus:border-emerald-400"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomHabitForm(false);
                        setCustomHabitTitle('');
                        setCustomHabitDesc('');
                      }}
                      className="flex-1 py-2 bg-white border border-gray-200 text-text-secondary text-xs rounded-lg"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCustomHabit}
                      disabled={habitSubmitting || !customHabitTitle.trim()}
                      className="flex-1 py-2 bg-emerald-500 text-white text-xs rounded-lg font-medium disabled:opacity-50 hover:bg-emerald-600 transition-colors"
                    >
                      {habitSubmitting ? '创建中...' : '创建并选中'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 主题任务（可选，单选，最多 1 个；蓝紫色调与习惯区绿色区分） */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-text-primary">
                  🎯 主题任务（可选）
                </label>
                {setupThemeTemplateId !== null && (
                  <span className="text-xs font-medium text-indigo-600">
                    已选 1/1
                  </span>
                )}
              </div>
              <p className="text-xs text-text-tertiary mb-3">
                本周期最多开展 1 个主题任务，AI 将自动拆解为分阶段子任务
              </p>
              {setupExistingParentTask && (
                <div className="mb-3 px-3 py-2 bg-indigo-50 rounded-lg flex items-center justify-between">
                  <div className="text-xs text-indigo-700 min-w-0">
                    <span className="text-text-tertiary">当前主题：</span>
                    <span className="font-medium truncate">{setupExistingParentTask.title}</span>
                  </div>
                  <span className="text-[10px] text-indigo-400 flex-shrink-0 ml-2">
                    {setupThemeTemplateId !== null ? '将替换' : '保留'}
                  </span>
                </div>
              )}
              {presetThemesLoading ? (
                <div className="py-3 text-center text-xs text-text-tertiary">加载预设主题中...</div>
              ) : presetThemeTemplates.length > 0 ? (
                <div className="space-y-2">
                  {presetThemeTemplates.map((tpl) => {
                    const checked = setupThemeTemplateId === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => toggleSetupTheme(tpl.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          checked
                            ? 'bg-indigo-50 border-indigo-400 ring-1 ring-indigo-300'
                            : 'bg-gray-50 border-transparent hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* 单选用圆形指示，与习惯多选方形区分 */}
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                              checked ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {checked && <Check size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-text-primary flex items-center gap-1.5 flex-wrap">
                              {tpl.title}
                              {!tpl.is_system && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-medium">
                                  自定义
                                </span>
                              )}
                            </div>
                            {tpl.description && (
                              <div className="text-xs text-text-tertiary line-clamp-2 mt-0.5">
                                {tpl.description}
                              </div>
                            )}
                            <div className="text-[11px] text-text-tertiary mt-1">
                              预计周期 {tpl.estimated_days} 天
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-text-tertiary">
                  暂无适配当前年龄的预设主题
                </div>
              )}

              {/* 自定义主题入口/表单 */}
              {!showCustomThemeForm ? (
                <button
                  type="button"
                  onClick={() => setShowCustomThemeForm(true)}
                  className="mt-2 w-full py-2 rounded-xl border border-dashed border-indigo-300 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors"
                >
                  + 自定义主题
                </button>
              ) : (
                <div className="mt-2 p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2.5">
                  <input
                    type="text"
                    value={customThemeTitle}
                    onChange={(e) => setCustomThemeTitle(e.target.value)}
                    placeholder="主题标题（如：小小科学家养成计划）"
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm text-text-primary outline-none focus:border-indigo-400"
                  />
                  <textarea
                    value={customThemeDesc}
                    onChange={(e) => setCustomThemeDesc(e.target.value)}
                    placeholder="主题描述（可选）"
                    rows={2}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-gray-100 text-sm text-text-primary outline-none focus:border-indigo-400 resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-text-tertiary mb-1">预计周期（天）</label>
                      <DayStepper
                        value={customThemeDays}
                        onChange={setCustomThemeDays}
                        min={7}
                        max={90}
                        className="rounded-lg bg-white"
                        inputClassName="px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-tertiary mb-1">类别</label>
                      <SoftSelect
                        value={customThemeCategory}
                        onChange={setCustomThemeCategory}
                        options={THEME_CATEGORIES}
                        compact
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomThemeForm(false);
                        setCustomThemeTitle('');
                        setCustomThemeDesc('');
                        setCustomThemeDays(14);
                        setCustomThemeCategory('nature');
                      }}
                      className="flex-1 py-2 bg-white border border-gray-200 text-text-secondary text-xs rounded-lg"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCustomTheme}
                      disabled={themeSubmitting || !customThemeTitle.trim()}
                      className="flex-1 py-2 bg-indigo-500 text-white text-xs rounded-lg font-medium disabled:opacity-50 hover:bg-indigo-600 transition-colors"
                    >
                      {themeSubmitting ? '创建中...' : '创建并选中'}
                    </button>
                  </div>
                </div>
              )}
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
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
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
