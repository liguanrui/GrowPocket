// === 核心表结构：对齐后端数据库设计 v2 ===
// 账号表：承载家长账号 + 孩子档案，通过 role 字段区分
// - role=parent：家长，可登录
// - role=child：孩子档案，后续可扩展为孩子独立登录
export type UserRole = 'parent' | 'child';

export interface User {
  id: string;
  familyId: string;
  role: UserRole;        // 区分家长 vs 孩子
  nickname: string;      // 通用显示名（家长昵称/孩子姓名）
  avatar?: string;
  // 以下字段仅 role=child 时填写
  gender?: 0 | 1;        // 0=男 1=女
  birthday?: Date;
  balance?: number;      // 孩子的独立积分账户；家长可为 0 或 undefined
  // 通用时间戳
  createdAt: Date;
  updatedAt: Date;
  // 登录相关（仅家长，由后端维护，前端不感知）
  // passwordHash / lastLoginAt 等存在后端
}

// 家庭表
export interface Family {
  id: string;
  name: string;
  createdAt: Date;
}

// 任务表
// 说明：任务=主动行为记录（做家务/学习/运动/奖惩）。
// - 普通任务：status 从 in_progress → submitted → completed/rejected
// - 手动积分调整（奖惩类）：创建时 status 直接 = completed，points 为正数奖励，负数表示扣除
export type TaskStatus = 'in_progress' | 'submitted' | 'completed' | 'rejected';
export type TaskDifficulty = 'easy' | 'medium' | 'hard';
export type TaskFrequency = 'daily' | 'weekly' | 'monthly' | 'once';
export type TaskCategory = '学习' | '家务' | '行为习惯' | '运动' | '其他';

export interface Task {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  points: number;        // 正数=奖励；负数=扣分（奖惩类任务）
  status: TaskStatus;
  childId: string;       // 归属孩子（users.id where role=child）
  childName?: string;
  createdBy: string;     // 创建者（家长ID，users.id where role=parent）
  photo?: string;        // 成果/证明照片URL（可用于生成成长相册）
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
  category?: TaskCategory;
  difficulty?: TaskDifficulty;
  frequency?: TaskFrequency;
  recurringId?: string;
  abilityDimensionId?: number;
  secondaryDimensions?: number[];
  aiGenerated?: boolean;
}

export interface TaskTemplate {
  id: number;
  familyId: number;
  title: string;
  description: string;
  points: number;
  icon: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  minAge: number;
  maxAge: number;
  difficulty: TaskDifficulty;
  frequency: TaskFrequency;
  estimatedTime: number;
  tags?: string;
  isSystem: boolean;
}

export interface RecommendedTask extends TaskTemplate {
  reason: string;
  score: number;
  ageMatch: boolean;
}

export interface TaskRecurringConfig {
  id: number;
  familyId: number;
  templateId: number;
  childId: number;
  childName: string;
  title: string;
  description: string;
  points: number;
  frequency: TaskFrequency;
  weekDays: string;
  isActive: boolean;
  nextGenerateAt: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

// 积分变动记录
// type=income 表示加积分；type=expense 表示扣积分
// 来源可能是任务(relatedType=task) / 兑换(relatedType=redeem) / 手动奖惩(relatedType=manual)
export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  childId: string;       // 归属孩子（users.id where role=child）
  type: TransactionType;
  amount: number;        // 正数
  reason: string;
  relatedId?: string;    // task.id / redeem.id
  relatedType?: 'task' | 'redeem' | 'manual';
  balanceAfter: number;  // 变动后的余额
  createdAt: Date;
}

// 兑换商品表
export type ItemCategory = 'physical' | 'experience' | 'privilege';

export interface RedeemItem {
  id: string;
  familyId: string;
  name: string;
  description?: string;
  points: number;        // 所需积分
  image?: string;
  category: ItemCategory;
  stock: number;         // -1 表示无限；正数表示剩余数量
  createdAt: Date;
}

