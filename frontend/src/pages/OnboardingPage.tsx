import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Sparkles, Target } from 'lucide-react';
import { IPPAvatar } from '../components/IPPAvatar';
import { useChildStore } from '../stores/childStore';
import { useToastStore } from '../stores/toastStore';
import { getChildScores, getAbilities } from '../services/ability';
import type { ChildAbilityScore, AbilityDimension } from '../services/ability';
import { setGoal, createCycle } from '../services/growthCycle';
import { generateAITasks } from '../services/tasks';
import type { Task } from '../services/tasks';

// 暖橙色彩常量
const C = {
  bg: '#FFFAF4', primary: '#F59E6B', primaryFg: '#FFFFFF',
  card: '#FFFFFF', muted: '#FFF1E6', mutedFg: '#7A7168', border: '#F5E6D3',
};

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
    <svg width={180} height={180} viewBox={`0 0 ${size} ${size}`}>
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
  const [age, setAge] = useState<number | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const level = grade ? gradeToLevel(grade) : 'L1';
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

  // Step 6 初始化：加载能力分数和维度
  useEffect(() => {
    if (step === 6 && urlChildId) {
      getChildScores(urlChildId).then(setScores).catch(() => {});
      getAbilities().then(setDimensions).catch(() => {});
      // 默认今天起 30 天
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 30);
      setSetupStartDate(now.toISOString().slice(0, 10));
      setSetupEndDate(end.toISOString().slice(0, 10));
    }
  }, [step, urlChildId]);

  // IP 表情联动
  const ipExpression: 'happy' | 'encourage' | 'think' | 'proud' =
    step === 1 ? 'happy'
    : step === 2 ? (nickname.trim() ? 'encourage' : 'think')
    : step === 3 ? (grade ? 'happy' : 'think')
    : step === 4 ? (hobbies.length > 0 ? 'proud' : 'happy')
    : step === 5 ? 'encourage'
    : 'proud'; // Step 6

  // IP 阶段（Onboarding 期间固定 sprout 萌芽）
  const ipGrowthIndex = 10;

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

  // Step 5: 创建儿童档案并跳转问卷
  const handleStartQuestionnaire = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const hobbiesJSON = JSON.stringify(hobbies);
      const child = await childStore.addChild({
        nickname: nickname.trim(),
        age: age || undefined,
        grade: grade || undefined,
        hobbies: hobbiesJSON,
      });
      childStore.setCurrentChildId(child.id);
      toast.success('档案创建成功！');
      // 增加 return=onboarding 参数，问卷完成后返回 Onboarding Step 6
      navigate(`/questionnaire?stage=register&level=${level}&child_id=${child.id}&return=onboarding`, { replace: true });
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
    : step === 3 ? grade !== null && age !== null
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
                <IPPAvatar growthIndex={ipGrowthIndex} expression={ipExpression} size={96} animated />
              </div>
            </div>
          )}

          {/* Step 1: 欢迎页 */}
          {step === 1 && (
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2" style={{ color: '#2D2A26' }}>
                嗨！我是小萌芽 🌱
              </h1>
              <p className="text-sm mb-8" style={{ color: C.mutedFg }}>
                一颗会陪着你一起长大的小种子，很高兴认识你！
              </p>
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

          {/* Step 3: 年龄年级收集 */}
          {step === 3 && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm mb-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <p className="text-sm" style={{ color: '#2D2A26' }}>小朋友几岁啦？上几年级呢？</p>
              </div>

              {/* 年龄选择 */}
              <p className="text-xs font-semibold mb-2" style={{ color: C.mutedFg }}>年龄</p>
              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {[6, 7, 8, 9, 10, 11, 12].map((a) => (
                  <button
                    key={a}
                    onClick={() => setAge(a)}
                    className="w-12 h-12 rounded-lg font-bold text-sm transition-all active:scale-95"
                    style={{
                      background: age === a ? C.primary : C.muted,
                      color: age === a ? C.primaryFg : '#2D2A26',
                      border: `2px solid ${age === a ? C.primary : 'transparent'}`,
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>

              {/* 年级选择 */}
              <p className="text-xs font-semibold mb-2" style={{ color: C.mutedFg }}>年级</p>
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                {[1, 2, 3, 4, 5, 6].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className="py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                    style={{
                      background: grade === g ? C.primary : C.muted,
                      color: grade === g ? C.primaryFg : '#2D2A26',
                      border: `2px solid ${grade === g ? C.primary : 'transparent'}`,
                    }}
                  >
                    {['一', '二', '三', '四', '五', '六'][g - 1]}年级
                  </button>
                ))}
              </div>
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
                  <IPPAvatar growthIndex={10} expression="proud" size={44} />
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
                  {/* 日期区间 */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <p className="text-xs mb-1" style={{ color: C.mutedFg }}>开始</p>
                      <input
                        type="date"
                        value={setupStartDate}
                        onChange={(e) => setSetupStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: C.muted, border: `1px solid ${C.border}`, color: '#2D2A26' }}
                      />
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: C.mutedFg }}>结束</p>
                      <input
                        type="date"
                        value={setupEndDate}
                        onChange={(e) => setSetupEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: C.muted, border: `1px solid ${C.border}`, color: '#2D2A26' }}
                      />
                    </div>
                  </div>
                  {/* 维度目标列表 */}
                  <div className="space-y-2 mb-4">
                    {dimensions.map((dim) => {
                      const selected = !!setupGoals[dim.id];
                      const targetScore = setupGoals[dim.id] || 20;
                      return (
                        <div key={dim.id} className="flex items-center gap-2">
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
                          <span className="text-sm flex-1" style={{ color: '#2D2A26' }}>{dim.name}</span>
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
              onClick={() => navigate('/growth', { replace: true })}
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{ background: C.primary, color: C.primaryFg }}
            >
              进入成长主页
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default OnboardingPage;
