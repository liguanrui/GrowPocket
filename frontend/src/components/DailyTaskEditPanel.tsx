import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import * as cyclePlanService from '../services/cyclePlan';
import type { ReplaceCandidate, TaskAdjustRequest } from '../services/cyclePlan';
import type { DailyTaskInstance, SupervisionLevel } from '../types';
import { TaskKindMeta, ABILITY_DIMENSIONS } from '../types';
import { useToastStore } from '../stores/toastStore';

type TaskAdjustReq = TaskAdjustRequest;

interface DailyTaskEditPanelProps {
  open: boolean;
  onClose: () => void;
  date: string; // yyyy-mm-dd
  tasks: DailyTaskInstance[]; // 当日所有任务
  cyclePlanId: number;
  childId: number;
  mainDimPct: number; // 0-100,来自父组件 preview.dimension_ratio.main_dim_pct
  onChanged: () => void; // 调整后回调,触发父组件刷新 preview
}

// 维度 ID → 中文名 映射
const DIM_NAME: Record<number, string> = {
  [ABILITY_DIMENSIONS.SELF_CARE]: '生活自理',
  [ABILITY_DIMENSIONS.RESPONSIBILITY]: '责任担当',
  [ABILITY_DIMENSIONS.LEARNING]: '学习探索',
  [ABILITY_DIMENSIONS.SOCIAL]: '社交协作',
  [ABILITY_DIMENSIONS.CREATIVITY]: '创意审美',
  [ABILITY_DIMENSIONS.SPORTS]: '运动健康',
};

// 难度映射
const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  easy: { label: '简单', color: 'bg-green-100 text-green-700' },
  medium: { label: '中等', color: 'bg-amber-100 text-amber-700' },
  hard: { label: '挑战', color: 'bg-red-100 text-red-700' },
};

// 陪同级别选项
const SUPERVISION_LEVELS: { value: SupervisionLevel; label: string; desc: string }[] = [
  { value: 'confirm', label: '确认', desc: '孩子独立完成,家长仅确认结果' },
  { value: 'accompany', label: '陪同', desc: '家长全程陪同指导' },
  { value: 'doorstep', label: '门口', desc: '家长就近观察' },
];