// 兑换记录（去掉审核流程，点击即完成）
// 兑换行为：家长选中孩子 → 点「立即兑换」→ 扣积分 + 生成一条 expense Transaction + 生成一条 Redeem 记录
export interface Redeem {
  id: string;
  childId: string;
  childName?: string;
  itemId: string;
  itemName?: string;
  itemImage?: string;
  points: number;        // 实际消耗的积分
  createdAt: Date;
}

// 成长相册（由 tasks.photo 派生）
export interface GrowthPhoto {
  taskId: string;
  taskTitle: string;
  photo: string;
  points: number;
  createdAt: Date;
}

// 成长时间线条目（聚合 tasks/transactions/redeems）
export interface TimelineEvent {
  id: string;
  date: string;
  events: {
    id: string;
    type: 'task' | 'redeem' | 'manual';
    title: string;
    points: number;
    createdAt: Date;
  }[];
}

// 积分趋势图
export interface TrendPoint {
  date: string;
  balance: number;
}

// 消息/通知
export interface Message {
  id: string;
  type: 'task' | 'points' | 'redeem' | 'system';
  title: string;
  content: string;
  status: 'read' | 'unread';
  relatedId?: string;
  createdAt: Date;
}

// === v3 能力维度系统 ===
export interface AbilityDimension {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  research_src: string;
  sort_order: number;
}

export interface ChildAbilityScore {
  dimension_id: number;
  score: number;
  dimension_code: string;
  dimension_name: string;
  dimension_color: string;
}

// === 兼容旧组件的别名（便于逐步替换）===
export type Badge = {
  id: string;
  title: string;
  name?: string;
  icon: string;
  description?: string;
  earnedAt?: Date;
};
export type Reward = {
  id: string;
  name: string;
  title?: string;
  description?: string;
  points: number;
  pointsRequired?: number;
  image?: string;
  stock?: number;
  category: ItemCategory;
};
// Child 旧名保留：在页面中 Child = User (role=child)
export type Child = User;
export type Member = User;
export type PointsRecord = Transaction;

// ============ V1.3 新增:任务中心 Cycle 课程表类型 ============

/** Cycle 长度档位(1/2/3/4 周) */
export type CycleLengthWeeks = 1 | 2 | 3 | 4;

/** Cycle 状态 */
export type CyclePlanStatus = 'draft' | 'locked' | 'applied' | 'expired';

/** 主题周位置(2-4 周 Cycle 时调整主题周所在周) */
export type ThemeWeekPosition = 'week1' | 'week2' | 'week3' | 'week4';

/** Cycle 计划快照 */
export interface CyclePlan {
  id: number;
  child_id: number;
  start_date: string; // ISO 日期 yyyy-mm-dd 周一
  end_date: string; // = start_date + cycle_length_weeks*7 - 1
  cycle_length_weeks: CycleLengthWeeks; // V1.3 新增
  goals_json: CycleGoalsSnapshot | null; // V1.3 新增:阶段目标设定快照
  status: CyclePlanStatus;
  theme_week_config: ThemeWeekConfig | null;
  dimension_ratio_summary: DimensionRatioSummary;
  daily_instances_json: Record<string, DailyTaskInstance[]>; // key=yyyy-mm-dd
  lock_version: number;
  locked_at: string | null;
  locked_by_parent: number | null;
  created_at: string;
  updated_at: string;
}

/** 阶段目标设定快照(存入 cycle_plan.goals_json) */
export interface CycleGoalsSnapshot {
  focus_dims: number[];
  points_target: number;
  points_target_grade: string; // G1-G6
}

/** 主题周配置 */
export interface ThemeWeekConfig {
  active: boolean;
  dim: number; // theme_dim_id
  theme_title: string;
  start_date: string;
  end_date: string;
  position?: ThemeWeekPosition; // V1.3 新增:多周时调整主题周所在周
}

