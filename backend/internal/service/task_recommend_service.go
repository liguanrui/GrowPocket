package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

type TaskRecommendService struct{}

func NewTaskRecommendService() *TaskRecommendService {
	return &TaskRecommendService{}
}

type RecommendTask struct {
	model.TaskTemplate
	Reason      string  `json:"reason"`
	Score       float64 `json:"score"`
	AgeMatch    bool    `json:"age_match"`
}

func (s *TaskRecommendService) CalculateChildAge(birthday *time.Time) int {
	if birthday == nil {
		return 6
	}
	now := time.Now()
	age := now.Year() - birthday.Year()
	if now.Month() < birthday.Month() || (now.Month() == birthday.Month() && now.Day() < birthday.Day()) {
		age--
	}
	if age < 3 {
		age = 3
	}
	if age > 12 {
		age = 12
	}
	return age
}

func (s *TaskRecommendService) GetRecentTaskHistory(childID, familyID uint, days int) ([]model.Task, error) {
	var tasks []model.Task
	cutoff := time.Now().AddDate(0, 0, -days)
	err := database.DB.Where("child_id = ? AND family_id = ? AND created_at >= ?", childID, familyID, cutoff).
		Order("created_at DESC").
		Find(&tasks).Error
	return tasks, err
}

func (s *TaskRecommendService) GetCategoryStats(tasks []model.Task) map[string]int {
	stats := make(map[string]int)
	for _, t := range tasks {
		cat := t.Category
		if cat == "" && t.TemplateID > 0 {
			cat = "other"
		}
		if t.Status == model.TaskStatusCompleted {
			stats[cat]++
		}
	}
	return stats
}

func (s *TaskRecommendService) GetSuccessRate(tasks []model.Task) float64 {
	if len(tasks) == 0 {
		return 0.5
	}
	completed := 0
	for _, t := range tasks {
		if t.Status == model.TaskStatusCompleted {
			completed++
		}
	}
	return float64(completed) / float64(len(tasks))
}

func (s *TaskRecommendService) GetDaysSinceLastDone(tasks []model.Task, templateID uint) int {
	if templateID == 0 {
		return 7
	}
	now := time.Now()
	for _, t := range tasks {
		if t.TemplateID == templateID {
			diff := now.Sub(t.CreatedAt).Hours() / 24
			return int(diff)
		}
	}
	return 7
}

func (s *TaskRecommendService) GetRecommendedTasks(childID, familyID uint, birthday *time.Time, count int) ([]RecommendTask, error) {
	if count <= 0 {
		count = 5
	}

	age := s.CalculateChildAge(birthday)

	var templates []model.TaskTemplate
	err := database.DB.Where("family_id = ? AND is_active = ?", familyID, true).
		Order("sort_order ASC, created_at ASC").
		Find(&templates).Error
	if err != nil {
		return nil, errors.New("查询任务模板失败")
	}

	history, _ := s.GetRecentTaskHistory(childID, familyID, 30)
	categoryStats := s.GetCategoryStats(history)
	successRate := s.GetSuccessRate(history)

	var candidates []RecommendTask
	for _, t := range templates {
		ageMatch := age >= t.MinAge && age <= t.MaxAge
		if !ageMatch && t.MinAge != 0 && t.MaxAge != 0 {
			continue
		}

		score := float64(t.Points) * 0.1
		score += float64(t.SortOrder) * (-0.5)

		if ageMatch {
			score += 20
		}

		if t.Frequency == "daily" {
			score += 10
		} else if t.Frequency == "weekly" {
			score += 5
		}

		catCount := categoryStats[t.Category]
		if catCount < 2 {
			score += float64((2 - catCount)) * 5
		} else if catCount > 5 {
			score -= float64((catCount - 5)) * 3
		}

		if t.Difficulty == "easy" {
			score += 5
		} else if t.Difficulty == "hard" {
			if successRate > 0.7 {
				score += 10
			} else if successRate < 0.4 {
				score -= 15
			}
		}

		daysSince := s.GetDaysSinceLastDone(history, t.ID)
		if daysSince < 2 {
			score -= 20
		} else if daysSince > 7 {
			score += 8
		}

		reason := s.GenerateReason(t, age, successRate)

		candidates = append(candidates, RecommendTask{
			TaskTemplate: t,
			Reason:       reason,
			Score:        score,
			AgeMatch:     ageMatch,
		})
	}

	for i := 0; i < len(candidates); i++ {
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].Score > candidates[i].Score {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}

	candidates = s.DiversifyByCategory(candidates, count)

	return candidates, nil
}

func (s *TaskRecommendService) GenerateReason(t model.TaskTemplate, age int, successRate float64) string {
	parts := []string{}

	if age >= t.MinAge && age <= t.MaxAge {
		if t.MinAge == t.MaxAge {
			parts = append(parts, "适合"+string(rune(t.MinAge+'0'))+"岁")
		} else {
			parts = append(parts, "适合"+string(rune(t.MinAge+'0'))+"-"+string(rune(t.MaxAge+'0'))+"岁")
		}
	}

	if t.Frequency == "daily" {
		parts = append(parts, "每日推荐")
	} else if t.Frequency == "weekly" {
		parts = append(parts, "每周任务")
	}

	if successRate > 0.7 && t.Difficulty == "hard" {
		parts = append(parts, "挑战自我")
	} else if successRate < 0.4 && t.Difficulty == "easy" {
		parts = append(parts, "轻松完成")
	}

	switch t.Difficulty {
	case "easy":
		parts = append(parts, "简单")
	case "medium":
		parts = append(parts, "适中")
	case "hard":
		parts = append(parts, "困难")
	}

	if len(parts) == 0 {
		return "推荐任务"
	}

	return parts[0]
}

func (s *TaskRecommendService) DiversifyByCategory(candidates []RecommendTask, count int) []RecommendTask {
	if len(candidates) <= count {
		return candidates
	}

	selected := make([]RecommendTask, 0, count)
	categoryCount := make(map[string]int)
	maxPerCategory := (count + 1) / 2

	for _, c := range candidates {
		if len(selected) >= count {
			break
		}

		cat := c.Category
		if cat == "" {
			cat = "other"
		}

		if categoryCount[cat] >= maxPerCategory {
			continue
		}

		selected = append(selected, c)
		categoryCount[cat]++
	}

	if len(selected) < count {
		for _, c := range candidates {
			if len(selected) >= count {
				break
			}
			isSelected := false
			for _, s := range selected {
				if s.ID == c.ID {
					isSelected = true
					break
				}
			}
			if !isSelected {
				selected = append(selected, c)
			}
		}
	}

	return selected
}
