import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Loader2, Check, X, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';

// AI 助理建议执行的动作描述（由后端 Function Calling 产出）
export interface ActionSuggestion {
  action: string;
  params: Record<string, any>;
  summary: string;
  confirm_text: string;
  cancel_text: string;
  api_endpoint: string;
  api_method: string;
  api_body?: Record<string, any>;
  requires_parent?: boolean;
  created_at?: string | number; // ISO 时间或时间戳，用于 24h 有效期判断
}

// 动作确认卡片四态机：pending 待确认 / executing 执行中 / success 成功 / failed 失败 / cancelled 已取消
export interface ActionConfirmCardProps {
  suggestion: ActionSuggestion;
  status: 'pending' | 'executing' | 'success' | 'failed' | 'cancelled';
  errorMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry?: () => void;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * 把 summary 中的连续数字（含小数，如积分、分值）用 font-bold text-primary 高亮包裹。
 * 简单正则实现：按数字片段切分，数字段套高亮 span。
 */
function renderHighlightedSummary(summary: string): ReactNode {
  if (!summary) return null;
  const parts = summary.split(/(\d+(?:\.\d+)?)/g);
  return parts.map((part, idx) => {
    if (/^\d+(?:\.\d+)?$/.test(part)) {
      return (
        <span key={idx} className="font-bold text-primary">
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function ActionConfirmCard({
  suggestion,
  status,
  errorMessage,
  onConfirm,
  onCancel,
  onRetry,
}: ActionConfirmCardProps) {
  // 24 小时有效期检查：created_at 缺失时跳过；支持 ISO 字符串与时间戳（秒/毫秒自动识别）
  const isExpired = useMemo(() => {
    const created = suggestion.created_at;
    if (created == null) return false;
    let createdTime: number;
    if (typeof created === 'number') {
      // 数值小于 1e12 视为秒级时间戳（Unix seconds），统一换算为毫秒
      createdTime = created < 1e12 ? created * 1000 : created;
    } else {
      createdTime = new Date(created).getTime();
    }
    if (Number.isNaN(createdTime)) return false;
    return Date.now() - createdTime > TWENTY_FOUR_HOURS_MS;
  }, [suggestion.created_at]);

  // 儿童权限降级：requires_parent 为 true 时确认按钮置灰不可点
  const requiresParent = suggestion.requires_parent === true;
  // 待确认态下被「过期 / 需家长」阻断时，整卡片置灰
  const isBlocked = status === 'pending' && (isExpired || requiresParent);
  // 确认按钮是否禁用：执行中 / 待确认态下过期或需家长
  const confirmDisabled =
    status === 'executing' || (status === 'pending' && (isExpired || requiresParent));

  // 容器配色：成功/失败/取消为终态色，其余用默认卡片色
  const containerTone =
    status === 'success'
      ? 'bg-success/10 border-success'
      : status === 'failed' || status === 'cancelled'
        ? 'bg-danger/10 border-danger'
        : 'bg-card border-primary';

  const confirmText = suggestion.confirm_text || '确认';
  const cancelText = suggestion.cancel_text || '取消';

  // 终态（成功/失败/取消）下隐藏确认/取消按钮组
  const showActionButtons = status === 'pending' || status === 'executing';

  return (
    <div
      className={cn(
        'border-2 rounded-lg p-4 mt-1 transition-colors',
        containerTone,
        isBlocked && 'opacity-60',
      )}
      data-status={status}
    >
      {/* 标题 */}
      <h4 className="text-sm font-bold text-text-primary">操作确认</h4>

      {/* 正文：summary，数字高亮 */}
      <p className="text-sm text-text-secondary mt-1">
        {renderHighlightedSummary(suggestion.summary)}
      </p>

      {/* 状态提示行 */}
      {status === 'success' && (
        <div className="flex items-center gap-1.5 mt-3 text-sm font-medium text-success">
          <Check size={16} />
          <span>已完成</span>
        </div>
      )}
      {status === 'failed' && (
        <div className="flex items-center gap-1.5 mt-3 text-sm font-medium text-danger">
          <X size={16} />
          <span>失败{errorMessage ? `：${errorMessage}` : ''}</span>
        </div>
      )}
      {status === 'cancelled' && (
        <div className="flex items-center gap-1.5 mt-3 text-sm font-medium text-danger">
          <X size={16} />
          <span>已取消</span>
        </div>
      )}

      {/* 按钮组：待确认 / 执行中 */}
      {showActionButtons && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={status === 'executing'}
            className="flex-1 h-10 rounded-lg bg-warm-light text-text-secondary text-sm font-medium active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'executing' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>执行中...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      )}

      {/* 失败态：重试按钮（仅当提供 onRetry） */}
      {status === 'failed' && onRetry && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <RotateCcw size={16} />
            <span>重试</span>
          </button>
        </div>
      )}

      {/* 儿童权限降级提示 */}
      {requiresParent && status === 'pending' && (
        <p className="text-xs text-text-secondary mt-2">需要请家长帮忙操作</p>
      )}

      {/* 24h 过期提示 */}
      {isExpired && status === 'pending' && (
        <p className="text-xs text-text-secondary mt-2">已过期，请重新询问</p>
      )}
    </div>
  );
}

export default ActionConfirmCard;
