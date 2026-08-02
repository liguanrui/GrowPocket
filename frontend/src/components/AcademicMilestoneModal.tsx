import { useState, useEffect } from 'react';
import { X, Star, Loader2, Plus, Trash2, ChevronLeft, Send } from 'lucide-react';
import { academicApi } from '../services/academic';
import type { MilestoneTypeOption } from '../services/academic';
import { useToastStore } from '../stores/toastStore';
import { MobileDatePicker } from './MobileDatePicker';

// 星级展示：1-4 颗星
function StarLevel({ level }: { level: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < level ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
        />
      ))}
    </span>
  );
}

interface AcademicMilestoneModalProps {
  open: boolean;
  childId: number | null;
  onClose: () => void;
  // 提交成功后的回调（用于刷新外层列表）
  onSubmitted?: () => void;
}

export function AcademicMilestoneModal({ open, childId, onClose, onSubmitted }: AcademicMilestoneModalProps) {
  const toast = useToastStore();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<MilestoneTypeOption[]>([]);
  const [grade, setGrade] = useState<number | null>(null);
  // 当前选中的里程碑类型卡片
  const [selected, setSelected] = useState<MilestoneTypeOption | null>(null);

  // 表单字段
  const todayStr = new Date().toISOString().slice(0, 10);
  const [occurredAt, setOccurredAt] = useState(todayStr);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(0);
  const [parentNote, setParentNote] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  // 打开弹窗时拉取当前年级允许的里程碑类型
  useEffect(() => {
    if (!open || !childId) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setOptions([]);
    setGrade(null);
    academicApi
      .getAllowedTypes(childId)
      .then((res) => {
        setOptions(res.options || []);
        setGrade(res.grade);
      })
      .catch((e: any) => {
        setError(e.message || '加载允许类型失败');
      })
      .finally(() => setLoading(false));
  }, [open, childId]);

  // 选中卡片：预填表单
  const handleSelectOption = (opt: MilestoneTypeOption) => {
    setSelected(opt);
    setTitle(opt.title);
    setPoints(opt.suggested_points);
    setDescription('');
    setParentNote('');
    setAttachments([]);
    setOccurredAt(todayStr);
    setError(null);
  };

  // 返回卡片列表
  const handleBack = () => {
    setSelected(null);
    setError(null);
  };

  // 关闭弹窗：重置状态
  const handleClose = () => {
    setSelected(null);
    setError(null);
    onClose();
  };

  // 附件 URL 增删（最多 3 张）
  const handleAddAttachment = () => {
    if (attachments.length >= 3) return;
    setAttachments([...attachments, '']);
  };
  const handleUpdateAttachment = (idx: number, value: string) => {
    const next = [...attachments];
    next[idx] = value;
    setAttachments(next);
  };
  const handleRemoveAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  // 积分 ±20% 调整边界
  const suggested = selected?.suggested_points ?? 0;
  const minPoints = Math.round(suggested * 0.8);
  const maxPoints = Math.round(suggested * 1.2);

  // 提交录入里程碑
  const handleSubmit = async () => {
    if (!childId || !selected) return;
    if (!title.trim()) {
      setError('请填写标题');
      return;
    }
    if (!occurredAt) {
      setError('请选择发生日期');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 拼接 RFC3339 日期（含时区）
      const occurredAtISO = new Date(occurredAt + 'T12:00:00').toISOString();
      // 过滤空 URL 后序列化为 JSON 字符串
      const validAttachments = attachments.filter((u) => u.trim().length > 0);
      await academicApi.createMilestone({
        child_id: childId,
        type: selected.type,
        sub_type: selected.sub_type,
        title: title.trim(),
        description: description.trim(),
        occurred_at: occurredAtISO,
        points,
        parent_note: parentNote.trim(),
        attachments: validAttachments.length > 0 ? JSON.stringify(validAttachments) : '',
        star_level: selected.star_level,
      });
      toast.success('已记录！积分已到账');
      onSubmitted?.();
      handleClose();
    } catch (e: any) {
      setError(e.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto">
        {/* 顶栏：标题 + 关闭 */}
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-white pb-2">
          <div className="flex items-center gap-2">
            {selected && (
              <button
                onClick={handleBack}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <h3 className="font-semibold text-text-primary text-lg">📚 录一件学业上的好事</h3>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-secondary">
            <Loader2 size={20} className="animate-spin mr-2" />
            加载中...
          </div>
        ) : error && !selected ? (
          <div className="py-10 text-center text-danger text-sm">{error}</div>
        ) : !selected ? (
          /* 选中卡片前的类型选择列表 */
          <TypeSelectList
            options={options}
            grade={grade}
            onSelect={handleSelectOption}
          />
        ) : (
          /* 选中后展开的录入表单 */
          <div className="space-y-4">
            {/* 选中卡片摘要（只读展示） */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">{selected.title}</span>
                <StarLevel level={selected.star_level} />
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                建议 {selected.suggested_points} 积分 · 类型 {selected.type}
              </p>
            </div>

            {/* 发生日期 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">发生日期</label>
              <MobileDatePicker
                value={occurredAt}
                onChange={setOccurredAt}
                placeholder="选择发生日期"
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm text-left flex items-center justify-between"
              />
            </div>

            {/* 标题 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                标题 <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm text-text-primary focus:border-primary outline-none"
                placeholder="一句话描述这件好事"
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                描述 <span className="text-text-tertiary text-xs">（可选）</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm text-text-primary focus:border-primary outline-none resize-none"
                placeholder="补充细节，比如做了什么、坚持了多久"
              />
            </div>

            {/* 积分（±20% 调整） */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                积分 <span className="text-text-tertiary text-xs">建议 {suggested} 积分</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPoints((p) => Math.max(minPoints, p - 5))}
                  className="w-9 h-9 rounded-lg bg-gray-100 text-text-secondary flex items-center justify-center hover:bg-gray-200 transition-colors"
                  disabled={points <= minPoints}
                >
                  −
                </button>
                <input
                  type="number"
                  value={points}
                  min={minPoints}
                  max={maxPoints}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isNaN(v)) return;
                    setPoints(Math.max(minPoints, Math.min(maxPoints, v)));
                  }}
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-center text-text-primary focus:border-primary outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPoints((p) => Math.min(maxPoints, p + 5))}
                  className="w-9 h-9 rounded-lg bg-gray-100 text-text-secondary flex items-center justify-center hover:bg-gray-200 transition-colors"
                  disabled={points >= maxPoints}
                >
                  +
                </button>
              </div>
              <p className="text-xs text-text-tertiary mt-1">
                可在 {minPoints} ~ {maxPoints} 之间调整（±20%）
              </p>
            </div>

            {/* 家长备注 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                家长备注 <span className="text-text-tertiary text-xs">（可选）</span>
              </label>
              <textarea
                value={parentNote}
                onChange={(e) => setParentNote(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm text-text-primary focus:border-primary outline-none resize-none"
                placeholder="给孩子的鼓励或后续期望"
              />
            </div>

            {/* 附件图片 URL（最多 3 张） */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                附件图片 <span className="text-text-tertiary text-xs">（可选，最多 3 张 URL）</span>
              </label>
              <div className="space-y-2">
                {attachments.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => handleUpdateAttachment(idx, e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 text-sm text-text-primary focus:border-primary outline-none"
                    />
                    {url && (
                      <img
                        src={url}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover border border-gray-100"
                        onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="w-9 h-9 rounded-lg bg-gray-100 text-text-tertiary flex items-center justify-center hover:bg-red-50 hover:text-danger transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {attachments.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    className="flex items-center gap-1.5 text-sm text-primary hover:text-primary-dark transition-colors"
                  >
                    <Plus size={15} />
                    添加图片
                  </button>
                )}
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-sm text-danger">
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="w-full mt-2 py-3 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-primary/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {submitting ? '提交中...' : '提交并发放积分'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 类型选择卡片列表
function TypeSelectList({
  options,
  grade,
  onSelect,
}: {
  options: MilestoneTypeOption[];
  grade: number | null;
  onSelect: (opt: MilestoneTypeOption) => void;
}) {
  if (options.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-text-tertiary">当前年级暂无可录入的学业类型</p>
        {grade !== null && <p className="text-xs text-text-tertiary mt-1">当前年级：{grade}</p>}
      </div>
    );
  }
  return (
    <div>
      {grade !== null && (
        <p className="text-xs text-text-tertiary mb-3">
          当前年级 {grade} 可选 {options.length} 种学业好事
        </p>
      )}
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <button
            key={`${opt.type}-${opt.sub_type}-${idx}`}
            onClick={() => onSelect(opt)}
            className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">{opt.title}</span>
              <StarLevel level={opt.star_level} />
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs text-primary font-medium">
                建议 {opt.suggested_points} 积分
              </span>
              <span className="text-xs text-text-tertiary">{opt.type}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default AcademicMilestoneModal;
