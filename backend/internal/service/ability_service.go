package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"strings"
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

// AbilityDelta 单个维度的能力变化记录（阶段回顾时生成）
type AbilityDelta struct {
	DimensionID   uint   `json:"dimension_id"`
	DimensionName string `json:"dimension_name"`
	OldScore      int    `json:"old_score"`
	NewScore      int    `json:"new_score"`
	Delta         int    `json:"delta"`
	TargetScore   int    `json:"target_score"` // 阶段目标分（0 表示未设置目标）
}

// ReassessScores 阶段回顾时由 AI 重新评定六维能力得分
// 基于周期内完成的任务情况，AI 给出各维度 0-100 的评定分值
// 返回各维度的新旧得分对比
func (s *AbilityService) ReassessScores(aiService *AIService, childID, familyID uint, tasks []model.Task, dimensions []model.AbilityDimension) ([]AbilityDelta, error) {
	if len(dimensions) == 0 {
		return nil, errors.New("无能力维度数据")
	}

	// 1. 读取当前能力得分作为基线
	oldScores, _ := s.GetChildScores(childID, familyID)
	oldScoreMap := make(map[uint]int)
	for _, sc := range oldScores {
		oldScoreMap[sc.DimensionID] = sc.Score
	}

	// 2. 按维度分组统计周期内任务
	dimStats := make(map[uint]map[string]int) // dimID -> {count, easy, medium, hard}
	for _, t := range tasks {
		if t.AbilityDimensionID == 0 {
			continue
		}
		if dimStats[t.AbilityDimensionID] == nil {
			dimStats[t.AbilityDimensionID] = map[string]int{"count": 0, "easy": 0, "medium": 0, "hard": 0}
		}
		dimStats[t.AbilityDimensionID]["count"]++
		diff := t.Difficulty
		if diff == "" {
			diff = "medium"
		}
		dimStats[t.AbilityDimensionID][diff]++
	}

	// 3. 构造 AI 评定 prompt
	var parts []string
	parts = append(parts, "你是儿童能力评估专家。请基于以下周期内任务完成情况，重新评定儿童各能力维度的得分（0-100 分）。")
	parts = append(parts, fmt.Sprintf("周期内共完成 %d 项任务。", len(tasks)))
	parts = append(parts, "各维度任务统计：")
	for _, d := range dimensions {
		stats := dimStats[d.ID]
		old := oldScoreMap[d.ID]
		parts = append(parts, fmt.Sprintf("- 维度 %s（ID=%d）：当前基线 %d 分，周期内完成 %d 项任务（easy=%d, medium=%d, hard=%d）",
			d.Name, d.ID, old, stats["count"], stats["easy"], stats["medium"], stats["hard"]))
	}
	parts = append(parts, "评定规则：")
	parts = append(parts, "- 基于任务完成数量和难度，适度提升对应维度得分")
	parts = append(parts, "- 未完成任务的维度保持基线或微调")
	parts = append(parts, "- 总体分值不超过 100")
	parts = append(parts, "- 评定应体现成长，但避免虚高")
	parts = append(parts, "返回纯 JSON（不要 markdown 代码块），格式：{\"1\": 35, \"2\": 28, ...}（key 为 dimension_id，value 为新得分）")

	// 4. 调用 AI
	reply, err := aiService.Chat(strings.Join(parts, "\n"), nil, "请评定能力维度得分")
	if err != nil {
		log.Printf("[Ability] AI 评定调用失败 child=%d: %v", childID, err)
		// AI 调用失败时，保留原得分不变更
		return s.buildDeltas(oldScoreMap, oldScoreMap, dimensions), nil
	}

	// 5. 解析 AI 返回
	reply = cleanAbilityJSONResponse(reply)
	newScoreMap := make(map[uint]int)
	if strings.HasPrefix(reply, "{") {
		var rawMap map[string]int
		if err := json.Unmarshal([]byte(reply), &rawMap); err == nil {
			for k, v := range rawMap {
				var dimID uint
				if _, err := fmt.Sscanf(k, "%d", &dimID); err == nil && v >= 0 {
					if v > 100 {
						v = 100
					}
					newScoreMap[dimID] = v
				}
			}
		}
	}

	// 6. AI 未给出评定时，保留原得分
	if len(newScoreMap) == 0 {
		log.Printf("[Ability] AI 评定返回为空，保留原得分 child=%d", childID)
		return s.buildDeltas(oldScoreMap, oldScoreMap, dimensions), nil
	}

	// 7. 覆盖写入 ChildAbilityScore
	for _, d := range dimensions {
		newScore, ok := newScoreMap[d.ID]
		if !ok {
			newScore = oldScoreMap[d.ID] // AI 未评定则保留原值
		}
		if err := s.setScore(childID, familyID, d.ID, newScore); err != nil {
			log.Printf("[Ability] 更新能力得分失败 child=%d dim=%d: %v", childID, d.ID, err)
		}
	}

	return s.buildDeltas(oldScoreMap, newScoreMap, dimensions), nil
}

// buildDeltas 构造新旧得分对比
func (s *AbilityService) buildDeltas(oldMap, newMap map[uint]int, dims []model.AbilityDimension) []AbilityDelta {
	deltas := make([]AbilityDelta, 0, len(dims))
	for _, d := range dims {
		old := oldMap[d.ID]
		new := newMap[d.ID]
		if new == 0 && old == 0 {
			// 都为 0 时，若 newMap 没有该 key 则保留 old
			if _, ok := newMap[d.ID]; !ok {
				new = old
			}
		}
		deltas = append(deltas, AbilityDelta{
			DimensionID:   d.ID,
			DimensionName: d.Name,
			OldScore:      old,
			NewScore:      new,
			Delta:         new - old,
		})
	}
	return deltas
}

// setScore 覆盖写入维度得分（非累加）
func (s *AbilityService) setScore(childID, familyID, dimensionID uint, score int) error {
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}
	var record model.ChildAbilityScore
	err := database.DB.Where("child_id = ? AND dimension_id = ?", childID, dimensionID).First(&record).Error
	if err != nil {
		// 不存在，创建
		record = model.ChildAbilityScore{
			FamilyID:    familyID,
			ChildID:     childID,
			DimensionID: dimensionID,
			Score:       score,
		}
		return database.DB.Create(&record).Error
	}
	record.Score = score
	return database.DB.Save(&record).Error
}

// cleanAbilityJSONResponse 清理 AI 返回中的 markdown 代码块标记
func cleanAbilityJSONResponse(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}
