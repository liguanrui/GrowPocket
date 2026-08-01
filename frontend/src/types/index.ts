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
