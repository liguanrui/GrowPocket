import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getQuestionnaire, submitQuestionnaire } from '../services/questionnaire';
import type { Question, Questionnaire as QuestionnaireType, AnswerInput } from '../services/questionnaire';
import { IPPAvatar } from '../components/IPPAvatar';
import { useToastStore } from '../stores/toastStore';
import { useChildStore } from '../stores/childStore';
import { loadChildDraft, clearChildDraft } from '../utils/childDraft';

// 暖橙色彩常量
const C = {
  bg: '#FFFAF4', primary: '#F59E6B', primaryFg: '#FFFFFF',
  card: '#FFFFFF', muted: '#FFF1E6', mutedFg: '#7A7168', border: '#F5E6D3',
};

export function QuestionnairePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const childStore = useChildStore();
  const stage = searchParams.get('stage') || 'register';
  const level = searchParams.get('level') || '';
  const urlChildId = Number(searchParams.get('child_id') || 0);
  const useDraft = searchParams.get('draft') === '1';
  const returnTo = searchParams.get('return');
  const isOnboardingFlow =
    useDraft || !!(returnTo && (returnTo === 'onboarding' || returnTo.startsWith('onboarding')));

  const [questionnaire, setQuestionnaire] = useState<QuestionnaireType | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // questionId -> optionIndex
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 草稿流程必须带有本地草稿，否则中途刷新会无法创建孩子
    if (useDraft && !loadChildDraft()) {
      toast.error('添加流程已中断，请重新开始');
      navigate('/onboarding', { replace: true });
      return;
    }
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
  }, [stage, level, useDraft, navigate, toast]);

  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;
  const isFirst = currentIdx === 0;
  const isLast = currentIdx === questions.length - 1;

  const ipExpression: 'think' | 'happy' | 'proud' =
    isFirst ? 'think' : isLast ? 'proud' : 'happy';

  const ipBubbleText = isFirst
    ? '小萌芽想了解你~'
    : isLast
    ? '就快完成啦，加油！'
    : '答得不错哦，继续~';

  const parseOnboardingMode = (): string => {
    if (!returnTo) return 'register';
    const modeMatch = returnTo.match(/mode=([^&]+)/);
    return modeMatch ? decodeURIComponent(modeMatch[1]) : 'register';
  };

  const handleAbandon = () => {
    if (isOnboardingFlow) {
      const ok = window.confirm('退出后不会保存孩子信息，确定离开吗？');
      if (!ok) return;
      clearChildDraft();
      const mode = parseOnboardingMode();
      if (mode === 'add_child') {
        navigate('/settings/family', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
      return;
    }
    navigate(-1);
  };

  const handleSelect = (optionIdx: number) => {
    if (!currentQ) return;
    const wasEmpty = answers[currentQ.id] === undefined;
    setAnswers({ ...answers, [currentQ.id]: optionIdx });
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
      void handleSubmit();
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
      let childId = urlChildId;

      // 添加孩子流程：问卷答完后才真正创建档案
      if (useDraft || (!childId && loadChildDraft())) {
        const draft = loadChildDraft();
        if (!draft) {
          toast.error('草稿已失效，请重新添加孩子');
          setSubmitting(false);
          navigate('/onboarding', { replace: true });
          return;
        }
        const child = await childStore.addChild({
          nickname: draft.nickname,
          birthday: draft.birthday,
          grade: draft.grade,
          grade_overridden: draft.grade_overridden,
          age: draft.age,
          hobbies: draft.hobbies,
        });
        childId = child.id;
        childStore.setCurrentChildId(child.id);
        clearChildDraft();
      }

      if (!childId) {
        toast.error('缺少孩子信息，无法提交');
        setSubmitting(false);
        return;
      }

      const res = await submitQuestionnaire(questionnaire.id, stage, childId, answerList);

      if (returnTo && (returnTo === 'onboarding' || returnTo.startsWith('onboarding'))) {
        const mode = parseOnboardingMode();
        navigate(`/onboarding?step=6&child_id=${childId}&mode=${encodeURIComponent(mode)}`, {
          replace: true,
        });
      } else {
        toast.success(res.reward > 0 ? `问卷完成！获得 ${res.reward} 积分` : '问卷完成！');
        setTimeout(() => navigate('/growth'), 1500);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : '提交失败');
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
      <header
        className="sticky top-0 z-20 pt-3 pb-3 px-4 rounded-b-2xl"
        style={{ background: `linear-gradient(135deg, ${C.primary}, #F5A572)` }}
      >
        <div className="max-w-[448px] mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={handleAbandon}
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
              aria-label="返回"
            >
              <ChevronLeft size={20} style={{ color: C.primaryFg }} />
            </button>
            <span className="font-medium text-sm" style={{ color: C.primaryFg }}>
              {questionnaire?.title}
            </span>
            <div className="w-9" />
          </div>

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

      <main className="flex-1 px-5 py-5 overflow-y-auto">
        <div className="max-w-[448px] mx-auto">
          <div className="flex items-end gap-3 mb-5">
            <IPPAvatar expression={ipExpression} size={64} />
            <div
              className="flex-1 px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-sm text-sm"
              style={{ background: C.card, border: `1px solid ${C.border}`, color: '#2D2A26' }}
            >
              {ipBubbleText}
            </div>
          </div>

          <div
            className="rounded-2xl p-5 shadow-sm mb-4"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <p className="text-base font-semibold mb-4" style={{ color: '#2D2A26' }}>
              {currentQ.question}
            </p>
            <div className="space-y-2.5">
              {currentQ.options.map((opt, idx) => {
                const selected = answers[currentQ.id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                    style={{
                      background: selected ? C.primary : C.muted,
                      color: selected ? C.primaryFg : '#2D2A26',
                      border: `2px solid ${selected ? C.primary : 'transparent'}`,
                    }}
                  >
                    {opt.text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <footer
        className="sticky bottom-0 z-20 px-5 py-4"
        style={{ background: C.bg, paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-[448px] mx-auto flex gap-3">
          {!isFirst && (
            <button
              onClick={handlePrev}
              className="px-4 py-3.5 rounded-xl font-medium text-sm"
              style={{ background: C.muted, color: C.mutedFg }}
            >
              上一题
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={answers[currentQ.id] === undefined || submitting}
            className="flex-1 py-3.5 rounded-xl font-semibold text-base transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: C.primary, color: C.primaryFg }}
          >
            {submitting ? (
              '提交中...'
            ) : isLast ? (
              <>
                完成评估 <Check size={18} />
              </>
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