/** 整 Cycle 维度占比汇总 */
export interface DimensionRatioSummary {
  main_dim_pct: number; // 0-1,如 0.62
  secondary_pct: number;
  latent_pct: number;
  theme_dim_contrib: number; // 主题周贡献占比
}

/** 每日任务实例(Cycle 切片落地后的任务) */
export interface DailyTaskInstance {
  id: number;
  task_template_id: number;
  title: string;
  description: string;
  points: number;
  difficulty: string;
  category: string;
  ability_dimension_id: number;
  task_kind: TaskKind; // V1.3 新增
  parent_id?: number | null; // V1.3 新增
  supervision?: SupervisionConfig | null; // V1.3 新增
  prerequisite_code?: string; // V1.3 新增
  locked: boolean; // 家长锁定标记
  status: 'pending' | 'submitted' | 'completed' | 'rejected';
  completed_at?: string | null;
}

/** 周期课程表预览响应 */
export interface CyclePlanPreviewResponse {
  cycle_plan: CyclePlan;
  daily_instances: Record<string, DailyTaskInstance[]>;
  dimension_ratio: DimensionRatioSummary;
  theme_week_config: ThemeWeekConfig | null;
  goals_badge: CycleGoalsSnapshot | null; // V1.3 新增:阶段目标徽标
  lock_version: number;
}

/** 任务调整操作类型 */
export type TaskAdjustOperation =
  | 'lock'
  | 'replace'
  | 'add'
  | 'remove'
  | 'escalate_supervision';

/** 任务调整请求 */
export interface TaskAdjustRequest {
  daily_task_instance_id: number;
  operation: TaskAdjustOperation;
  new_supervision?: SupervisionConfig;
  replace_with_template_id?: number;
  add_template_id?: number;
}

/** 替换候选任务 */
export interface ReplaceCandidate {
  id: number;
  title: string;
  description: string;
  points: number;
  difficulty: string;
  dimension_id: number;
}

/** 任务类型枚举(对应 task_template.task_kind) */
export type TaskKind =
  | 'daily_fixed' // 每日固定锚任务
  | 'weekly_recurring' // 每周重复任务
  | 'guardian_reqd' // 需家长陪同的高风险任务
  | 'collaborative' // 协作型亲子任务
  | 'parent_child' // 跨周期父任务的子任务
  | 'cycle_theme'; // 主题周任务

/** TaskKind 显示信息 */
export const TaskKindMeta: Record<TaskKind, { label: string; color: string; badge: string }> = {
  daily_fixed: { label: '每日保底', color: 'bg-blue-100 text-blue-700', badge: '🛡️' },
  weekly_recurring: { label: '每周重复', color: 'bg-purple-100 text-purple-700', badge: '🔄' },
  guardian_reqd: { label: '家长陪同', color: 'bg-red-100 text-red-700', badge: '⚠️' },
  collaborative: { label: '亲子协作', color: 'bg-pink-100 text-pink-700', badge: '👨‍👩‍👧' },
  parent_child: { label: '跨周期', color: 'bg-amber-100 text-amber-700', badge: '🌱' },
  cycle_theme: { label: '主题周', color: 'bg-yellow-100 text-yellow-700', badge: '🌟' },
};

/** 6 维度 ID 常量 */
export const ABILITY_DIMENSIONS = {
  SELF_CARE: 1, // 生活自理
  RESPONSIBILITY: 2, // 责任担当
  LEARNING: 3, // 学习探索
  SOCIAL: 4, // 社交协作
  CREATIVITY: 5, // 创意审美
  SPORTS: 6, // 运动健康
} as const;

/** 家长陪同等级 */
export type SupervisionLevel = 'confirm' | 'accompany' | 'doorstep';

/** 监护配置(存入 task_template.supervision JSON) */
export interface SupervisionConfig {
  level: SupervisionLevel;
  sign_off_required: boolean;
  notes?: string; // 安全确认书附注
}
