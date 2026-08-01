import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getQuestionnaire, submitQuestionnaire } from '../services/questionnaire';
import type { Question, Questionnaire as QuestionnaireType, AnswerInput } from '../services/questionnaire';
import { getGrowthIndex } from '../services/ability';
import { IPPAvatar } from '../components/IPPAvatar';
import { useToastStore } from '../stores/toastStore';

export function QuestionnairePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToastStore();
  const stage = searchParams.get('stage') || 'register';
  const childId = Number(searchParams.get('child_id') || 0);

  const [questionnaire, setQuestionnaire] = useState<QuestionnaireType | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // questionId -> optionIndex
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [growthIndex, setGrowthIndex] = useState(0);

  useEffect(() => {
    getQuestionnaire(stage)
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
  }, [stage]);

  useEffect(() => {
    if (childId) {
      getGrowthIndex(childId).then(setGrowthIndex).catch(() => {});
    }
  }, [childId]);

  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;
  // IP 表情随答题进度切换：首题思考、答题中开心、末题完成自豪
  const ipExpression: 'think' | 'happy' | 'proud' =
    currentIdx === 0 ? 'think' : currentIdx < questions.length - 1 ? 'happy' : 'proud';

  const handleSelect = (optionIdx: number) => {
    if (!currentQ) return;
    setAnswers({ ...answers, [currentQ.id]: optionIdx });
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      handleSubmit();
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
      toast.success(`问卷完成！获得 ${res.reward} 积分`);
      navigate('/growth');
    } catch {
      toast.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }
  if (!currentQ) {
    return <div className="min-h-screen flex items-center justify-center">暂无问卷</div>;
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* 顶部进度条 */}
      <div className="bg-gradient-to-br from-emerald-500 to-green-600 pt-6 pb-4 px-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate(-1)} className="text-white/80">
              <ChevronLeft size={24} />
            </button>
            <span className="text-white font-medium">{questionnaire?.title}</span>
            <div className="w-6" />
          </div>
          {/* 探险地图进度 */}
          <div className="flex items-center gap-1">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className={`flex-1 h-2 rounded-full transition-all ${idx <= currentIdx ? 'bg-white' : 'bg-white/20'}`}
              />
            ))}
          </div>
          <div className="text-white/80 text-xs mt-2 text-center">
            {currentIdx + 1} / {questions.length} · 进度 {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* IP 提问者 */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <IPPAvatar growthIndex={growthIndex} expression={ipExpression} size={48} />
          </div>
          <div className="bg-card px-4 py-2 rounded-2xl rounded-bl-md shadow-sm">
            <p className="text-sm text-text-secondary">小芽想了解你~</p>
          </div>
        </div>

        {/* 题目 */}
        <div className="bg-card rounded-2xl p-5 shadow-sm mb-4">
          <p className="text-lg font-medium text-text-primary mb-4">{currentQ.question}</p>
          <div className="space-y-2">
            {currentQ.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                className={`w-full text-left p-3 rounded-xl transition-all border-2 ${
                  answers[currentQ.id] === idx ? 'bg-primary/10 border-primary' : 'bg-bg border-transparent'
                }`}
              >
                <span className="text-sm text-text-primary">{opt.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 下一题按钮 */}
        <button
          onClick={handleNext}
          disabled={answers[currentQ.id] === undefined || submitting}
          className="w-full py-3 bg-primary text-white rounded-xl font-medium disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {currentIdx < questions.length - 1 ? (
            <>
              下一题 <ChevronRight size={18} />
            </>
          ) : submitting ? (
            '提交中...'
          ) : (
            <>
              完成 <Check size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default QuestionnairePage;
