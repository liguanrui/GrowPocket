import type { Task } from '../services/tasks';
import { parseTaskPhotos } from '../services/tasks';
import { parsePhotoUrls } from '../services/growthStory';

export interface YearbookStats {
  firstTaskDate: string | null;
  firstTaskTitle: string | null;
  taskCount: number;
  totalPoints: number;
  photos: string[];
  /** YYYY-MM-DD 展示用起止（优先 cycle，其次任务时间） */
  startDate: string | null;
  endDate: string | null;
}

function toDateKey(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    // 可能已是 YYYY-MM-DD
    const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function formatDateCN(dateKey: string | null): string {
  if (!dateKey) return '—';
  const [y, m, d] = dateKey.split('-');
  if (!y || !m || !d) return dateKey;
  return `${Number(y)}年${Number(m)}月${Number(d)}日`;
}

export function formatDateRangeCN(start: string | null, end: string | null): string {
  if (!start && !end) return '本阶段';
  if (start && end) {
    const s = start.slice(5).replace('-', '.');
    const e = end.slice(5).replace('-', '.');
    return `${start.slice(0, 4)}.${s} — ${end.slice(0, 4)}.${e}`;
  }
  return formatDateCN(start || end);
}

/** 起止日期（含首尾）经历天数 */
export function daysBetweenInclusive(start: string | null, end: string | null): number {
  const s = toDateKey(start);
  const e = toDateKey(end);
  if (!s || !e) return 0;
  const a = new Date(`${s}T00:00:00`).getTime();
  const b = new Date(`${e}T00:00:00`).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * 从周期任务与可选的故事相册聚合年报数据
 */
export function buildYearbookStats(input: {
  tasks: Task[];
  cycleStart?: string | null;
  cycleEnd?: string | null;
  storyPhotoUrls?: string;
}): YearbookStats {
  const tasks = Array.isArray(input.tasks) ? [...input.tasks] : [];
  // 按完成/创建时间升序
  tasks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const first = tasks[0] || null;
  const taskCount = tasks.length;
  const totalPoints = tasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0);

  const photoSet: string[] = [];
  const seen = new Set<string>();
  for (const t of tasks) {
    for (const url of parseTaskPhotos(t.photo)) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      photoSet.push(url);
    }
  }
  // 故事精选相册补充
  for (const url of parsePhotoUrls(input.storyPhotoUrls || '')) {
    // story 可能存了 JSON 数组字符串当单个元素 —— 再展平一次
    const expanded = url.trim().startsWith('[') ? parseTaskPhotos(url) : [url];
    for (const u of expanded) {
      if (!u || seen.has(u)) continue;
      // 过滤明显不是 URL 的脏数据
      if (!u.startsWith('/') && !u.startsWith('http')) continue;
      seen.add(u);
      photoSet.push(u);
    }
  }

  let startDate = toDateKey(input.cycleStart || null);
  let endDate = toDateKey(input.cycleEnd || null);
  if (!startDate && tasks.length > 0) startDate = toDateKey(tasks[0].created_at);
  if (!endDate && tasks.length > 0) endDate = toDateKey(tasks[tasks.length - 1].created_at);

  return {
    firstTaskDate: first ? toDateKey(first.created_at) : null,
    firstTaskTitle: first?.title || null,
    taskCount,
    totalPoints,
    photos: photoSet,
    startDate,
    endDate,
  };
}
