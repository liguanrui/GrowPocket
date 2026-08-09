-- Migration: 更新年级×维度发展指南矩阵（按用户新方案 2026-08-09）
-- 说明：seedGradeDimensionGuides 是幂等的（已有数据则跳过），已存在的数据库需要手动执行本 SQL。
-- 维度 ID 映射：1=生活自理(self_care) 2=独立自主(independence) 3=动手实践(hands_on) 4=学习认知(learning) 5=社交情感(social_emotional) 6=身心健康(health)

BEGIN TRANSACTION;

-- === 一年级 ===
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 1 AND dimension_id = 1;
UPDATE grade_dimension_guides SET weight = 1.5, cap = 95,  focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 1 AND dimension_id = 2;
UPDATE grade_dimension_guides SET weight = 1.0, cap = 80,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 1 AND dimension_id = 3;
UPDATE grade_dimension_guides SET weight = 0.3, cap = 40,  focus_level = 'latent', updated_at = CURRENT_TIMESTAMP WHERE grade = 1 AND dimension_id = 4;
UPDATE grade_dimension_guides SET weight = 0.3, cap = 35,  focus_level = 'latent', updated_at = CURRENT_TIMESTAMP WHERE grade = 1 AND dimension_id = 5;
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 1 AND dimension_id = 6;

-- === 二年级 ===
UPDATE grade_dimension_guides SET weight = 1.6, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 2 AND dimension_id = 1;
UPDATE grade_dimension_guides SET weight = 1.5, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 2 AND dimension_id = 2;
UPDATE grade_dimension_guides SET weight = 1.2, cap = 85,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 2 AND dimension_id = 3;
UPDATE grade_dimension_guides SET weight = 1.0, cap = 80,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 2 AND dimension_id = 4;
UPDATE grade_dimension_guides SET weight = 0.4, cap = 45,  focus_level = 'latent', updated_at = CURRENT_TIMESTAMP WHERE grade = 2 AND dimension_id = 5;
UPDATE grade_dimension_guides SET weight = 1.6, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 2 AND dimension_id = 6;

-- === 三年级 ===
UPDATE grade_dimension_guides SET weight = 1.0, cap = 85,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 3 AND dimension_id = 1;
UPDATE grade_dimension_guides SET weight = 1.0, cap = 80,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 3 AND dimension_id = 2;
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 3 AND dimension_id = 3;
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 3 AND dimension_id = 4;
UPDATE grade_dimension_guides SET weight = 1.0, cap = 85,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 3 AND dimension_id = 5;
UPDATE grade_dimension_guides SET weight = 1.0, cap = 90,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 3 AND dimension_id = 6;

-- === 四年级 ===
UPDATE grade_dimension_guides SET weight = 1.0, cap = 90,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 4 AND dimension_id = 1;
UPDATE grade_dimension_guides SET weight = 1.2, cap = 90,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 4 AND dimension_id = 2;
UPDATE grade_dimension_guides SET weight = 1.5, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 4 AND dimension_id = 3;
UPDATE grade_dimension_guides SET weight = 1.5, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 4 AND dimension_id = 4;
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 4 AND dimension_id = 5;
UPDATE grade_dimension_guides SET weight = 1.0, cap = 95,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 4 AND dimension_id = 6;

-- === 五年级 ===
UPDATE grade_dimension_guides SET weight = 1.0, cap = 95,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 5 AND dimension_id = 1;
UPDATE grade_dimension_guides SET weight = 1.2, cap = 95,  focus_level = 'secondary', updated_at = CURRENT_TIMESTAMP WHERE grade = 5 AND dimension_id = 2;
UPDATE grade_dimension_guides SET weight = 1.5, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 5 AND dimension_id = 3;
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 5 AND dimension_id = 4;
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 5 AND dimension_id = 5;
UPDATE grade_dimension_guides SET weight = 1.5, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 5 AND dimension_id = 6;

-- === 六年级 ===
UPDATE grade_dimension_guides SET weight = 1.5, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 6 AND dimension_id = 1;
UPDATE grade_dimension_guides SET weight = 2.0, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 6 AND dimension_id = 2;
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 6 AND dimension_id = 3;
UPDATE grade_dimension_guides SET weight = 1.5, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 6 AND dimension_id = 4;
UPDATE grade_dimension_guides SET weight = 1.8, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 6 AND dimension_id = 5;
UPDATE grade_dimension_guides SET weight = 1.5, cap = 100, focus_level = 'primary', updated_at = CURRENT_TIMESTAMP WHERE grade = 6 AND dimension_id = 6;

COMMIT;
