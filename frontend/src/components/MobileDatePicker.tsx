import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Calendar, X } from 'lucide-react';

type PickerMode = 'date' | 'datetime';

interface MobileDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  mode?: PickerMode;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

const ITEM_H = 40;
const VISIBLE = 5;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function parseValue(value: string, mode: PickerMode) {
  const now = new Date();
  if (!value) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: Math.floor(now.getMinutes() / 5) * 5,
    };
  }
  if (mode === 'datetime') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        minute: d.getMinutes(),
      };
    }
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return {
      year: Number(m[1]),
      month: Number(m[2]),
      day: Number(m[3]),
      hour: now.getHours(),
      minute: Math.floor(now.getMinutes() / 5) * 5,
    };
  }
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: Math.floor(now.getMinutes() / 5) * 5,
  };
}

function formatDisplay(value: string, mode: PickerMode) {
  if (!value) return '';
  if (mode === 'datetime') {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  return `${m[1]}/${m[2]}/${m[3]}`;
}

function toOutput(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  mode: PickerMode,
) {
  const date = `${year}-${pad(month)}-${pad(day)}`;
  if (mode === 'datetime') return `${date}T${pad(hour)}:${pad(minute)}`;
  return date;
}

function parseBound(bound?: string): Date | null {
  if (!bound) return null;
  if (bound.length === 10) return new Date(`${bound}T00:00:00`);
  const d = new Date(bound);
  return isNaN(d.getTime()) ? null : d;
}

function clampParts(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  min?: string,
  max?: string,
) {
  let { year, month, day, hour, minute } = parts;
  const maxDay = daysInMonth(year, month);
  if (day > maxDay) day = maxDay;

  const minD = parseBound(min);
  const maxD = parseBound(max);
  let t = new Date(year, month - 1, day, hour, minute);

  if (minD && t < minD) {
    year = minD.getFullYear();
    month = minD.getMonth() + 1;
    day = minD.getDate();
    hour = minD.getHours();
    minute = minD.getMinutes();
  }
  t = new Date(year, month - 1, day, hour, minute);
  if (maxD && t > maxD) {
    year = maxD.getFullYear();
    month = maxD.getMonth() + 1;
    day = maxD.getDate();
    hour = maxD.getHours();
    minute = maxD.getMinutes();
  }
  return { year, month, day, hour, minute };
}

interface WheelColumnProps {
  items: { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
}

function WheelColumn({ items, value, onChange }: WheelColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const index = Math.max(0, items.findIndex((i) => i.value === value));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTop = target;
    }
  }, [index, items.length]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const i = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, i));
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
      const next = items[clamped];
      if (next && next.value !== value) onChange(next.value);
    }, 80);
  };

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <div
        ref={ref}
        onScroll={handleScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide"
        style={{
          paddingTop: ITEM_H * Math.floor(VISIBLE / 2),
          paddingBottom: ITEM_H * Math.floor(VISIBLE / 2),
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item) => (
          <div
            key={item.value}
            className="snap-center flex items-center justify-center text-[15px] transition-colors"
            style={{
              height: ITEM_H,
              color: item.value === value ? '#1C1C1E' : '#AEAEB2',
              fontWeight: item.value === value ? 600 : 400,
            }}
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MobileDatePicker({
  value,
  onChange,
  mode = 'date',
  min,
  max,
  placeholder = '请选择日期',
  className = '',
  style,
  disabled = false,
}: MobileDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseValue(value, mode));

  const openPicker = () => {
    if (disabled) return;
    setDraft(clampParts(parseValue(value, mode), min, max));
    setOpen(true);
  };

  const yearRange = useMemo(() => {
    const minD = parseBound(min);
    const maxD = parseBound(max);
    const start = minD ? minD.getFullYear() : 2010;
    const end = maxD ? maxD.getFullYear() : new Date().getFullYear() + 5;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [min, max]);

  const update = useCallback(
    (patch: Partial<typeof draft>) => {
      setDraft((prev) => clampParts({ ...prev, ...patch }, min, max));
    },
    [min, max],
  );

  const yearItems = useMemo(
    () => yearRange.map((y) => ({ value: y, label: `${y}年` })),
    [yearRange],
  );
  const monthItems = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
    [],
  );
  const dayItems = useMemo(() => {
    const n = daysInMonth(draft.year, draft.month);
    return Array.from({ length: n }, (_, i) => ({ value: i + 1, label: `${i + 1}日` }));
  }, [draft.year, draft.month]);
  const hourItems = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ value: i, label: pad(i) })),
    [],
  );
  const minuteItems = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: pad(i * 5) })),
    [],
  );

  const confirm = () => {
    const c = clampParts(draft, min, max);
    onChange(toOutput(c.year, c.month, c.day, c.hour, c.minute, mode));
    setOpen(false);
  };

  const display = formatDisplay(value, mode);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        className={
          className ||
          'w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 focus:border-primary outline-none text-left flex items-center justify-between'
        }
        style={style}
      >
        <span className={display ? 'text-text-primary' : 'text-text-tertiary'}>
          {display || placeholder}
        </span>
        <Calendar size={16} className="text-text-tertiary shrink-0 ml-2" />
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl w-full max-w-lg safe-area-bottom"
            style={{ animation: 'slideUpFromBottom 0.28s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-text-secondary px-2 py-1"
              >
                取消
              </button>
              <span className="text-base font-semibold text-text-primary">
                {mode === 'datetime' ? '选择日期时间' : '选择日期'}
              </span>
              <button
                type="button"
                onClick={confirm}
                className="text-sm font-medium text-primary px-2 py-1"
              >
                确定
              </button>
            </div>

            <div
              className="relative mx-4 mb-4 mt-1"
              style={{ height: ITEM_H * VISIBLE }}
            >
              {/* 选中高亮条 */}
              <div
                className="pointer-events-none absolute left-0 right-0 rounded-xl bg-gray-100/90 z-0"
                style={{
                  top: ITEM_H * Math.floor(VISIBLE / 2),
                  height: ITEM_H,
                }}
              />
              {/* 上下渐隐 */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16"
                style={{
                  background: 'linear-gradient(to bottom, #fff 20%, transparent)',
                }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16"
                style={{
                  background: 'linear-gradient(to top, #fff 20%, transparent)',
                }}
              />

              <div className="relative z-[1] flex h-full">
                <WheelColumn
                  items={yearItems}
                  value={draft.year}
                  onChange={(year) => update({ year })}
                />
                <WheelColumn
                  items={monthItems}
                  value={draft.month}
                  onChange={(month) => update({ month })}
                />
                <WheelColumn
                  items={dayItems}
                  value={draft.day}
                  onChange={(day) => update({ day })}
                />
                {mode === 'datetime' && (
                  <>
                    <WheelColumn
                      items={hourItems}
                      value={draft.hour}
                      onChange={(hour) => update({ hour })}
                    />
                    <WheelColumn
                      items={minuteItems}
                      value={Math.round(draft.minute / 5) * 5}
                      onChange={(minute) => update({ minute })}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between px-5 pb-5">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="text-sm text-text-tertiary flex items-center gap-1"
              >
                <X size={14} /> 清除
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const parts = clampParts(
                    {
                      year: now.getFullYear(),
                      month: now.getMonth() + 1,
                      day: now.getDate(),
                      hour: now.getHours(),
                      minute: Math.floor(now.getMinutes() / 5) * 5,
                    },
                    min,
                    max,
                  );
                  setDraft(parts);
                }}
                className="text-sm text-primary"
              >
                {mode === 'datetime' ? '现在' : '今天'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileDatePicker;
