import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getQuestionnaire, submitQuestionnaire } from '../services/questionnaire';
import type { Question, Questionnaire as QuestionnaireType, AnswerInput } from '../services/questionnaire';
// V3.1 思路 C：IP 不再按成长指数切形态，无需 getGrowthIndex import
import { IPPAvatar } from '../components/IPPAvatar';
import { useToastStore } from '../stores/toastStore';

// 暖橙色彩常量
const C = {
  bg: '#FFFAF4', primary: '#F59E6B', primaryFg: '#FFFFFF',
  card: '#FFFFFF', muted: '#FFF1E6', mutedFg: '#7A7168', border: '#F5E6D3',
};

export function QuestionnairePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const stage = searchParams.get('stage') || 'register';
  const level = searchParams.get('level') || '';
  const childId = Number(searchParams.get('child_id') || 0);

  const [questionnaire, setQuestionnaire] = useState<QuestionnaireType | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // questionId -> optionIndex
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuestionnaire(stage, level)
      .then((q) => {
        setQuestionnaire(q);
        try {
          setQuestions(JSON.parse(q.questions));
        } catch {
          setQuestions([]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [stage, level]);

  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === questions.length - 1;

  // IP 表情随答题进度切换
  const ipExpression: 'think' | 'happy' | 'proud' =
    isFirst ? 'think' : isLast ? 'proud' : 'happy';

  // IP 气泡文案动态变化
  const ipBubbleText = isFirst
    ? '小萌芽想了解你~'
    : isLast
    ? '就快完成啦，加油！'
    : '答得不错哦，继续~';

  const handleSelect = (optionIdx: number) => {
    if (!currentQ) return;
    const wasEmpty = answers[currentQ.id] === undefined;
    setAnswers({ ...answers, [currentQ.id]: optionIdx });
    // 首次作答（空 → 有值）且非最后一题：自动进入下一题；改选不跳转
    if (wasEmpty && currentIdx < questions.length - 1) {
      const fromIdx = currentIdx;
      setTimeout(() => {
        setCurrentIdx((i) => (i === fromIdx ? i + 1 : i));
      }, 280);
    }
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleSubmit = async () => {
    if (!questionnaire) return;
    setSubmitting(true);
    const answerList: AnswerInput[] = questions.map((q) => ({
      question_id: q.id,
      dimension_id: q.dimension_id,
      score: answers[q.id] !== undefined ? q.options[answers[q.id]].score : 1,
    }));
    try {
      const res = await submitQuestionnaire(questionnaire.id, stage, childId, answerList);
      // 检测是否从 onboarding 进入：若是则返回 Onboarding Step 6 展示雷达图+目标设置+任务生成
      const returnTo = searchParams.get('return');
      if (returnTo && (returnTo === 'onboarding' || returnTo.startsWith('onboarding'))) {
        // 解析可能带的 mode 参数（格式 "onboarding&mode=add_child"）
        let mode = 'register';
        const modeMatch = returnTo.match(/mode=([^&]+)/);
        if (modeMatch) mode = modeMatch[1];
        navigate(`/onboarding?step=6&child_id=${childId}&mode=${encodeURIComponent(mode)}`, { replace: true });
      } else {
        toast.success(res.reward > 0 ? `问卷完成！获得 ${res.reward} 积分` : '问卷完成！');
        setTimeout(() => navigate('/growth'), 1500);
      }
    } catch {
      toast.error('提交失败');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <p style={{ color: C.mutedFg }}>加载中...</p>
      </div>
    );
  }
  if (!currentQ) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <p style={{ color: C.mutedFg }}>暂无问卷</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg }}>
      {/* 顶部进度区 */}
      <header
        className="sticky top-0 z-20 pt-6 pb-4 px-5 rounded-b-3xl"
        style={{ background: `linear-gradient(135deg, ${C.primary}, #F5A572)` }}
      >
        <div className="max-w-[448px] mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
              aria-label="返回"
            >
              <ChevronLeft size={20} style={{ color: C.primaryFg }} />
            </button>
            <span className="font-medium text-sm" style={{ color: C.primaryFg }}>{questionnaire?.title}</span>
            <div className="w-9" />
          </div>

          {/* 连续进度条 */}
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.28)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: C.primaryFg,
              }}
            />
          </div>
          <div className="text-center text-xs mt-2" style={{ color: 'rgba(255,255,255,0.85)' }}>
            第 {currentIdx + 1} / {questions.length} 题 · 进度 {Math.round(progress)}%
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 px-4 py-6 pb-28">
        <div className="max-w-[448px] mx-auto" key={currentIdx} style={{ animation: 'cardEnter 0.3s ease-out' }}>
          {/* IP 提问者 */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.muted }}>
              <IPPAvatar expression={ipExpression} size={40} />
            </div>
            <div
              className="px-4 py-2 rounded-2xl rounded-tl-sm shadow-sm"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <p className="text-sm" style={{ color: '#2D2A26' }}>{ipBubbleText}</p>
            </div>
          </div>

          {/* 题目卡片 */}
          <div className="rounded-2xl p-5 shadow-sm mb-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
            <p className="text-lg font-medium mb-4" style={{ color: '#2D2A26' }}>{currentQ.question}</p>
            <div className="space-y-2">
              {currentQ.options.map((opt, idx) => {
                const selected = answers[currentQ.id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    className="w-full text-left p-3 rounded-xl transition-all active:scale-[0.98]"
                    style={{
                      background: selected ? C.muted : '#FFFFFF',
                      border: `2px solid ${selected ? C.primary : C.border}`,
                    }}
                  >
                    <span className="text-sm" style={{ color: '#2D2A26' }}>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* 底部操作区（固定） */}
      <footer
        className="fixed bottom-16 left-0 right-0 z-30 px-4 py-3"
        style={{ background: 'rgba(255,250,244,0.95)', backdropFilter: 'blur(8px)', borderTop: `1px solid ${C.border}` }}
      >
        <div className="max-w-[448px] mx-auto flex gap-2">
          {!isFirst && (
            <button
              onClick={handlePrev}
              disabled={submitting}
              className="px-5 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1"
              style={{ background: C.muted, color: C.mutedFg, border: `1px solid ${C.border}` }}
            >
              <ChevronLeft size={18} />
              上一题
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={answers[currentQ.id] === undefined || submitting}
            className="flex-1 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: C.primary, color: C.primaryFg }}
          >
            {isLast ? (
              submitting ? '提交中...' : (
                <>
                  完成评估 <Check size={18} />
                </>
              )
            ) : (
              <>
                下一题 <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

export default QuestionnairePage;
