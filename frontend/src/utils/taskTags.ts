// 任务标签计算工具
// 按优先级从高到低返回标签：家长陪伴 > 关键里程碑 > 主题任务 > 习惯养成 > AI 生成 > 手动创建

export interface TaskTag {
  label: string;
  color: string;
}

// 兼容 types/index.ts（aiGenerated 驼峰）与 services/tasks.ts（ai_generated 下划线）两种 Task 类型
export interface TaskTagInput {
  guardian_required?: boolean;
  is_key_milestone?: boolean;
  task_kind?: string;
  ai_generated?: boolean;
  aiGenerated?: boolean;
}

export function getTaskTags(task: TaskTagInput): TaskTag[] {
  const tags: TaskTag[] = [];
  const isAI = task.ai_generated ?? task.aiGenerated ?? false;
  const kind = task.task_kind;

  // 1. 家长陪伴
  if (task.guardian_required) {
    tags.push({ label: '家长陪伴', color: 'bg-rose-100 text-rose-700' });
  }
  // 2. 关键里程碑
  if (task.is_key_milestone) {
    tags.push({ label: '关键里程碑', color: 'bg-amber-100 text-amber-700' });
  }
  // 3. 主题任务
  if (kind === 'parent' || kind === 'child') {
    tags.push({ label: '主题任务', color: 'bg-blue-100 text-blue-700' });
  }
  // 4. 习惯养成
  if (kind === 'habit_master' || kind === 'habit_daily') {
    tags.push({ label: '习惯养成', color: 'bg-emerald-100 text-emerald-700' });
  }
  // 5. AI 生成
  if (isAI) {
    tags.push({ label: 'AI 生成', color: 'bg-violet-100 text-violet-700' });
  }
  // 6. 手动创建：非 AI 且 task_kind 为 daily 或为空
  if (!isAI && (kind === 'daily' || !kind)) {
    tags.push({ label: '手动创建', color: 'bg-gray-100 text-gray-700' });
  }

  return tags;
}
