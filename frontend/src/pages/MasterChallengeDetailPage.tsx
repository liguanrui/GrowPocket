import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Star, Clock, Check, Loader2, Send, BookOpen, Trophy, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { useToastStore } from '../stores/toastStore';
import { masterChallengeApi } from '../services/masterChallenge';
import type { InstanceDetail, MasterChallengeStage } from '../services/masterChallenge';
import { masterChallengeIcon } from '../utils/masterChallengeIcon';

// 实例状态 → 中文标签 + 颜色
function instanceStatusMeta(status: string): { label: string; cls: string } {
  switch (status) {
    case 'in_progress':
      return { label: '进行中', cls: 'bg-amber-50 text-amber-600' };
    case 'submitted':
      return { label: '待验收', cls: 'bg-blue-50 text-blue-600' };
    case 'completed':
      return { label: '已完成', cls: 'bg-emerald-50 text-emerald-600' };
    case 'abandoned':
      return { label: '已放弃', cls: 'bg-gray-100 text-gray-500' };
    default:
      return { label: status, cls: 'bg-gray-100 text-gray-500' };
  }
}

// 把多行 URL 文本转成 JSON 数组字符串
function urlsToAttachments(text: string): string {
  const urls = text
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(urls);
}

// 解析 attachments JSON 字符串为数组（用于展示）
function parseAttachments(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// 自评星级选择器（1-5）
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1)} className="p-0.5">
          <Star
            size={20}
            className={i < value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
          />
        </button>
      ))}
      {value > 0 && <span className="text-xs text-text-tertiary ml-1">{value} 星</span>}
    </div>
  );
}

