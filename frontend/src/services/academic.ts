import { request } from './api';

// 学业里程碑类型可选项（后端按年级累计解锁返回）
export interface MilestoneTypeOption {
  type: string;
  sub_type: string;
  title: string;
  suggested_points: number;
  star_level: number;
}

// GET /api/academic/allowed-types/:child_id 返回结构
export interface AllowedTypesResponse {
  grade: number;
  options: MilestoneTypeOption[];
}

// 学业里程碑记录（Layer 3，可发积分）
export interface AcademicMilestone {
  id: number;
  family_id: number;
  child_id: number;
  type: string;
  sub_type: string;
  title: string;
  description: string;
  occurred_at: string;
  points_awarded: number;
  parent_note: string;
  attachments: string;
  star_level: number;
  created_at: string;
}

// 学业趋势档位记录（Layer 2，只存档位不发分）
export interface AcademicTrendEntry {
  id: number;
  family_id: number;
  child_id: number;
  subject: string; // chinese / math / english / other
  metric_type: string; // homework / quiz / midterm_final / self_study_duration
  value_abc: string; // A+ / A / B / C
  occurred_week: string; // 如 "2026-W31"
  note: string;
  created_at: string;
}

// 录入里程碑请求体
export interface CreateMilestoneInput {
  child_id: number;
  type: string;
  sub_type?: string;
  title: string;
  description?: string;
  occurred_at: string; // RFC3339
  points?: number;
  parent_note?: string;
  attachments?: string; // 图片URL JSON 数组字符串
  star_level?: number;
}

// 录入趋势档位请求体
export interface CreateTrendInput {
  child_id: number;
  subject: string;
  metric_type: string;
  value_abc: string;
  occurred_week?: string;
  note?: string;
}

// 学业模块 metric_type 常量（与后端 model 对齐）
export const TREND_METRIC = {
  HOMEWORK: 'homework',
  QUIZ: 'quiz',
  MIDTERM_FINAL: 'midterm_final',
  SELF_STUDY_DURATION: 'self_study_duration',
} as const;

// 档位 → 数值映射（用于折线图 Y 轴）：A+=5, A=4, B=3, C=2
export const ABC_VALUE_MAP: Record<string, number> = {
  'A+': 5,
  A: 4,
  B: 3,
  C: 2,
};

// 数值 → 档位标签（用于 Y 轴展示）
export const ABC_LABEL_MAP: Record<number, string> = {
  5: 'A+',
  4: 'A',
  3: 'B',
  2: 'C',
};

export const academicApi = {
  // 查询当前年级允许的里程碑类型
  getAllowedTypes(childId: number): Promise<AllowedTypesResponse> {
    return request<AllowedTypesResponse>({
      method: 'GET',
      url: `/academic/allowed-types/${childId}`,
    });
  },

  // 查询里程碑历史（按 occurred_at 倒序）
  getMilestones(childId: number, limit = 50): Promise<AcademicMilestone[]> {
    return request<AcademicMilestone[]>({
      method: 'GET',
      url: `/academic/milestones/${childId}`,
      params: { limit },
    });
  },

  // 录入里程碑
  createMilestone(data: CreateMilestoneInput): Promise<AcademicMilestone> {
    return request<AcademicMilestone>({
      method: 'POST',
      url: '/academic/milestones',
      data,
    });
  },

  // 查询学业趋势（可按 metric_type 过滤）
  getTrends(childId: number, metricType?: string, limit = 30): Promise<AcademicTrendEntry[]> {
    return request<AcademicTrendEntry[]>({
      method: 'GET',
      url: `/academic/trends/${childId}`,
      params: metricType ? { metric_type: metricType, limit } : { limit },
    });
  },

  // 录入趋势档位
  createTrend(data: CreateTrendInput): Promise<AcademicTrendEntry> {
    return request<AcademicTrendEntry>({
      method: 'POST',
      url: '/academic/trends',
      data,
    });
  },
};
