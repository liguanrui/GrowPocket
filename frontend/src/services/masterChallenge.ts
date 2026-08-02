import { request } from './api';

// 大师挑战模板（V3.1 模块 B）
export interface MasterChallengeTemplate {
  id: number;
  title: string;
  description: string;
  category: string; // family_cocreation / creative_expression / community_service / financial_literacy
  difficulty_level: number; // 1-5 (L1~L5)
  min_grade: number;
  max_grade: number;
  primary_dim_ids: string; // JSON 数组字符串如 "[1,4,6]"
  recommended_stages: number;
  estimated_days: number;
  points_reward: number; // 基础稀有积分
  icon: string;
  is_active: boolean;
  created_at?: string;
}

// 大师挑战阶段打卡记录
export interface MasterChallengeStage {
  id: number;
  instance_id: number;
  stage_index: number; // 0-based
  title: string;
  description: string;
  status: string; // pending / in_progress / completed
  notes: string;
  attachments: string; // 图片 URL JSON 数组字符串（最多 3 张）
  self_rating: number; // 1-5 自评进度
  completed_at: string | null;
  created_at?: string;
}

// 用户立项的大师挑战实例
export interface MasterChallengeInstance {
  id: number;
  family_id?: number;
  child_id: number;
  template_id: number;
  title: string;
  status: string; // in_progress / submitted / completed / abandoned
  started_at: string;
  completed_at: string | null;
  final_summary: string;
  created_at?: string;
  updated_at?: string;
}

// 大师挑战验收提交
export interface MasterChallengeSubmission {
  id: number;
  instance_id: number;
  child_summary: string;
  attachments: string; // 成果图片/视频封面 JSON 数组字符串（最多 9 张）
  participation_score: number; // 参与度 1-5
  application_score: number; // 能力应用度 1-5
  quality_score: number; // 成果满意度 1-5
  passed: boolean; // ≥2 星即通过
  points_awarded: number;
  reviewed_at: string;
  created_at?: string;
}

// 实例详情（含模板、阶段和提交）
export interface InstanceDetail {
  instance: MasterChallengeInstance;
  template?: MasterChallengeTemplate | null;
  stages: MasterChallengeStage[];
  submission: MasterChallengeSubmission | null;
}

// 列表响应
export interface ListResult<T> {
  items: T[];
  total: number;
}

// 立项响应
export interface StartResult {
  instance: MasterChallengeInstance;
  stages: MasterChallengeStage[];
}

// 阶段打卡入参
export interface UpdateStageInput {
  notes: string;
  attachments: string; // JSON 数组字符串
  self_rating: number; // 1-5
}

// 提交验收入参
export interface SubmitInput {
  child_summary: string;
  attachments: string; // JSON 数组字符串
}

// 家长验收入参
export interface ReviewInput {
  participation_score: number;
  application_score: number;
  quality_score: number;
}

export const masterChallengeApi = {
  // 获取该孩子可用的大师挑战模板列表
  getTemplates(childId: number) {
    return request<ListResult<MasterChallengeTemplate>>({
      method: 'GET',
      url: '/master-challenges/templates',
      params: { child_id: childId },
    });
  },
  // 立项：从模板创建实例 + AI 拆阶段
  start(childId: number, templateId: number) {
    return request<StartResult>({
      method: 'POST',
      url: '/master-challenges/start',
      data: { child_id: childId, template_id: templateId },
    });
  },
  // 查询孩子的大师挑战实例列表
  getInstances(childId: number) {
    return request<ListResult<MasterChallengeInstance>>({
      method: 'GET',
      url: `/master-challenges/instances/${childId}`,
    });
  },
  // 查询实例详情（含阶段和提交）
  getInstanceDetail(instanceId: number) {
    return request<InstanceDetail>({
      method: 'GET',
      url: `/master-challenges/instances/detail/${instanceId}`,
    });
  },
  // 阶段打卡
  updateStage(stageId: number, data: UpdateStageInput) {
    return request<MasterChallengeStage>({
      method: 'PUT',
      url: `/master-challenges/stages/${stageId}`,
      data,
    });
  },
  // 提交验收
  submit(instanceId: number, data: SubmitInput) {
    return request<MasterChallengeSubmission>({
      method: 'POST',
      url: `/master-challenges/submit/${instanceId}`,
      data,
    });
  },
  // 家长验收打分（3 维，≥2 维达到 4 星即通过）
  review(submissionId: number, data: ReviewInput) {
    return request<MasterChallengeSubmission>({
      method: 'POST',
      url: `/master-challenges/review/${submissionId}`,
      data,
    });
  },
};
