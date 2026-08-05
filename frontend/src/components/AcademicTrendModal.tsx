import { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { academicApi } from '../services/academic';
import type { CreateTrendInput } from '../services/academic';
import { useToastStore } from '../stores/toastStore';

interface AcademicTrendModalProps {
  open: boolean;
  childId: number | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

// 学科可选项（与后端 model 对齐：chinese / math / english / other）
const SUBJECT_OPTIONS: { key: string; label: string }[] = [
  { key: 'chinese', label: '语文' },
  { key: 'math', label: '数学' },
  { key: 'english', label: '英语' },
  { key: 'other', label: '其他' },
];

// 指标类型可选项（默认选中 homework，最常用）
const METRIC_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'homework', label: '作业档', hint: '学业加权只看这个类型' },
  { key: 'quiz', label: '单元测验档', hint: '小测/听写/听写本等' },
  { key: 'midterm_final', label: '期中期末档', hint: '单元考/期中/期末考' },
  { key: 'self_study_duration', label: '自主学习时长档', hint: '自习/阅读/课外学习' },
];

// 档位：A+ / A / B / C
const ABC_OPTIONS: { key: string; label: string; dot: string }[] = [
  { key: 'A+', label: 'A+', dot: 'bg-emerald-500' },
  { key: 'A', label: 'A', dot: 'bg-emerald-400' },
  { key: 'B', label: 'B', dot: 'bg-amber-400' },
  { key: 'C', label: 'C', dot: 'bg-rose-400' },
];

// 计算当前 ISO 周次（YYYY-Www），兼容 Safari
function getCurrentISOWeek(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sunday as 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function AcademicTrendModal({ open, childId, onClose, onSubmitted }: AcademicTrendModalProps) {
  const toast = useToastStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单字段（默认值）
  const [subject, setSubject] = useState<string>('math');
  const [metricType, setMetricType] = useState<string>('homework');
  const [valueABC, setValueABC] = useState<string>('A');
  const [occurredWeek, setOccurredWeek] = useState<string>(getCurrentISOWeek());
  const [note, setNote] = useState<string>('');

  // 打开弹窗时重置表单
  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
    setSubject('math');
    setMetricType('homework');
    setValueABC('A');
    setOccurredWeek(getCurrentISOWeek());
    setNote('');
  }, [open, childId]);

  const handleSubmit = async () => {
    if (!childId) return;
    const payload: CreateTrendInput = {
      child_id: childId,
      subject,
      metric_type: metricType,
      value_abc: valueABC,
      occurred_week: occurredWeek.trim(),
      note: note.trim(),
    };
    setSubmitting(true);
    setError(null);
    try {
      await academicApi.createTrend(payload);
      toast.success('学习档位已记录');
      onSubmitted?.();
      handleClose();
    } catch (e: any) {
      setError(e.message || '记录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2">
          <h3 className="font-semibold text-text-primary text-lg">📝 记录学习档位</h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* 说明提示：学业加权仅参考作业档 */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
            <span className="font-semibold">学业加权提示：</span>
            作业档记录为 B / C 时，系统会在「生成每日 AI 任务」时优先推荐错题订正 / 检查清单 / 作业规划类任务，
            帮孩子把学习习惯拉回正轨。作业档之外的类型仅作折线图展示，不影响 AI 任务推荐。
          </div>

          {/* 学科 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">学科</label>
            <div className="grid grid-cols-4 gap-2">
              {SUBJECT_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSubject(s.key)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    subject === s.key
                      ? 'bg-primary text-white shadow'
                      : 'bg-gray-50 text-text-secondary hover:bg-gray-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 指标类型 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">指标类型</label>
            <div className="space-y-1.5">
              {METRIC_OPTIONS.map((m) => {
                const active = metricType === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMetricType(m.key)}
                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all ${
                      active
                        ? 'bg-primary/10 border border-primary/30'
                        : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <div>
                      <div
                        className={`text-sm font-medium ${
                          active ? 'text-primary' : 'text-text-primary'
                        }`}
                      >
                        {m.label}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">{m.hint}</div>
                    </div>
                    {m.key === 'homework' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        加权
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 档位 A+/A/B/C */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">档位</label>
            <div className="grid grid-cols-4 gap-2">
              {ABC_OPTIONS.map((a) => {
                const active = valueABC === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setValueABC(a.key)}
                    className={`relative py-3 rounded-xl text-base font-semibold transition-all ${
                      active
                        ? `text-white shadow`
                        : 'bg-gray-50 text-text-secondary hover:bg-gray-100'
                    }`}
                    style={active ? { background: activeBg(a.key) } : undefined}
                  >
                    <span className={`absolute top-2 left-2 w-2 h-2 rounded-full ${a.dot}`} />
                    {a.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-text-tertiary">
              <span>A+ / A = 作业/测验完成得很扎实</span>
              <span className="text-amber-600 font-medium">B / C = 会触发学习类任务加权</span>
            </div>
          </div>

          {/* 周次 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              周次 <span className="text-text-tertiary text-xs font-normal">（如 2026-W31，可手写）</span>
            </label>
            <input
              type="text"
              value={occurredWeek}
              onChange={(e) => setOccurredWeek(e.target.value)}
              placeholder="例如 2026-W31"
              className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm text-text-primary focus:border-primary outline-none"
            />
            <p className="text-[11px] text-text-tertiary mt-1">
              仅用于折线图 X 轴展示（学业加权判断用实际创建时间近 14 天）。
            </p>
          </div>

          {/* 备注 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              备注 <span className="text-text-tertiary text-xs">（可选）</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm text-text-primary focus:border-primary outline-none resize-none"
              placeholder="例如：计算题错误较多、书写潦草 / 第三单元字词未过关"
              maxLength={200}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-sm text-danger">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full mt-2 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {submitting ? '提交中...' : '提交记录'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 激活态背景色（按档位深浅渐变）
function activeBg(abc: string): string {
  switch (abc) {
    case 'A+':
      return 'linear-gradient(135deg,#10b981,#059669)';
    case 'A':
      return 'linear-gradient(135deg,#34d399,#10b981)';
    case 'B':
      return 'linear-gradient(135deg,#f59e0b,#d97706)';
    case 'C':
      return 'linear-gradient(135deg,#f43f5e,#e11d48)';
    default:
      return '';
  }
}

export default AcademicTrendModal;
