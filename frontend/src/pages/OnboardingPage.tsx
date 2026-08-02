import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Sparkles, Target, Award, BookOpen } from 'lucide-react';
import { IPPAvatar } from '../components/IPPAvatar';
import { MobileDatePicker } from '../components/MobileDatePicker';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import { getChildScores, getAbilities } from '../services/ability';
import type { ChildAbilityScore, AbilityDimension, FocusLevel } from '../services/ability';
import { setGoal, createCycle } from '../services/growthCycle';
import { generateAITasks } from '../services/tasks';
import type { Task } from '../services/tasks';

// 暖橙色彩常量
const C = {
  bg: '#FFFAF4', primary: '#F59E6B', primaryFg: '#FFFFFF',
  card: '#FFFFFF', muted: '#FFF1E6', mutedFg: '#7A7168', border: '#F5E6D3',
};

// 快速区间预设
const QUICK_RANGES = [
  { label: '7天', days: 7 },
  { label: '14天', days: 14 },
  { label: '1个月', days: 30 },
] as const;

// 与 GrowthPage 一致：年级 × 维度权重（primary 为主轴推荐）
const FOCUS_LEVEL_FALLBACK: Record<number, Record<string, FocusLevel>> = {
  1: { self_care: 'primary', independence: 'latent', hands_on: 'secondary', learning: 'primary', social_emotional: 'latent', health: 'primary' },
  2: { self_care: 'primary', independence: 'latent', hands_on: 'primary', learning: 'secondary', social_emotional: 'secondary', health: 'primary' },
  3: { self_care: 'secondary', independence: 'secondary', hands_on: 'primary', learning: 'primary', social_emotional: 'secondary', health: 'secondary' },
  4: { self_care: 'latent', independence: 'secondary', hands_on: 'secondary', learning: 'primary', social_emotional: 'primary', health: 'secondary' },
  5: { self_care: 'secondary', independence: 'primary', hands_on: 'secondary', learning: 'primary', social_emotional: 'primary', health: 'secondary' },
  6: { self_care: 'primary', independence: 'primary', hands_on: 'primary', learning: 'secondary', social_emotional: 'primary', health: 'primary' },
};

function resolveDimFocus(code: string, grade: number): FocusLevel {
  const g = grade >= 1 && grade <= 6 ? grade : 1;
  return FOCUS_LEVEL_FALLBACK[g]?.[code] || 'secondary';
}

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDateISO(d);
}

