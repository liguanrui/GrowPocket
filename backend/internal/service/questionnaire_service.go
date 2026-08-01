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

// GetByStage 按阶段获取问卷
func (s *QuestionnaireService) GetByStage(stage string) (*model.Questionnaire, error) {
	var q model.Questionnaire
	if err := database.DB.Where("stage = ?", stage).Order("created_at DESC").First(&q).Error; err != nil {
		return nil, errors.New("问卷不存在")
	}
	return &q, nil
}

// SubmitAnswers 提交答案，计算维度分值，发放积分奖励
func (s *QuestionnaireService) SubmitAnswers(familyID, childID uint, questionnaireID uint, stage string, answers []AnswerInput) (int, error) {
	// 查问卷
	var q model.Questionnaire
	if err := database.DB.First(&q, questionnaireID).Error; err != nil {
		return 0, errors.New("问卷不存在")
	}

	// 计算每维度得分
	dimScores := map[uint]int{}
	for _, ans := range answers {
		dimScores[ans.DimensionID] += ans.Score
	}

	// 累加到能力维度
	for dimID, score := range dimScores {
		if err := s.ability.AddScoreForDimension(childID, familyID, dimID, score); err != nil {
			log.Printf("[Questionnaire] 累加维度分值失败 child=%d dim=%d: %v", childID, dimID, err)
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

	// 发放积分奖励：register=50, weekly=20, review=30
	reward := 20
	switch stage {
	case "register":
		reward = 50
	case "review":
		reward = 30
	}

	// 直接加到儿童余额
	var child model.User
	if err := database.DB.Where("id = ? AND role = ?", childID, model.RoleChild).First(&child).Error; err == nil {
		child.Balance += reward
		database.DB.Save(&child)
	}

	return reward, nil
}
