import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SoftSelectOption {
  value: string;
  label: string;
}

interface SoftSelectProps {
  value: string;
  options: SoftSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** 更紧凑的尺寸（成长页/引导页自定义主题用） */
  compact?: boolean;
}

/** 主题统一的自定义下拉：圆角、主色高亮、避免系统原生蓝底大面板 */
export function SoftSelect({
  value,
  options,
  onChange,
  placeholder = '请选择',
  className = '',
  compact = false,
}: SoftSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-2 bg-bg border border-gray-100 text-left outline-none transition-colors ${
          compact ? 'px-3 py-2 rounded-lg text-sm' : 'px-3.5 py-2.5 rounded-xl text-sm'
        } ${open ? 'border-primary ring-1 ring-primary/20' : 'hover:border-primary/40'}`}
      >
        <span className={`truncate ${selected ? 'text-text-primary' : 'text-text-tertiary'}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={compact ? 14 : 16}
          className={`text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180 text-primary' : ''}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-30 left-0 right-0 mt-1.5 bg-white border border-gray-100 shadow-lg overflow-hidden ${
            compact ? 'rounded-xl' : 'rounded-2xl'
          }`}
        >
          <ul className={`max-h-52 overflow-y-auto py-1 ${compact ? 'text-xs' : 'text-sm'}`}>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 text-left transition-colors ${
                      compact ? 'px-3 py-2' : 'px-3.5 py-2.5'
                    } ${
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-text-primary hover:bg-bg-secondary'
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {active && <Check size={compact ? 12 : 14} className="text-primary shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SoftSelect;