function diffDays(startISO: string, endISO: string): number | null {
  if (!startISO || !endISO) return null;
  const a = new Date(startISO + 'T00:00:00').getTime();
  const b = new Date(endISO + 'T00:00:00').getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

// 爱好标签清单
const HOBBY_TAGS = [
  { category: '运动', items: ['跑步', '球类', '游泳', '跳绳'] },
  { category: '艺术', items: ['绘画', '音乐', '手工', '舞蹈'] },
  { category: '学习', items: ['阅读', '拼搭积木', '自然观察', '棋类'] },
];

// 年级到档位映射
function gradeToLevel(grade: number): string {
  const map: Record<number, string> = { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5', 6: 'L6' };
  return map[grade] || 'L1';
}

// 前端与后端一致的周岁计算
export function computeAge(birthdayISO: string): number {
  const b = new Date(birthdayISO);
  const now = new Date();
  if (isNaN(b.getTime())) return 0;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age < 0 ? 0 : age;
}

// 前端与后端一致的 9/1 入学规则年级推算（0=幼儿园/未入学, 1-6 小学）
export function computeGrade(birthdayISO: string): number {
  const b = new Date(birthdayISO);
  const now = new Date();
  if (isNaN(b.getTime())) return 0;
  const enrollAge = 6;
  let baseYear = now.getFullYear();
  if (now.getMonth() + 1 < 9) baseYear--;
  let enrollYear = b.getFullYear() + enrollAge;
  if (b.getMonth() + 1 >= 9) enrollYear++;
  let g = (baseYear - enrollYear) + 1;
  if (g < 0) g = 0;
  if (g > 6) g = 6;
  return g;
}

function gradeName(g: number): string {
  if (g <= 0) return '幼儿园';
  return ['一', '二', '三', '四', '五', '六'][g - 1] + '年级';
}

function formatBirthdayMD(birthdayISO: string | null | undefined): string {
  if (!birthdayISO) return '';
  const d = new Date(birthdayISO);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 各档位题数（用于 Step 5 预告，实际以后端返回为准）
const LEVEL_QUESTION_COUNT: Record<string, number> = {
  L1: 16, L2: 16, L3: 18, L4: 18, L5: 18, L6: 18,
};

// 内联雷达图组件（复用 GrowthPage 的实现）
function RadarChartSVG({ scores }: { scores: ChildAbilityScore[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 70;
  const labelRadius = 90;
  const levels = [maxRadius, (maxRadius * 2) / 3, maxRadius / 3];
  const n = scores.length;
  const angles = Array.from({ length: n }, (_, i) => -90 + (360 / n) * i);

  function getPoint(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }
  function polygonPoints(radius: number) {
    return angles.map((a) => {
      const p = getPoint(a, radius);
      return `${p.x},${p.y}`;
    }).join(' ');
  }

  const dataPoints = scores.map((s, i) => {
    const radius = (Math.max(0, Math.min(100, s.score)) / 100) * maxRadius;
    return getPoint(angles[i], radius);
  });
  const dataPolygonStr = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={220} height={180} viewBox={`0 0 ${size} ${size}`}>
      {levels.map((r, i) => (
        <polygon key={i} points={polygonPoints(r)} fill="none" stroke="#e5e7eb" strokeWidth="1" />
      ))}
      {angles.map((a, i) => {
        const p = getPoint(a, maxRadius);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {n > 0 && (
        <>
          <polygon points={dataPolygonStr} fill="rgba(245,158,107,0.15)" stroke={C.primary} strokeWidth="2" />
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill={C.primary} />
          ))}
        </>
      )}
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

export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToastStore();
  const childStore = useChildStore();

  // 支持 URL 参数直接进入 Step 6
  const initialStep = searchParams.get('step') === '6' ? 6 : 1;
  const urlChildId = Number(searchParams.get('child_id') || 0);

  const [step, setStep] = useState(initialStep); // 1-6
  const [nickname, setNickname] = useState('');
  const [birthday, setBirthday] = useState<string>(''); // YYYY-MM-DD
  const [age, setAge] = useState<number | null>(null); // 冗余，若用户未提供 birthday 时 fallback
  const [grade, setGrade] = useState<number | null>(null); // 手动覆盖的 grade（若覆盖）
  const [gradeOverridden, setGradeOverridden] = useState<boolean>(false);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const onboardingMode = searchParams.get('mode') || 'register'; // 'register' (首次) | 'add_child' (从家庭管理添加)

  // 推算的年龄/年级（以 Birthday 为主驱动）
  const derivedAge = useMemo(() => (birthday ? computeAge(birthday) : age ?? 0), [birthday, age]);
  const derivedGrade = useMemo(() => {
    if (gradeOverridden && grade !== null) return grade;
    if (birthday) return computeGrade(birthday);
    return grade ?? 0;
  }, [birthday, grade, gradeOverridden]);
  // 兼容现有 UI/问卷映射：如果是 0（幼儿园），也需要档位 —— 回退到 L1（保证旧题库可用）
  const level = gradeToLevel(derivedGrade);
  const questionCount = LEVEL_QUESTION_COUNT[level] || 16;

  // Step 6 状态
  const [scores, setScores] = useState<ChildAbilityScore[]>([]);
  const [dimensions, setDimensions] = useState<AbilityDimension[]>([]);
  const [setupStartDate, setSetupStartDate] = useState('');
  const [setupEndDate, setSetupEndDate] = useState('');
  const [setupGoals, setSetupGoals] = useState<Record<number, number>>({});
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalSaved, setGoalSaved] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<Task[]>([]);
  const [generating, setGenerating] = useState(false);
  const [step6Grade, setStep6Grade] = useState(0);
  const [goalsPrefilled, setGoalsPrefilled] = useState(false);

  // Step 6 初始化：加载能力分数、维度、年级
  useEffect(() => {
    if (step === 6 && urlChildId) {
      getChildScores(urlChildId).then(setScores).catch(() => {});
      getAbilities().then(setDimensions).catch(() => {});
      // 默认今天起 30 天（1个月）
      const start = formatDateISO(new Date());
      setSetupStartDate(start);
      setSetupEndDate(addDays(start, 30));
      // 从孩子档案取年级（问卷返回后本地 birthday 状态可能已丢失）
      childStore.fetchChildren().then(() => {
        const child = useChildStore.getState().children.find((c) => c.id === urlChildId);
        const g = child?.derived_grade ?? child?.grade ?? derivedGrade ?? 1;
        setStep6Grade(g && g > 0 ? g : 1);
      }).catch(() => {
        setStep6Grade(derivedGrade > 0 ? derivedGrade : 1);
      });
    }
  }, [step, urlChildId]);

  // 按年级预勾选主轴维度（仅首次）
  useEffect(() => {
    if (step !== 6 || goalsPrefilled || dimensions.length === 0 || !step6Grade) return;
    const goals: Record<number, number> = {};
    for (const dim of dimensions) {
      if (resolveDimFocus(dim.code, step6Grade) === 'primary') {
        goals[dim.id] = 20;
      }
    }
    setSetupGoals(goals);
    setGoalsPrefilled(true);
  }, [step, dimensions, step6Grade, goalsPrefilled]);

  const activeQuickDays = useMemo(
    () => diffDays(setupStartDate, setupEndDate),
    [setupStartDate, setupEndDate],
  );

  const applyQuickRange = (days: number) => {
    const start = setupStartDate || formatDateISO(new Date());
    setSetupStartDate(start);
    setSetupEndDate(addDays(start, days));
  };

  const recommendedDims = useMemo(() => {
    if (!step6Grade || dimensions.length === 0) return [];
    return dimensions.filter((d) => resolveDimFocus(d.code, step6Grade) === 'primary');
  }, [dimensions, step6Grade]);

  // IP 表情联动
  const ipExpression: 'happy' | 'encourage' | 'think' | 'proud' =
    step === 1 ? 'happy'
    : step === 2 ? (nickname.trim() ? 'encourage' : 'think')
    : step === 3 ? (grade ? 'happy' : 'think')
    : step === 4 ? (hobbies.length > 0 ? 'proud' : 'happy')
    : step === 5 ? 'encourage'
    : 'proud'; // Step 6

  const handleNext = () => {
    if (step < 5) setStep(step + 1);
  };
  const handlePrev = () => {
    if (step > 1 && step < 6) setStep(step - 1);
  };

  const toggleHobby = (tag: string) => {
    if (hobbies.includes(tag)) {
      setHobbies(hobbies.filter((h) => h !== tag));
    } else {
      setHobbies([...hobbies, tag]);
    }
  };

  // Step 5: 创建儿童档案并跳转问卷（birthday 主驱动）
  const handleStartQuestionnaire = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const hobbiesJSON = JSON.stringify(hobbies);
      const child = await childStore.addChild({
        nickname: nickname.trim(),
        birthday: birthday || undefined,
        grade: (gradeOverridden && grade !== null) ? grade : (birthday ? undefined : grade || undefined),
        grade_overridden: gradeOverridden,
        age: birthday ? undefined : (age || undefined),
        hobbies: hobbiesJSON,
      });
      childStore.setCurrentChildId(child.id);
      toast.success('档案创建成功！');
      // 增加 return=onboarding 参数，问卷完成后返回 Onboarding Step 6
      // mode 参数传递：add_child 走完后跳回家庭管理
      const returnPath = `onboarding&mode=${onboardingMode}`;
      navigate(`/questionnaire?stage=register&level=${level}&child_id=${child.id}&return=${encodeURIComponent(returnPath)}`, { replace: true });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : '创建档案失败');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 6B: 保存阶段目标
  const handleSaveGoals = async () => {
    if (!urlChildId) return;
    if (!setupStartDate || !setupEndDate) {
      toast.error('请选择时间区间');
      return;
    }
    const goalEntries = Object.entries(setupGoals).filter(([, v]) => v > 0);
    if (goalEntries.length === 0) {
      toast.error('请至少为一个维度设置目标');
      return;
    }
    setGoalSaving(true);
    try {
      const startISO = new Date(setupStartDate + 'T00:00:00').toISOString();
      const endISO = new Date(setupEndDate + 'T23:59:59').toISOString();
      const name = `${setupStartDate.slice(5)}-${setupEndDate.slice(5)} 成长阶段`;
      const cycle = await createCycle(urlChildId, name, startISO, endISO);
      for (const [dimId, target] of goalEntries) {
        await setGoal(cycle.id, urlChildId, Number(dimId), target);
      }
      toast.success('阶段目标已保存');
      setGoalSaved(true);
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setGoalSaving(false);
    }
  };

  // Step 6C: 生成任务
  const handleGenerateTasks = async () => {
    if (!urlChildId || generating) return;
    setGenerating(true);
    try {
      const res = await generateAITasks(urlChildId);
      setGeneratedTasks(res.tasks || []);
      if ((res.tasks || []).length === 0) {
        toast.error('暂未生成任务，请稍后重试或检查 AI 配置');
      } else {
        toast.success(`已生成 ${res.count} 个任务`);
      }
    } catch (e: any) {
      toast.error(e.message || '生成任务失败');
    } finally {
      setGenerating(false);
    }
  };

  // 校验：当前步骤是否可下一步
  const canNext =
    step === 1 ? true
    : step === 2 ? nickname.trim().length > 0 && nickname.trim().length <= 20
    : step === 3 ? !!birthday // birthday 必填，作为唯一可信源
    : step === 4 ? hobbies.length > 0
    : true;

  const toggleGoalDim = (dimId: number) => {
    if (setupGoals[dimId]) {
      const next = { ...setupGoals };
      delete next[dimId];
      setSetupGoals(next);
    } else {
      setSetupGoals({ ...setupGoals, [dimId]: 20 });
    }
  };
  const setGoalScore = (dimId: number, score: number) => {
    setSetupGoals({ ...setupGoals, [dimId]: score });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>
      {/* 顶部：进度圆点 + 返回 */}
      <header className="sticky top-0 z-20 px-4 pt-4 pb-2" style={{ background: C.bg }}>
        <div className="max-w-[448px] mx-auto flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={step === 1 || step === 6}
            className="w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-30"
            style={{ background: C.muted, color: C.mutedFg }}
            aria-label="上一步"
          >
            <ChevronLeft size={20} />
          </button>
          {/* 6 个进度圆点 */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`rounded-full transition-all ${s === step ? 'w-6 h-2.5' : 'w-2.5 h-2.5'}`}
                style={{
                  background: s <= step ? C.primary : C.border,
                  animation: s === step ? 'pulse 1.5s ease-in-out infinite' : undefined,
                }}
              />
            ))}
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-4">
        <div className="w-full max-w-[448px] mx-auto" key={step} style={{ animation: 'cardEnter 0.4s ease-out' }}>
          {/* IP 形象（Step 1-5 通用） */}
          {step < 6 && (
            <div className="flex flex-col items-center mb-8">
              <div className="w-32 h-32 rounded-2xl shadow-md flex items-center justify-center mb-4" style={{ background: C.muted }}>
                <IPPAvatar expression={ipExpression} size={96} />
              </div>
            </div>
          )}

          {/* Step 1: 欢迎页 + 平台简介（3 卡） */}
          {step === 1 && (
            <div className="text-center">
              {/* IP 对话气泡 */}
              <div className="inline-flex items-start gap-2 px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm mb-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <p className="text-sm text-left leading-6" style={{ color: '#2D2A26' }}>
                  嗨！我是小萌芽 🌱<br />一颗会和小朋友一起「长大」的小种子～
                </p>
              </div>

              <h1 className="text-xl font-bold mb-1" style={{ color: '#2D2A26' }}>
                童劳童得
              </h1>
              <p className="text-sm mb-6" style={{ color: C.mutedFg }}>
                陪孩子认真长大的家庭成长伙伴
              </p>

              {/* 3 张能力卡片 */}
              <div className="space-y-3 text-left">
                <div className="flex items-start gap-3 p-4 rounded-2xl shadow-sm" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFF1E6' }}>
                    <Target size={18} style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: '#2D2A26' }}>任务 · 目标 · 积分</p>
                    <p className="text-xs leading-5" style={{ color: C.mutedFg }}>完成适合的小任务，积分兑换家庭小奖励</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-2xl shadow-sm" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFF1E6' }}>
                    <Award size={18} style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: '#2D2A26' }}>AI 六维能力评估</p>
                    <p className="text-xs leading-5" style={{ color: C.mutedFg }}>专属问卷了解孩子，AI 个性化生成每日成长任务</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-2xl shadow-sm" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#FFF1E6' }}>
                    <BookOpen size={18} style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-0.5" style={{ color: '#2D2A26' }}>阶段回顾 · 成长故事</p>
                    <p className="text-xs leading-5" style={{ color: C.mutedFg }}>每月回顾能力变化，生成可珍藏的成长故事绘本</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: 姓名收集（明确是儿童姓名） */}
          {step === 2 && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm mb-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <p className="text-sm" style={{ color: '#2D2A26' }}>
                  {nickname.trim() ? `${nickname.trim()}，真好听的名字！` : '小朋友叫什么名字呀？'}
                </p>
              </div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canNext) handleNext(); }}
                placeholder="请输入宝宝的名字"
                maxLength={20}
                autoFocus
                className="w-full max-w-xs mx-auto px-4 py-3 rounded-lg outline-none text-center text-lg font-medium"
                style={{ background: C.muted, border: `2px solid ${C.border}`, color: '#2D2A26' }}
              />
            </div>
          )}

          {/* Step 3: 生日 / 年龄 / 年级（生日为主驱动，每年自动滚动） */}
          {step === 3 && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm mb-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <p className="text-sm" style={{ color: '#2D2A26' }}>小朋友是哪一天出生的呀？🎂</p>
              </div>

              {/* 生日日期选择器 */}
              <p className="text-xs font-semibold mb-2" style={{ color: C.mutedFg }}>出生年月日</p>
              <div className="w-full max-w-xs mx-auto mb-5">
                <MobileDatePicker
                  value={birthday}
                  max={new Date().toISOString().slice(0, 10)}
                  min="2010-01-01"
                  placeholder="选择出生日期"
                  onChange={(v) => {
                    setBirthday(v);
                    if (gradeOverridden) setGradeOverridden(false);
                  }}
                  className="w-full px-4 py-3 rounded-lg outline-none text-base font-medium flex items-center justify-between"
                  style={{ background: C.muted, border: `2px solid ${birthday ? C.primary : C.border}`, color: '#2D2A26' }}
                />
              </div>

              {/* 推算显示：年龄 · 年级 · 生日 MD */}
              <div className="rounded-2xl p-4 mb-4 shadow-sm inline-block min-w-[260px]" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                {birthday ? (
                  <div>
                    <p className="text-lg font-bold mb-1" style={{ color: '#2D2A26' }}>
                      {derivedAge} 岁 · {gradeName(derivedGrade)}
                    </p>
                    <p className="text-xs" style={{ color: C.mutedFg }}>
                      今年 {formatBirthdayMD(birthday)} 过生日 🎂
                    </p>
                    <p className="text-[11px] mt-2" style={{ color: C.mutedFg }}>
                      按 9 月 1 日入学规则自动推算
                    </p>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: C.mutedFg }}>选择生日后会自动显示年龄和年级哦</p>
                )}
              </div>

              {/* 手动调整年级 */}
              {birthday && (
                <div>
                  <button
                    onClick={() => {
                      if (!gradeOverridden) {
                        setGrade(derivedGrade);
                        setGradeOverridden(true);
                      } else {
                        setGradeOverridden(false);
                      }
                    }}
                    className="text-xs underline mb-2"
                    style={{ color: C.primary }}
                  >
                    {gradeOverridden ? '使用系统推算年级' : '不对？手动调整年级'}
                  </button>

                  {gradeOverridden && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold mb-2" style={{ color: C.mutedFg }}>选择年级</p>
                      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                        {[0, 1, 2, 3, 4, 5, 6].map((g) => (
                          <button
                            key={g}
                            onClick={() => setGrade(g)}
                            className="py-2 rounded-lg text-xs font-medium transition-all active:scale-95"
                            style={{
                              background: grade === g ? C.primary : C.muted,
                              color: grade === g ? C.primaryFg : '#2D2A26',
                              border: `2px solid ${grade === g ? C.primary : 'transparent'}`,
                            }}
                          >
                            {gradeName(g)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: 爱好收集 */}
          {step === 4 && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm mb-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <p className="text-sm" style={{ color: '#2D2A26' }}>小朋友平时喜欢做什么呀？可以多选哦~</p>
              </div>
              <div className="space-y-4">
                {HOBBY_TAGS.map((group) => (
                  <div key={group.category}>
                    <p className="text-xs font-semibold mb-2" style={{ color: C.mutedFg }}>{group.category}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {group.items.map((tag) => {
                        const selected = hobbies.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleHobby(tag)}
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 flex items-center gap-1"
                            style={{
                              background: selected ? C.primary : C.muted,
                              color: selected ? C.primaryFg : '#2D2A26',
                              border: `2px solid ${selected ? C.primary : 'transparent'}`,
                            }}
                          >
                            {selected && <Check size={14} />}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: 问卷预告 */}
          {step === 5 && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm mb-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <p className="text-sm" style={{ color: '#2D2A26' }}>我还想多了解小朋友一点点，这样能给更适合的任务~</p>
              </div>
              <div className="rounded-xl p-4 mb-2 text-left" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.muted }}>
                    <Sparkles size={14} style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#2D2A26' }}>大概 {questionCount} 题</p>
                    <p className="text-xs" style={{ color: C.mutedFg }}>根据年级匹配的专属问卷</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.muted }}>
                    <Check size={14} style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#2D2A26' }}>每题都有进度提示</p>
                    <p className="text-xs" style={{ color: C.mutedFg }}>轻松回答，不紧张</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.muted }}>
                    <ChevronLeft size={14} style={{ color: C.primary }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#2D2A26' }}>可以随时返回修改</p>
                    <p className="text-xs" style={{ color: C.mutedFg }}>答错了也没关系</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: 能力雷达图 + 阶段目标 + 任务生成 */}
          {step === 6 && (
            <div>
              {/* IP 头像 + 气泡 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.muted }}>
                  <IPPAvatar expression="proud" size={44} />
                </div>
                <div className="px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <p className="text-sm" style={{ color: '#2D2A26' }}>这是小朋友的能力小档案~</p>
                </div>
              </div>

              {/* 6A: 雷达图 */}
              <div className="rounded-2xl p-5 shadow-sm mb-4 flex flex-col items-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <p className="text-sm font-semibold mb-2" style={{ color: '#2D2A26' }}>能力维度</p>
                {scores.length > 0 ? (
                  <RadarChartSVG scores={scores} />
                ) : (
                  <p className="text-sm py-8" style={{ color: C.mutedFg }}>加载中...</p>
                )}
              </div>

              {/* 6B: 阶段目标设置 */}
              {!goalSaved && (
                <div className="rounded-2xl p-5 shadow-sm mb-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={16} style={{ color: C.primary }} />
                    <p className="text-sm font-semibold" style={{ color: '#2D2A26' }}>设置阶段目标</p>
                  </div>
                  {/* 快速区间 */}
                  <div className="mb-3">
                    <p className="text-xs mb-1.5" style={{ color: C.mutedFg }}>快速设置区间</p>
                    <div className="flex gap-2">
                      {QUICK_RANGES.map((r) => {
                        const active = activeQuickDays === r.days;
                        return (
                          <button
                            key={r.days}
                            type="button"
                            onClick={() => applyQuickRange(r.days)}
                            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                            style={{
                              background: active ? C.primary : C.muted,
                              color: active ? C.primaryFg : '#2D2A26',
                              border: `1px solid ${active ? C.primary : C.border}`,
                            }}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* 日期区间 */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <p className="text-xs mb-1" style={{ color: C.mutedFg }}>开始</p>
                      <MobileDatePicker
                        value={setupStartDate}
                        onChange={(v) => {
                          setSetupStartDate(v);
                          if (v && activeQuickDays && QUICK_RANGES.some((r) => r.days === activeQuickDays)) {
                            setSetupEndDate(addDays(v, activeQuickDays));
                          }
                        }}
                        placeholder="开始日期"
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none flex items-center justify-between"
                        style={{ background: C.muted, border: `1px solid ${C.border}`, color: '#2D2A26' }}
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: C.mutedFg }}>结束</p>
                      <MobileDatePicker
                        value={setupEndDate}
                        onChange={setSetupEndDate}
                        placeholder="结束日期"
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none flex items-center justify-between"
                        style={{ background: C.muted, border: `1px solid ${C.border}`, color: '#2D2A26' }}
                      />
                    </div>
                  </div>
                  {/* 年级推荐提示 */}
                  {step6Grade > 0 && recommendedDims.length > 0 && (
                    <div
                      className="rounded-xl px-3 py-2.5 mb-3 text-xs leading-relaxed"
                      style={{ background: 'rgba(245,158,107,0.12)', color: '#2D2A26', border: `1px solid ${C.border}` }}
                    >
                      根据<strong>{gradeName(step6Grade)}</strong>推荐优先设置：
                      {recommendedDims.map((d) => d.name).join('、')}
                      <span style={{ color: C.mutedFg }}>（已预勾选，可按需调整）</span>
                    </div>
                  )}
                  {/* 维度目标列表 */}
                  <div className="space-y-2 mb-4">
                    {dimensions.map((dim) => {
                      const selected = !!setupGoals[dim.id];
                      const targetScore = setupGoals[dim.id] || 20;
                      const focus = resolveDimFocus(dim.code, step6Grade || 1);
                      const recommended = focus === 'primary';
                      return (
                        <div
                          key={dim.id}
                          className="flex items-center gap-2 rounded-xl px-2 py-1.5"
                          style={{
                            background: recommended ? 'rgba(245,158,107,0.08)' : 'transparent',
                            border: recommended ? `1px solid rgba(245,158,107,0.25)` : '1px solid transparent',
                          }}
                        >
                          <button
                            onClick={() => toggleGoalDim(dim.id)}
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{
                              background: selected ? C.primary : 'transparent',
                              border: `2px solid ${selected ? C.primary : C.border}`,
                            }}
                          >
                            {selected && <Check size={14} style={{ color: C.primaryFg }} />}
                          </button>
                          <span className="text-sm flex-1 flex items-center gap-1.5" style={{ color: '#2D2A26' }}>
                            {dim.name}
                            {recommended && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                                style={{ background: C.primary, color: C.primaryFg }}
                              >
                                推荐
                              </span>
                            )}
                            {focus === 'latent' && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-md"
                                style={{ background: C.muted, color: C.mutedFg }}
                              >
                                蓄势
                              </span>
                            )}
                          </span>
                          <select
                            value={targetScore}
                            onChange={(e) => setGoalScore(dim.id, Number(e.target.value))}
                            disabled={!selected}
                            className="px-2 py-1 rounded-lg text-sm outline-none"
                            style={{ background: C.muted, border: `1px solid ${C.border}`, color: '#2D2A26', opacity: selected ? 1 : 0.5 }}
                          >
                            {[10, 20, 30, 40, 50, 60, 80, 100].map((v) => (
                              <option key={v} value={v}>{v}分</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleSaveGoals}
                    disabled={goalSaving}
                    className="w-full py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: C.primary, color: C.primaryFg }}
                  >
                    {goalSaving ? '保存中...' : '保存目标'}
                  </button>
                </div>
              )}

              {/* 6C: 生成任务 */}
              {goalSaved && (
                <div className="rounded-2xl p-5 shadow-sm mb-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} style={{ color: C.primary }} />
                    <p className="text-sm font-semibold" style={{ color: '#2D2A26' }}>生成专属任务</p>
                  </div>
                  {generatedTasks.length === 0 ? (
                    <button
                      onClick={handleGenerateTasks}
                      disabled={generating}
                      className="w-full py-2.5 rounded-xl font-medium text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: C.primary, color: C.primaryFg }}
                    >
                      {generating ? '小萌芽正在设计任务...' : '点击生成任务'}
                      <Sparkles size={14} />
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {generatedTasks.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: C.muted }}>
                          <span className="text-sm" style={{ color: '#2D2A26' }}>{t.title}</span>
                          <span className="text-xs font-medium" style={{ color: C.primary }}>+{t.points}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 底部按钮 */}
      <footer className="sticky bottom-0 z-20 px-6 py-4" style={{ background: C.bg, paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="max-w-[448px] mx-auto">
          {step < 5 && (
            <button
              onClick={handleNext}
              disabled={!canNext}
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: C.primary, color: C.primaryFg }}
            >
              {step === 1 ? '开始我们的旅程' : '下一步'}
              <ChevronRight size={18} />
            </button>
          )}
          {step === 5 && (
            <button
              onClick={handleStartQuestionnaire}
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: C.primary, color: C.primaryFg }}
            >
              {submitting ? '准备中...' : '准备好了，开始！'}
              <Sparkles size={18} />
            </button>
          )}
          {step === 6 && goalSaved && generatedTasks.length > 0 && (
            <button
              onClick={() => {
                if (onboardingMode === 'add_child') {
                  navigate('/settings/family', { replace: true });
                } else {
                  navigate('/growth', { replace: true });
                }
              }}
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{ background: C.primary, color: C.primaryFg }}
            >
              {onboardingMode === 'add_child' ? '回到家庭管理' : '进入成长主页'}
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default OnboardingPage;
