import { ChevronUp, ChevronDown } from 'lucide-react';

interface DayStepperProps {
  value: number;
  onChange: (days: number) => void;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
}

/** 主题任务预计周期：无前导 0，右侧上下箭头调节 */
export function DayStepper({
  value,
  onChange,
  min = 7,
  max = 90,
  className = '',
  inputClassName = '',
}: DayStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const commit = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      onChange(min);
      return;
    }
    // parseInt 去掉前导 0（"012" → 12）
    onChange(clamp(parseInt(digits, 10)));
  };

  const display = value > 0 ? String(value) : '';

  return (
    <div className={`flex items-stretch rounded-xl border border-gray-100 bg-bg overflow-hidden ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
          if (!digits) {
            onChange(0);
            return;
          }
          const n = parseInt(digits, 10);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        onBlur={(e) => commit(e.target.value)}
        className={`flex-1 min-w-0 px-4 py-3 outline-none bg-transparent text-text-primary ${inputClassName}`}
        aria-label="预计周期天数"
      />
      <div className="flex flex-col border-l border-gray-100 w-10 flex-shrink-0">
        <button
          type="button"
          onClick={() => onChange(clamp((value || min) + 1))}
          disabled={value >= max}
          className="flex-1 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 transition-colors"
          aria-label="增加一天"
        >
          <ChevronUp size={16} className="text-text-secondary" />
        </button>
        <div className="h-px bg-gray-100" />
        <button
          type="button"
          onClick={() => onChange(clamp((value || min) - 1))}
          disabled={value <= min && value !== 0}
          className="flex-1 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 transition-colors"
          aria-label="减少一天"
        >
          <ChevronDown size={16} className="text-text-secondary" />
        </button>
      </div>
    </div>
  );
}

export default DayStepper;
