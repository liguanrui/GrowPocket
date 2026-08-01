package service

import (
	"encoding/json"
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
)

type AbilityService struct{}

func NewAbilityService() *AbilityService {
	return &AbilityService{}
}

// ListDimensions 查询所有能力维度
func (s *AbilityService) ListDimensions() ([]model.AbilityDimension, error) {
	var dims []model.AbilityDimension
	err := database.DB.Order("sort_order ASC").Find(&dims).Error
	return dims, err
}

// GetChildScores 查询儿童的能力维度得分
func (s *AbilityService) GetChildScores(childID, familyID uint) ([]model.ChildAbilityScore, error) {
	var scores []model.ChildAbilityScore
	err := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID).Find(&scores).Error
	return scores, err
}

// GetGrowthIndex 查询儿童成长指数（六维平均分）
func (s *AbilityService) GetGrowthIndex(childID, familyID uint) (int, error) {
	scores, err := s.GetChildScores(childID, familyID)
	if err != nil {
		return 0, err
	}
	if len(scores) == 0 {
		return 0, nil
	}
	// 如果不足 6 个维度，按 0 分补齐
	var dimCount int64
	if err := database.DB.Model(&model.AbilityDimension{}).Count(&dimCount).Error; err != nil {
		return 0, err
	}
	totalDim := int(dimCount)
	if totalDim == 0 {
		return 0, nil
	}
	sum := 0
	for _, sc := range scores {
		sum += sc.Score
	}
	// 未记录的维度按 0 分计入平均
	missing := totalDim - len(scores)
	sum += missing * 0
	return sum / totalDim, nil
}

// AwardTaskCompletion 任务完成后累加能力维度分值
// 主维度按难度权重：easy=1, medium=2, hard=3
// 次维度权重 × 0.5（向下取整）
func (s *AbilityService) AwardTaskCompletion(task *model.Task) error {
	if task.AbilityDimensionID == 0 {
		return nil // 未关联维度，跳过
	}

	// 计算主维度加分
	primaryDelta := difficultyWeight(task.Difficulty)
	if primaryDelta == 0 {
		primaryDelta = 2 // 默认 medium
	}

	// 解析次维度
	var secondaryIDs []uint
	if task.SecondaryDimensions != "" {
		if err := json.Unmarshal([]byte(task.SecondaryDimensions), &secondaryIDs); err != nil {
			log.Printf("[Ability] 解析次维度失败 task=%d: %v", task.ID, err)
		}
	}
	secondaryDelta := primaryDelta / 2 // 次维度 × 0.5，向下取整

	// 累加主维度
	if err := s.addScore(task.ChildID, task.FamilyID, task.AbilityDimensionID, primaryDelta); err != nil {
		return err
	}

	// 累加次维度
	for _, dimID := range secondaryIDs {
		if err := s.addScore(task.ChildID, task.FamilyID, dimID, secondaryDelta); err != nil {
			log.Printf("[Ability] 累加次维度失败 child=%d dim=%d: %v", task.ChildID, dimID, err)
		}
	}

	// 触发能力徽章检查
	s.checkAbilityBadge(task.ChildID, task.FamilyID, task.AbilityDimensionID)
	for _, dimID := range secondaryIDs {
		s.checkAbilityBadge(task.ChildID, task.FamilyID, dimID)
	}

	return nil
}

// AddScoreForDimension 公开方法，供问卷服务调用累加维度分值
func (s *AbilityService) AddScoreForDimension(childID, familyID, dimensionID uint, delta int) error {
	return s.addScore(childID, familyID, dimensionID, delta)
}

// addScore 累加维度分值（上限 100）
func (s *AbilityService) addScore(childID, familyID, dimensionID uint, delta int) error {
	if delta <= 0 {
		return nil
	}
	var score model.ChildAbilityScore
	err := database.DB.Where("child_id = ? AND dimension_id = ?", childID, dimensionID).First(&score).Error
	if err != nil {
		// 不存在，创建
		score = model.ChildAbilityScore{
			FamilyID:    familyID,
			ChildID:     childID,
			DimensionID: dimensionID,
			Score:       delta,
		}
		if score.Score > 100 {
			score.Score = 100
		}
		return database.DB.Create(&score).Error
	}
	// 已存在，累加
	score.Score += delta
	if score.Score > 100 {
		score.Score = 100
	}
	return database.DB.Save(&score).Error
}

// checkAbilityBadge 能力徽章触发（维度分值首次达 30/60/90 触发铜/银/金）
// 注意：勋章系统已下线，这里仅记录日志，不实际创建徽章
func (s *AbilityService) checkAbilityBadge(childID, familyID, dimensionID uint) {
	var score model.ChildAbilityScore
	if err := database.DB.Where("child_id = ? AND dimension_id = ?", childID, dimensionID).First(&score).Error; err != nil {
		return
	}
	if score.Score >= 90 {
		log.Printf("[Ability] 金徽章 child=%d dim=%d", childID, dimensionID)
	} else if score.Score >= 60 {
		log.Printf("[Ability] 银徽章 child=%d dim=%d", childID, dimensionID)
	} else if score.Score >= 30 {
		log.Printf("[Ability] 铜徽章 child=%d dim=%d", childID, dimensionID)
	}
}

// difficultyWeight 难度对应权重
func difficultyWeight(difficulty string) int {
	switch difficulty {
	case "easy":
		return 1
	case "medium":
		return 2
	case "hard":
		return 3
	default:
		return 2
	}
}

// GetDimensionByID 根据ID查询维度
func (s *AbilityService) GetDimensionByID(id uint) (*model.AbilityDimension, error) {
	var dim model.AbilityDimension
	if err := database.DB.First(&dim, id).Error; err != nil {
		return nil, errors.New("能力维度不存在")
	}
	return &dim, nil
}
