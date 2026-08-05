import type { CycleLengthWeeks, DailyTaskInstance, TaskKind } from '../types';

interface CycleCalendarGridProps {
  dailyInstances: Record<string, DailyTaskInstance[]>;
  cycleLengthWeeks: CycleLengthWeeks;
  startDate: string; // yyyy-mm-dd(周一)
  onClickCell?: (date: string) => void;
}

// task_kind 分色:蓝/绿/橙/紫/粉/金
const TASK_KIND_STYLE: Record<TaskKind, { bg: string; text: string; label: string; icon?: string }> = {
  daily_fixed: { bg: 'bg-blue-50', text: 'text-blue-700', label: '每日保底' },
  weekly_recurring: { bg: 'bg-green-50', text: 'text-green-700', label: '每周重复' },
  guardian_reqd: { bg: 'bg-orange-50', text: 'text-orange-700', label: '家长陪同', icon: '⚠️' },
  collaborative: { bg: 'bg-purple-50', text: 'text-purple-700', label: '亲子协作' },
  parent_child: { bg: 'bg-pink-50', text: 'text-pink-700', label: '跨周期' },
  cycle_theme: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: '主题周', icon: '🌟' },
};

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateDateRange(startDate: string, weeks: number): string[] {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(formatDateKey(d));
  }
  return dates;
}

// 完成度 mini 圆环
function MiniRing({ completed, total }: { completed: number; total: number }) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="flex-shrink-0">
      <circle cx="11" cy="11" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
      <circle
        cx="11"
        cy="11"
        r={radius}
        fill="none"
        stroke="#F59E6B"
        strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 11 11)"
      />
      <text x="11" y="14" textAnchor="middle" fontSize="7" fill="#6b7280" fontWeight="600">
        {total > 0 ? completed : '-'}
      </text>
    </svg>
  );
}

function TaskChip({ task }: { task: DailyTaskInstance }) {
  const style = TASK_KIND_STYLE[task.task_kind] || TASK_KIND_STYLE.daily_fixed;
  return (
    <div
      className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] leading-tight ${style.bg} ${style.text} truncate`}
      title={`${style.label} · ${task.title}`}
    >
      {style.icon && <span className="flex-shrink-0">{style.icon}</span>}
      <span className="truncate">{task.title}</span>
    </div>
  );
}

function DayCell({
  date,
  tasks,
  onClick,
}: {
  date: string;
  tasks: DailyTaskInstance[];
  onClick?: () => void;
}) {
  const isThemeWeek = tasks.some((t) => t.task_kind === 'cycle_theme');
  const todayStr = formatDateKey(new Date());
  const isToday = date === todayStr;
  const visible = tasks.slice(0, 3);
  const remaining = tasks.length - visible.length;
  const completed = tasks.filter((t) => t.status === 'completed').length;

  const d = new Date(`${date}T00:00:00`);
  const month = d.getMonth() + 1;
  const day = d.getDate();

  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg p-1 min-h-[112px] border ${
        isThemeWeek ? 'bg-yellow-50 border-yellow-200' : 'bg-card border-gray-100'
      } ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''} ${
        isToday ? 'ring-1 ring-primary' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-medium text-text-secondary">
            {month}/{day}
          </span>
        </div>
        {tasks.length > 0 && <MiniRing completed={completed} total={tasks.length} />}
      </div>
      <div className="space-y-0.5">
        {visible.map((t) => (
          <TaskChip key={t.id} task={t} />
        ))}
        {remaining > 0 && (
          <div className="text-[9px] text-text-tertiary">+{remaining} more</div>
        )}
        {tasks.length === 0 && <div className="text-[9px] text-text-tertiary/60">—</div>}
      </div>
    </div>
  );
}

export function CycleCalendarGrid({
  dailyInstances,
  cycleLengthWeeks,
  startDate,
  onClickCell,
}: CycleCalendarGridProps) {
  const dates = generateDateRange(startDate, cycleLengthWeeks);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-center text-[10px] font-medium text-text-tertiary">
            周{w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dates.map((date) => (
          <DayCell
            key={date}
            date={date}
            tasks={dailyInstances[date] || []}
            onClick={onClickCell ? () => onClickCell(date) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default CycleCalendarGrid;