export function MasterChallengeDetailPage() {
  const navigate = useNavigate();
  const { instanceId } = useParams<{ instanceId: string }>();
  const [searchParams] = useSearchParams();
  const toast = useToastStore();

  const childId = Number(searchParams.get('child_id')) || 0;
  const id = Number(instanceId) || 0;

  const [detail, setDetail] = useState<InstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 阶段打卡表单状态
  const [checkInStageId, setCheckInStageId] = useState<number | null>(null);
  const [stageNotes, setStageNotes] = useState('');
  const [stageAttachments, setStageAttachments] = useState('');
  const [stageRating, setStageRating] = useState(0);
  const [stageSubmitting, setStageSubmitting] = useState(false);

  // 提交验收表单状态
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [childSummary, setChildSummary] = useState('');
  const [submitAttachments, setSubmitAttachments] = useState('');
  const [submitSubmitting, setSubmitSubmitting] = useState(false);

  const loadDetail = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await masterChallengeApi.getInstanceDetail(id);
      setDetail(d);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 打开阶段打卡表单
  const openCheckIn = (stage: MasterChallengeStage) => {
    setCheckInStageId(stage.id);
    setStageNotes(stage.notes || '');
    setStageAttachments(parseAttachments(stage.attachments).join('\n'));
    setStageRating(stage.self_rating || 0);
  };

  // 提交阶段打卡
  const handleCheckIn = async () => {
    if (!checkInStageId) return;
    if (!stageNotes.trim()) {
      toast.error('请填写本阶段心得');
      return;
    }
    if (stageRating < 1) {
      toast.error('请选择自评星级');
      return;
    }
    setStageSubmitting(true);
    try {
      await masterChallengeApi.updateStage(checkInStageId, {
        notes: stageNotes.trim(),
        attachments: urlsToAttachments(stageAttachments),
        self_rating: stageRating,
      });
      toast.success('阶段打卡完成！');
      setCheckInStageId(null);
      await loadDetail();
    } catch (e: any) {
      toast.error(e?.message || '打卡失败');
    } finally {
      setStageSubmitting(false);
    }
  };

  // 提交验收
  const handleSubmit = async () => {
    if (!childSummary.trim()) {
      toast.error('请填写孩子的一句话总结');
      return;
    }
    setSubmitSubmitting(true);
    try {
      await masterChallengeApi.submit(id, {
        child_summary: childSummary.trim(),
        attachments: urlsToAttachments(submitAttachments),
      });
      toast.success('已提交验收，等待家长审核');
      setShowSubmitForm(false);
      await loadDetail();
    } catch (e: any) {
      toast.error(e?.message || '提交失败');
    } finally {
      setSubmitSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-amber-400" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-bg pb-24 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-6 text-center shadow-sm">
          <div className="text-danger text-sm font-medium">{error || '未找到该挑战'}</div>
          <button
            onClick={() => navigate(-1)}
            className="mt-3 px-4 py-2 bg-primary text-white text-sm rounded-xl"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const { instance, stages, submission, template } = detail;
  const statusMeta = instanceStatusMeta(instance.status);
  const completedStages = stages.filter((s) => s.status === 'completed').length;
  const totalStages = stages.length;
  const progress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;
  const allStagesDone = totalStages > 0 && stages.every((s) => s.status === 'completed');

  // 底部状态判定
  // 已验收通过：实例 completed + 有 submission
  const reviewedPassed = instance.status === 'completed' && !!submission && submission.passed;
  // 已验收未通过：实例 in_progress + 已有 submission（被打回可重新提交）
  const reviewedRejected =
    instance.status === 'in_progress' && !!submission && submission.passed === false;
  // 等待验收：实例 submitted
  const waitingReview = instance.status === 'submitted' && !!submission;

  const handleBack = () => navigate(-1);

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header：紧凑顶栏，不 sticky，避免遮挡下方阶段列表 */}
      <div className="bg-gradient-to-br from-amber-400 to-yellow-500 text-white rounded-b-2xl pt-3 pb-3.5 px-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-8 h-8 -ml-1 text-white"
            aria-label="返回"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="flex-1 text-base font-bold truncate">大师挑战详情</h1>
          <span className="text-lg flex-shrink-0" aria-hidden>
            {masterChallengeIcon(template?.icon)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold flex-1 min-w-0 truncate">{instance.title}</h2>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusMeta.cls} flex-shrink-0`}>
            {statusMeta.label}
          </span>
        </div>
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-white/90 gap-2">
            <span>
              进度 {progress}% · {completedStages}/{totalStages} 阶段
            </span>
            {template && (
              <span className="flex items-center gap-2 flex-shrink-0 font-medium">
                <span className="inline-flex items-center gap-0.5">
                  <Clock size={11} />
                  {template.estimated_days}天
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Trophy size={11} />
                  +{template.points_reward}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-3">
        {/* 阶段时间线 */}
        <div className="bg-card rounded-2xl p-4 shadow-sm mb-3">
          <div className="flex items-center gap-1.5 mb-3">
            <Star size={14} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-text-primary">挑战阶段</h3>
          </div>

          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
            {stages.map((stage, idx) => {
              const isCompleted = stage.status === 'completed';
              const dotColor = isCompleted ? 'bg-emerald-500' : 'bg-gray-300';
              const attachments = parseAttachments(stage.attachments);
              return (
                <div key={stage.id} className="relative mb-4 last:mb-0">
                  <div
                    className={`absolute -left-4 top-3 w-3 h-3 rounded-full border-2 border-white ${dotColor}`}
                  />
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-text-tertiary">阶段 {idx + 1}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-gray-100 text-text-tertiary'
                        }`}
                      >
                        {isCompleted ? '已完成' : '待完成'}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-text-primary">{stage.title}</div>
                    {stage.description && (
                      <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                        {stage.description}
                      </p>
                    )}

                    {/* 已完成：展示心得摘要 + 完成时间 + 自评 */}
                    {isCompleted ? (
                      <>
                        {stage.notes && (
                          <p className="text-xs text-text-secondary mt-2 line-clamp-3 bg-white rounded-lg p-2">
                            {stage.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-text-tertiary">
                          {stage.completed_at && (
                            <span>
                              {new Date(stage.completed_at).toLocaleDateString()} 完成
                            </span>
                          )}
                          {stage.self_rating > 0 && (
                            <span className="flex items-center gap-0.5">
                              自评
                              {Array.from({ length: stage.self_rating }, (_, i) => (
                                <Star key={i} size={9} className="fill-amber-400 text-amber-400" />
                              ))}
                            </span>
                          )}
                        </div>
                        {attachments.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {attachments.slice(0, 3).map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      /* 待完成：打卡入口 */
                      <div className="mt-2">
                        {checkInStageId === stage.id ? (
                          <div className="bg-white rounded-lg p-3 space-y-2">
                            <textarea
                              value={stageNotes}
                              onChange={(e) => setStageNotes(e.target.value)}
                              placeholder="本阶段做了什么？有什么收获？（必填）"
                              rows={3}
                              className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-text-primary resize-none focus:border-primary outline-none"
                            />
                            <textarea
                              value={stageAttachments}
                              onChange={(e) => setStageAttachments(e.target.value)}
                              placeholder="成果图片链接（每行一个，可选）"
                              rows={2}
                              className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-text-primary resize-none focus:border-primary outline-none"
                            />
                            <div>
                              <div className="text-xs text-text-tertiary mb-1">自评进度</div>
                              <StarPicker value={stageRating} onChange={setStageRating} />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setCheckInStageId(null)}
                                className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-text-secondary"
                              >
                                取消
                              </button>
                              <button
                                onClick={handleCheckIn}
                                disabled={stageSubmitting}
                                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium bg-primary text-white disabled:opacity-50"
                              >
                                {stageSubmitting ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}
                                确认打卡
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => openCheckIn(stage)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-white"
                          >
                            打卡
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部：提交验收 / 验收状态 */}
        <div className="bg-card rounded-2xl p-4 shadow-sm">
          {/* 已验收通过：结果 + 积分 + 成长故事入口 */}
          {reviewedPassed && submission ? (
            <div className="text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
              <div className="text-sm font-semibold text-text-primary mt-2">验收通过！</div>
              <div className="flex items-center justify-center gap-1 mt-1 text-amber-600 font-bold">
                <Trophy size={14} />
                +{submission.points_awarded} 稀有积分
              </div>
              {/* 三维评分 */}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-text-tertiary">
                {[
                  { label: '参与度', v: submission.participation_score },
                  { label: '应用度', v: submission.application_score },
                  { label: '满意度', v: submission.quality_score },
                ].map((it) => (
                  <div key={it.label} className="flex flex-col items-center gap-0.5">
                    <span>{it.label}</span>
                    <span className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={10}
                          className={
                            i < it.v ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                          }
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate(`/growth/stories?child_id=${childId}`)}
                className="mt-4 flex items-center gap-1 px-5 py-2 rounded-full text-xs font-medium bg-primary text-white mx-auto"
              >
                <BookOpen size={14} />
                查看专属成长故事
              </button>
            </div>
          ) : waitingReview ? (
            /* 等待家长验收 */
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600">
              <Loader2 size={16} className="animate-spin" />
              等待家长验收中
            </div>
          ) : reviewedRejected ? (
            /* 已验收未通过：继续完善重新提交 */
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-sm text-amber-600">
                <AlertCircle size={16} />
                验收未通过，继续完善后重新提交
              </div>
              {showSubmitForm ? (
                <SubmitForm
                  childSummary={childSummary}
                  setChildSummary={setChildSummary}
                  submitAttachments={submitAttachments}
                  setSubmitAttachments={setSubmitAttachments}
                  onCancel={() => setShowSubmitForm(false)}
                  onSubmit={handleSubmit}
                  submitting={submitSubmitting}
                />
              ) : (
                <button
                  onClick={() => {
                    setChildSummary(submission?.child_summary || '');
                    setSubmitAttachments(parseAttachments(submission?.attachments || '').join('\n'));
                    setShowSubmitForm(true);
                  }}
                  className="mt-3 px-5 py-2 rounded-full text-xs font-medium bg-primary text-white"
                >
                  继续完善，重新提交
                </button>
              )}
            </div>
          ) : allStagesDone ? (
            /* 所有阶段完成 + 未提交：提交验收 */
            showSubmitForm ? (
              <SubmitForm
                childSummary={childSummary}
                setChildSummary={setChildSummary}
                submitAttachments={submitAttachments}
                setSubmitAttachments={setSubmitAttachments}
                onCancel={() => setShowSubmitForm(false)}
                onSubmit={handleSubmit}
                submitting={submitSubmitting}
              />
            ) : (
              <button
                onClick={() => setShowSubmitForm(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-amber-400 to-yellow-500 text-white"
              >
                <Send size={14} />
                提交验收
              </button>
            )
          ) : (
            /* 阶段未全部完成 */
            <div className="text-center text-xs text-text-tertiary py-1">
              完成所有阶段后可提交验收
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 提交验收表单（提取为子组件复用）
function SubmitForm({
  childSummary,
  setChildSummary,
  submitAttachments,
  setSubmitAttachments,
  onCancel,
  onSubmit,
  submitting,
}: {
  childSummary: string;
  setChildSummary: (v: string) => void;
  submitAttachments: string;
  setSubmitAttachments: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-2 text-left">
      <div className="text-xs font-medium text-text-primary">孩子的一句话总结</div>
      <textarea
        value={childSummary}
        onChange={(e) => setChildSummary(e.target.value)}
        placeholder="这次挑战我学到了..."
        rows={3}
        className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-text-primary resize-none focus:border-primary outline-none"
      />
      <div className="text-xs font-medium text-text-primary">成果图片链接（每行一个，可选）</div>
      <textarea
        value={submitAttachments}
        onChange={(e) => setSubmitAttachments(e.target.value)}
        placeholder="https://..."
        rows={2}
        className="w-full px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 text-xs text-text-primary resize-none focus:border-primary outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-xs font-medium bg-gray-100 text-text-secondary"
        >
          取消
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium bg-primary text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          提交
        </button>
      </div>
    </div>
  );
}

export default MasterChallengeDetailPage;