// 格式化日期为「M月D日 周X」
function formatDisplayDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${weekday}`;
}

export function DailyTaskEditPanel({
  open,
  onClose,
  date,
  tasks,
  cyclePlanId,
  childId,
  mainDimPct,
  onChanged,
}: DailyTaskEditPanelProps) {
  const toast = useToastStore();

  // 操作中状态(存 task.id;add 操作用 -1 占位)
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // 子弹窗状态
  const [replaceTargetTask, setReplaceTargetTask] = useState<DailyTaskInstance | null>(null);
  const [replaceCandidates, setReplaceCandidates] = useState<ReplaceCandidate[]>([]);
  const [replaceLoading, setReplaceLoading] = useState(false);

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addCandidates, setAddCandidates] = useState<ReplaceCandidate[]>([]);
  const [addLoading, setAddLoading] = useState(false);

  const [escalateTargetTask, setEscalateTargetTask] = useState<DailyTaskInstance | null>(null);

  const [deleteTargetTask, setDeleteTargetTask] = useState<DailyTaskInstance | null>(null);

  // 删除后主维占比校验
  const [pendingRatioCheck, setPendingRatioCheck] = useState(false);
  const [showRatioWarning, setShowRatioWarning] = useState(false);
  const [warningPct, setWarningPct] = useState(0);

  // 监听 mainDimPct 变化,触发删除后红标校验
  useEffect(() => {
    if (!pendingRatioCheck) return;
    setPendingRatioCheck(false);
    if (mainDimPct < 60) {
      setWarningPct(mainDimPct);
      setShowRatioWarning(true);
    }
  }, [mainDimPct, pendingRatioCheck]);

  if (!open) return null;

  // === A. 锁定/解锁单任务 ===
  const handleToggleLock = async (task: DailyTaskInstance) => {
    setActionLoading(task.id);
    try {
      const req: TaskAdjustReq = {
        instance_id: task.id,
        operation: 'lock',
        params: { lock: !task.locked },
      };
      await cyclePlanService.taskAdjust(cyclePlanId, req);
      toast.success(task.locked ? '已解锁' : '已锁定');
      onChanged();
    } catch (e: any) {
      toast.error(e.message || '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  // === B. 换一个 ===
  const handleReplaceClick = async (task: DailyTaskInstance) => {
    setReplaceTargetTask(task);
    setReplaceLoading(true);
    setReplaceCandidates([]);
    try {
      const list = await cyclePlanService.replaceCandidates(
        childId,
        task.id,
        date,
        task.ability_dimension_id,
        task.difficulty,
      );
      setReplaceCandidates(list);
    } catch (e: any) {
      toast.error(e.message || '拉取候选失败');
      setReplaceTargetTask(null);
    } finally {
      setReplaceLoading(false);
    }
  };

  const handleReplaceConfirm = async (candidate: ReplaceCandidate) => {
    if (!replaceTargetTask) return;
    setActionLoading(replaceTargetTask.id);
    try {
      const req: TaskAdjustReq = {
        instance_id: replaceTargetTask.id,
        operation: 'replace',
        params: { replace_with_template_id: candidate.id },
      };
      await cyclePlanService.taskAdjust(cyclePlanId, req);
      toast.success('已替换');
      setReplaceTargetTask(null);
      setReplaceCandidates([]);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || '替换失败');
    } finally {
      setActionLoading(null);
    }
  };

  // === C. 提级陪同 ===
  const handleEscalateConfirm = async (level: SupervisionLevel) => {
    if (!escalateTargetTask) return;
    setActionLoading(escalateTargetTask.id);
    try {
      const req: TaskAdjustReq = {
        instance_id: escalateTargetTask.id,
        operation: 'escalate_supervision',
        params: { new_supervision: { level, sign_off_required: true } },
      };
      await cyclePlanService.taskAdjust(cyclePlanId, req);
      toast.success('已提级陪同');
      setEscalateTargetTask(null);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || '提级失败');
    } finally {
      setActionLoading(null);
    }
  };

  // === D. 删除 ===
  const handleDeleteConfirm = async () => {
    if (!deleteTargetTask) return;
    const taskId = deleteTargetTask.id;
    setActionLoading(taskId);
    try {
      const req: TaskAdjustReq = {
        instance_id: taskId,
        operation: 'remove',
      };
      await cyclePlanService.taskAdjust(cyclePlanId, req);
      toast.success('已删除');
      setDeleteTargetTask(null);
      setPendingRatioCheck(true);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    } finally {
      setActionLoading(null);
    }
  };

  // === E. 加任务 ===
  const handleAddClick = async () => {
    setShowAddSheet(true);
    setAddLoading(true);
    setAddCandidates([]);
    try {
      const list = await cyclePlanService.replaceCandidates(childId, 0, date, 0, '');
      setAddCandidates(list);
    } catch (e: any) {
      toast.error(e.message || '拉取候选池失败');
      setShowAddSheet(false);
    } finally {
      setAddLoading(false);
    }
  };

  const handleAddConfirm = async (candidate: ReplaceCandidate) => {
    setActionLoading(-1);
    try {
      const req: TaskAdjustReq = {
        instance_id: 0,
        operation: 'add',
        params: { add_template_id: candidate.id },
      };
      await cyclePlanService.taskAdjust(cyclePlanId, req);
      toast.success('已添加');
      setShowAddSheet(false);
      setAddCandidates([]);
      onChanged();
    } catch (e: any) {
      toast.error(e.message || '添加失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 关闭:清空所有子弹窗
  const handleClose = () => {
    setReplaceTargetTask(null);
    setReplaceCandidates([]);
    setShowAddSheet(false);
    setAddCandidates([]);
    setEscalateTargetTask(null);
    setDeleteTargetTask(null);
    setShowRatioWarning(false);
    setPendingRatioCheck(false);
    onClose();
  };

  return (
    <>
      {/* 主面板:fixed 底部 sheet */}
      <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center">
        <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[88vh] flex flex-col">
          {/* 顶栏 */}
          <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl z-10">
            <div>
              <h3 className="font-semibold text-text-primary text-lg">📝 当日任务编辑</h3>
              <p className="text-xs text-text-tertiary mt-0.5">{formatDisplayDate(date)}</p>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* 内容区:任务列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tasks.length === 0 ? (
              <div className="py-10 text-center text-sm text-text-tertiary">
                当日暂无任务,点击下方「➕ 加任务」添加
              </div>
            ) : (
              tasks.map((task) => {
                const kindMeta = TaskKindMeta[task.task_kind] || TaskKindMeta.daily_fixed;
                const diffMeta = DIFFICULTY_META[task.difficulty] || DIFFICULTY_META.medium;
                const dimName = DIM_NAME[task.ability_dimension_id] || `维度${task.ability_dimension_id}`;
                const isLocked = task.locked;
                const isLoading = actionLoading === task.id;
                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl border p-3 ${
                      isLocked ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-gray-50/60'
                    }`}
                  >
                    {/* 任务信息行 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-text-primary truncate">
                            {task.title}
                          </span>
                          {isLocked && <span title="已锁定">🔒</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${kindMeta.color}`}>
                            {kindMeta.badge} {kindMeta.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                            +{task.points} 分
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${diffMeta.color}`}>
                            {diffMeta.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-text-secondary">
                            {task.category}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                            {dimName}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-text-tertiary mt-1.5 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 操作按钮行 */}
                    <div className="flex items-center gap-1.5 mt-3">
                      {/* A. 锁定/解锁 */}
                      <button
                        onClick={() => handleToggleLock(task)}
                        disabled={isLoading}
                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-50 ${
                          isLocked
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                        }`}
                      >
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <>🔒</>}
                        {isLocked ? '解锁' : '锁定'}
                      </button>

                      {/* B. 换一个 */}
                      <button
                        onClick={() => handleReplaceClick(task)}
                        disabled={isLoading || isLocked}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium bg-gray-100 text-text-secondary hover:bg-gray-200 transition-colors disabled:opacity-50"
                        title={isLocked ? '已锁定任务不可替换' : '换一个'}
                      >
                        🔄 换一个
                      </button>

                      {/* C. 提级陪同 */}
                      <button
                        onClick={() => setEscalateTargetTask(task)}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium bg-gray-100 text-text-secondary hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        📌 提级
                      </button>

                      {/* D. 删除 */}
                      <button
                        onClick={() => setDeleteTargetTask(task)}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium bg-red-50 text-danger hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        ➖ 删除
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* E. 加任务按钮 */}
            <button
              onClick={handleAddClick}
              disabled={actionLoading !== null}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <span>➕</span>
              <span>从拓展池加任务</span>
            </button>
          </div>
        </div>
      </div>

      {/* === B. 换一个 候选选择器 === */}
      {replaceTargetTask && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h4 className="font-semibold text-text-primary text-base">🔄 换一个任务</h4>
                <p className="text-xs text-text-tertiary mt-0.5">
                  替换「{replaceTargetTask.title}」· 选 1 个候选
                </p>
              </div>
              <button
                onClick={() => {
                  setReplaceTargetTask(null);
                  setReplaceCandidates([]);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {replaceLoading ? (
                <div className="flex items-center justify-center py-8 text-text-secondary text-sm">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  拉取候选中...
                </div>
              ) : replaceCandidates.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-tertiary">暂无候选任务</div>
              ) : (
                replaceCandidates.map((c) => {
                  const diffMeta = DIFFICULTY_META[c.difficulty] || DIFFICULTY_META.medium;
                  const dimName = DIM_NAME[c.ability_dimension_id] || `维度${c.ability_dimension_id}`;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleReplaceConfirm(c)}
                      disabled={actionLoading !== null}
                      className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">{c.title}</span>
                        <span className="text-xs text-primary font-medium">+{c.points} 分</span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{c.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${diffMeta.color}`}>
                          {diffMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-text-secondary">
                          {c.category}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                          {dimName}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* === E. 加任务 候选选择器 === */}
      {showAddSheet && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h4 className="font-semibold text-text-primary text-base">➕ 从拓展池加任务</h4>
                <p className="text-xs text-text-tertiary mt-0.5">{formatDisplayDate(date)} · 选 1 个加入</p>
              </div>
              <button
                onClick={() => {
                  setShowAddSheet(false);
                  setAddCandidates([]);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {addLoading ? (
                <div className="flex items-center justify-center py-8 text-text-secondary text-sm">
                  <Loader2 size={16} className="animate-spin mr-2" />
                  拉取候选池中...
                </div>
              ) : addCandidates.length === 0 ? (
                <div className="py-8 text-center text-sm text-text-tertiary">拓展池暂无候选任务</div>
              ) : (
                addCandidates.map((c) => {
                  const diffMeta = DIFFICULTY_META[c.difficulty] || DIFFICULTY_META.medium;
                  const dimName = DIM_NAME[c.ability_dimension_id] || `维度${c.ability_dimension_id}`;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleAddConfirm(c)}
                      disabled={actionLoading !== null}
                      className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">{c.title}</span>
                        <span className="text-xs text-primary font-medium">+{c.points} 分</span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{c.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${diffMeta.color}`}>
                          {diffMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-text-secondary">
                          {c.category}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                          {dimName}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* === C. 提级陪同 级别选择器 === */}
      {escalateTargetTask && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h4 className="font-semibold text-text-primary text-base">📌 提级陪同</h4>
                <p className="text-xs text-text-tertiary mt-0.5">
                  「{escalateTargetTask.title}」· 选择陪同级别
                </p>
              </div>
              <button
                onClick={() => setEscalateTargetTask(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {SUPERVISION_LEVELS.map((lv) => (
                <button
                  key={lv.value}
                  onClick={() => handleEscalateConfirm(lv.value)}
                  disabled={actionLoading !== null}
                  className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">{lv.label}</span>
                    {actionLoading === escalateTargetTask.id && (
                      <Loader2 size={14} className="animate-spin text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">{lv.desc}</p>
                </button>
              ))}
              <p className="text-xs text-text-tertiary mt-2 px-1">
                提级后将要求家长签字确认(sign_off_required=true)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* === D. 删除 二次确认弹窗 === */}
      {deleteTargetTask && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h4 className="font-semibold text-text-primary text-base mb-1">确认删除任务?</h4>
              <p className="text-sm text-text-tertiary">
                「{deleteTargetTask.title}」将被从当日移除,此操作不可撤销。
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDeleteTargetTask(null)}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-secondary text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={actionLoading !== null}
                className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {actionLoading === deleteTargetTask.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    删除中...
                  </>
                ) : (
                  '确认删除'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === 删除后主维<60% 红标警告弹窗 === */}
      {showRatioWarning && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 border-2 border-danger">
            <div className="text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <h4 className="font-semibold text-danger text-base mb-1">主维占比偏低</h4>
              <p className="text-sm text-text-primary mt-2">
                主维占比已降至 <span className="font-bold text-danger">{warningPct}%</span>,低于 60% 红线,建议减少删除或加主维任务
              </p>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowRatioWarning(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-text-secondary text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                知道了
              </button>
              <button
                onClick={() => setShowRatioWarning(false)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                继续编辑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DailyTaskEditPanel;
