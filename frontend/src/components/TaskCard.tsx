import { Star, MoreVertical } from 'lucide-react';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  showActions?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

// 新状态：进行中 / 待验收 / 已完成 / 已拒绝
// （已移除「待接受」状态——家长创建后直接进入进行中）
const STATUS_COLORS: Record<Task['status'], string> = {
  in_progress: 'bg-primary/10 text-primary',
  submitted: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};

const STATUS_TEXT: Record<Task['status'], string> = {
  in_progress: '进行中',
  submitted: '待验收',
  completed: '已完成',
  rejected: '已拒绝',
};

function formatDeadline(deadline?: Date) {
  if (!deadline) return '';
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (diff < 0) return '已超时';
  if (hours < 24) return `${hours}小时后截止`;
  if (days < 7) return `${days}天后截止`;
  return deadline.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function TaskCard({ task, onClick, showActions, onApprove, onReject }: TaskCardProps) {
  const deadlineText = formatDeadline(task.deadline);

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* 标题 + 状态 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="font-semibold text-text-primary truncate">{task.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status]}`}>
              {STATUS_TEXT[task.status]}
            </span>
          </div>

          {/* 描述 */}
          {task.description && (
            <p className="text-sm text-text-secondary line-clamp-2 mb-3">{task.description}</p>
          )}

          {/* 积分 + 指派 + 截止 */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-1.5 text-primary">
              <Star size={16} className="fill-primary" />
              <span className="font-semibold">{task.points}积分</span>
            </div>
            {task.childName && (
              <div className="flex items-center gap-1.5 text-text-tertiary">
                <span>指派给 {task.childName}</span>
              </div>
            )}
            {deadlineText && (
              <div className="text-text-tertiary">{deadlineText}</div>
            )}
          </div>

          {/* 成果照片缩略图（如存在） */}
          {task.photo && (
            <div className="mt-3 rounded-xl overflow-hidden w-full aspect-[4/3] max-w-[200px] bg-gray-100">
              <img src={task.photo} alt="成果" className="w-full h-full object-cover" />
            </div>
          )}

          {/* 待验收的操作按钮 */}
          {task.status === 'submitted' && showActions && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.();
                }}
                className="flex-1 py-2.5 px-4 bg-success text-white rounded-xl font-medium hover:bg-success/90 transition-colors"
              >
                验收通过 · 发放积分
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReject?.();
                }}
                className="flex-1 py-2.5 px-4 bg-danger/10 text-danger rounded-xl font-medium hover:bg-danger/20 transition-colors"
              >
                拒绝
              </button>
            </div>
          )}

          {/* 已拒绝：可以重新提交 */}
          {task.status === 'rejected' && showActions && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.();
                }}
                className="w-full py-2.5 px-4 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                重新提交成果
              </button>
            </div>
          )}
        </div>

        <button
          onClick={(e) => e.stopPropagation()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        >
          <MoreVertical size={18} className="text-text-tertiary" />
        </button>
      </div>
    </div>
  );
}
