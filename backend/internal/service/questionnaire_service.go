package service

import (
	"encoding/json"
	"errors"
	"log"

	"growpocket/internal/database"
	"growpocket/internal/model"
)

// QuestionnaireService 问卷服务
type QuestionnaireService struct {
	ability *AbilityService
}

// NewQuestionnaireService 创建问卷服务实例
func NewQuestionnaireService() *QuestionnaireService {
	return &QuestionnaireService{ability: NewAbilityService()}
}

// AnswerInput 单题答案输入
type AnswerInput struct {
	QuestionID  uint `json:"question_id"`
	DimensionID uint `json:"dimension_id"`
	Score       int  `json:"score"`
}

// qOption / qItem : 解析问卷 Questions JSON 的临时结构
type qOption struct {
	Score int `json:"score"`
}
type qItem struct {
	DimensionID uint     `json:"dimension_id"`
	Options     []qOption `json:"options"`
}

// GetByStage 按阶段获取问卷，level 非空时按档位过滤，未命中时回退到通用问卷
func (s *QuestionnaireService) GetByStage(stage, level string) (*model.Questionnaire, error) {
	var q model.Questionnaire
	if level != "" {
		// 优先查指定档位
		if err := database.DB.Where("stage = ? AND level = ?", stage, level).Order("created_at DESC").First(&q).Error; err == nil {
			return &q, nil
		}
		// 回退到通用问卷（level 为空），用独立查询避免条件叠加
		if err := database.DB.Where("stage = ? AND (level = '' OR level IS NULL)", stage).Order("created_at DESC").First(&q).Error; err != nil {
			return nil, errors.New("问卷不存在")
		}
		return &q, nil
	}
	if err := database.DB.Where("stage = ?", stage).Order("created_at DESC").First(&q).Error; err != nil {
		return nil, errors.New("问卷不存在")
	}
	return &q, nil
}

// SubmitAnswers 提交答案：
// 1. 解析问卷题目的每维度理论 min/max 得分
// 2. 计算用户答题实际得分
// 3. 调用 SetQuestionnaireBaseline 建档（不是累加任务奖励式加分）
func (s *QuestionnaireService) SubmitAnswers(familyID, childID uint, questionnaireID uint, stage string, answers []AnswerInput) (int, error) {
	// 校验孩子归属当前家庭，避免跨家庭写分/生成脏数据
	var child model.User
	if err := database.DB.Where("id = ? AND family_id = ? AND role = ?", childID, familyID, model.RoleChild).First(&child).Error; err != nil {
		return 0, errors.New("孩子档案不存在")
	}

	// 查问卷
	var q model.Questionnaire
	if err := database.DB.First(&q, questionnaireID).Error; err != nil {
		return 0, errors.New("问卷不存在")
	}

	// 解析问卷 Questions，计算每个维度的理论 rawMin / rawMax
	var items []qItem
	dimMin := map[uint]int{}
	dimMax := map[uint]int{}
	if q.Questions != "" {
		if err := json.Unmarshal([]byte(q.Questions), &items); err == nil {
			for _, it := range items {
				if it.DimensionID == 0 || len(it.Options) == 0 {
					continue
				}
				minS, maxS := it.Options[0].Score, it.Options[0].Score
				for _, op := range it.Options {
					if op.Score < minS {
						minS = op.Score
					}
					if op.Score > maxS {
						maxS = op.Score
					}
				}
				dimMin[it.DimensionID] += minS
				dimMax[it.DimensionID] += maxS
			}
		} else {
			log.Printf("[Questionnaire] 解析问卷 Questions 失败 id=%d: %v", q.ID, err)
		}
	}

	// 用户答题：每维度累加实际得分
	dimScores := map[uint]int{}
	for _, ans := range answers {
		dimScores[ans.DimensionID] += ans.Score
	}

	// 按维度建档：调用 SetQuestionnaireBaseline（覆盖式写入，不是任务加分式累加）
	for dimID, score := range dimScores {
		rawMin, rawMax := dimMin[dimID], dimMax[dimID]
		if rawMax <= rawMin {
			// 未命中解析时的兜底：每题 3 档（1-5 分），假设用户每维度答了 3 题 → [3,15]
			rawMin, rawMax = 3, 15
		}
		if err := s.ability.SetQuestionnaireBaseline(childID, familyID, dimID, score, rawMin, rawMax); err != nil {
			log.Printf("[Questionnaire] 基线建档失败 child=%d dim=%d raw=%d/%d~%d: %v", childID, dimID, score, rawMin, rawMax, err)
		}
	}

	// 保存答案记录
	answersJSON, _ := json.Marshal(answers)
	record := &model.QuestionnaireAnswer{
		FamilyID:        familyID,
		ChildID:         childID,
		QuestionnaireID: questionnaireID,
		Stage:           stage,
		Answers:         string(answersJSON),
	}
	database.DB.Create(record)

	// 发放积分奖励：register=0（新手指引不发分）, weekly=20, review=30
	// 注册问卷只用于能力评估建档，不得发放积分（与 Transaction 禁止词「问卷奖励」一致）
	reward := 20
	switch stage {
	case "register":
		reward = 0
	case "review":
		reward = 30
	}

	if reward > 0 {
		var child model.User
		if err := database.DB.Where("id = ? AND role = ?", childID, model.RoleChild).First(&child).Error; err == nil {
			child.Balance += reward
			database.DB.Save(&child)
		}
	}

	return reward, nil
}
