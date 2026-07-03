package service

import (
	"errors"
	"fmt"
	"time"

	"growpocket/internal/database"
	"growpocket/internal/model"
)

type AchievementService struct{}

func (s *AchievementService) GetAchievements(childID uint) ([]model.UserAchievement, error) {
	var achievements []model.Achievement
	if err := database.DB.Find(&achievements).Error; err != nil {
		return nil, err
	}

	var userAchievements []model.UserAchievement
	for _, achievement := range achievements {
		var ua model.UserAchievement
		err := database.DB.Where("child_id = ? AND achievement_id = ?", childID, achievement.ID).First(&ua).Error
		if err != nil {
			ua = model.UserAchievement{
				ChildID:       childID,
				AchievementID: achievement.ID,
				Unlocked:      false,
				CurrentValue:  0,
			}
		}
		ua.Achievement = achievement
		userAchievements = append(userAchievements, ua)
	}

	return userAchievements, nil
}

func (s *AchievementService) CheckAndUnlock(childID uint) error {
	userAchievements, err := s.GetAchievements(childID)
	if err != nil {
		return err
	}

	for _, ua := range userAchievements {
		if ua.Unlocked {
			continue
		}

		currentValue, err := s.calculateCurrentValue(childID, ua.Achievement.Type)
		if err != nil {
			return err
		}

		ua.CurrentValue = currentValue

		if currentValue >= ua.Achievement.TargetValue {
			ua.Unlocked = true
			ua.UnlockedAt = time.Now()

			var existingUA model.UserAchievement
			err := database.DB.Where("child_id = ? AND achievement_id = ?", childID, ua.AchievementID).First(&existingUA).Error
			if err != nil {
				if err := database.DB.Create(&ua).Error; err != nil {
					return err
				}
			} else {
				if err := database.DB.Model(&existingUA).Updates(map[string]interface{}{
					"unlocked":      true,
					"unlocked_at":   ua.UnlockedAt,
					"current_value": currentValue,
				}).Error; err != nil {
					return err
				}
			}

			if err := s.addAchievementPoints(childID, ua.Achievement.Points, ua.Achievement.Name); err != nil {
				return err
			}
		} else {
			database.DB.Model(&model.UserAchievement{}).Where("child_id = ? AND achievement_id = ?", childID, ua.AchievementID).Update("current_value", currentValue)
		}
	}

	return nil
}

func (s *AchievementService) addAchievementPoints(childID uint, amount int, name string) error {
	var child model.User
	if err := database.DB.Where("id = ? AND role = ?", childID, "child").First(&child).Error; err != nil {
		return err
	}

	tx := database.DB.Begin()

	newBalance := child.Balance + amount
	transaction := model.Transaction{
		ChildID:      childID,
		Type:         0,
		Amount:       amount,
		Reason:       "成就奖励: " + name,
		BalanceAfter: newBalance,
	}
	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Model(&child).Update("balance", newBalance).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

func (s *AchievementService) calculateCurrentValue(childID uint, achievementType int) (int, error) {
	switch achievementType {
	case model.AchievementTypeFirstTask:
		var count int64
		err := database.DB.Model(&model.Task{}).Where("child_id = ? AND status = ?", childID, model.TaskStatusCompleted).Count(&count).Error
		return int(count), err
	case model.AchievementTypeConsecutiveDays:
		return s.getConsecutiveDays(childID)
	case model.AchievementTypeTotalPoints:
		var total int64
		err := database.DB.Model(&model.Transaction{}).Where("child_id = ? AND type = ?", childID, 0).Select("COALESCE(SUM(amount), 0)").Scan(&total).Error
		return int(total), err
	case model.AchievementTypeTaskCount:
		var count int64
		err := database.DB.Model(&model.Task{}).Where("child_id = ? AND status = ?", childID, model.TaskStatusCompleted).Count(&count).Error
		return int(count), err
	case model.AchievementTypeRedeemCount:
		var count int64
		err := database.DB.Model(&model.Redeem{}).Where("child_id = ?", childID).Count(&count).Error
		return int(count), err
	case model.AchievementTypeCharity:
		var count int64
		err := database.DB.Model(&model.CharityDonation{}).Where("child_id = ?", childID).Count(&count).Error
		return int(count), err
	default:
		return 0, nil
	}
}

func (s *AchievementService) getConsecutiveDays(childID uint) (int, error) {
	var tasks []model.Task
	err := database.DB.Where("child_id = ? AND status = ?", childID, model.TaskStatusCompleted).Order("updated_at DESC").Limit(31).Find(&tasks).Error
	if err != nil {
		return 0, err
	}

	if len(tasks) == 0 {
		return 0, nil
	}

	consecutive := 1
	lastDate := tasks[0].UpdatedAt.Format("2006-01-02")

	for i := 1; i < len(tasks); i++ {
		currentDate := tasks[i].UpdatedAt.Format("2006-01-02")
		lastTime, _ := time.Parse("2006-01-02", lastDate)
		currentTime, _ := time.Parse("2006-01-02", currentDate)
		diff := lastTime.Sub(currentTime).Hours() / 24

		if diff == 1 {
			consecutive++
			lastDate = currentDate
		} else if diff > 1 {
			break
		}
	}

	return consecutive, nil
}

func InitAchievements() error {
	achievements := []model.Achievement{
		{Name: "初露锋芒", Description: "完成第一个任务", Icon: "🌟", Type: model.AchievementTypeFirstTask, TargetValue: 1, Points: 100},
		{Name: "坚持3天", Description: "连续3天完成任务", Icon: "🔥", Type: model.AchievementTypeConsecutiveDays, TargetValue: 3, Points: 150},
		{Name: "坚持7天", Description: "连续7天完成任务", Icon: "💪", Type: model.AchievementTypeConsecutiveDays, TargetValue: 7, Points: 300},
		{Name: "坚持30天", Description: "连续30天完成任务", Icon: "💎", Type: model.AchievementTypeConsecutiveDays, TargetValue: 30, Points: 800},
		{Name: "小试牛刀", Description: "累计获得500积分", Icon: "🥈", Type: model.AchievementTypeTotalPoints, TargetValue: 500, Points: 200},
		{Name: "积分达人", Description: "累计获得1000积分", Icon: "🥇", Type: model.AchievementTypeTotalPoints, TargetValue: 1000, Points: 350},
		{Name: "富甲一方", Description: "累计获得5000积分", Icon: "👑", Type: model.AchievementTypeTotalPoints, TargetValue: 5000, Points: 1000},
		{Name: "勤劳小蜜蜂", Description: "完成10个任务", Icon: "🐝", Type: model.AchievementTypeTaskCount, TargetValue: 10, Points: 200},
		{Name: "任务达人", Description: "完成50个任务", Icon: "⭐", Type: model.AchievementTypeTaskCount, TargetValue: 50, Points: 500},
		{Name: "超级劳模", Description: "完成100个任务", Icon: "🏆", Type: model.AchievementTypeTaskCount, TargetValue: 100, Points: 1000},
		{Name: "精打细算", Description: "兑换5次奖品", Icon: "🎁", Type: model.AchievementTypeRedeemCount, TargetValue: 5, Points: 150},
		{Name: "公益小天使", Description: "参与1次公益活动", Icon: "❤️", Type: model.AchievementTypeCharity, TargetValue: 1, Points: 200},
	}

	for _, achievement := range achievements {
		var existing model.Achievement
		if err := database.DB.Where("name = ?", achievement.Name).First(&existing).Error; err != nil {
			if err := database.DB.Create(&achievement).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func (s *AchievementService) CreateAchievement(familyID uint, createdBy uint, name, description, icon, iconColor string, typeVal, targetValue, points int) (*model.Achievement, error) {
	if name == "" {
		return nil, errors.New("name不能为空")
	}
	if targetValue < 0 {
		return nil, fmt.Errorf("targetValue必须>=0")
	}
	if points < 0 {
		return nil, fmt.Errorf("points必须>=0")
	}

	achievement := &model.Achievement{
		FamilyID:    familyID,
		CreatedBy:   createdBy,
		Name:        name,
		Description: description,
		Icon:        icon,
		IconColor:   iconColor,
		Type:        typeVal,
		TargetValue: targetValue,
		Points:      points,
		IsCustom:    true,
	}

	if err := database.DB.Create(achievement).Error; err != nil {
		return nil, err
	}

	return achievement, nil
}

func (s *AchievementService) UpdateAchievement(id uint, familyID uint, name, description, icon, iconColor *string, typeVal, targetValue, points *int) (*model.Achievement, error) {
	var achievement model.Achievement
	if err := database.DB.First(&achievement, id).Error; err != nil {
		return nil, err
	}

	if !achievement.IsCustom {
		return nil, errors.New("只能更新自定义勋章")
	}
	if achievement.FamilyID != familyID {
		return nil, errors.New("无权修改该勋章")
	}

	updates := make(map[string]interface{})
	if name != nil {
		updates["name"] = *name
	}
	if description != nil {
		updates["description"] = *description
	}
	if icon != nil {
		updates["icon"] = *icon
	}
	if iconColor != nil {
		updates["icon_color"] = *iconColor
	}
	if typeVal != nil {
		updates["type"] = *typeVal
	}
	if targetValue != nil {
		if *targetValue < 0 {
			return nil, fmt.Errorf("targetValue必须>=0")
		}
		updates["target_value"] = *targetValue
	}
	if points != nil {
		if *points < 0 {
			return nil, fmt.Errorf("points必须>=0")
		}
		updates["points"] = *points
	}

	if len(updates) == 0 {
		return &achievement, nil
	}

	if err := database.DB.Model(&achievement).Updates(updates).Error; err != nil {
		return nil, err
	}

	return &achievement, nil
}

func (s *AchievementService) DeleteAchievement(id uint, familyID uint) error {
	var achievement model.Achievement
	if err := database.DB.First(&achievement, id).Error; err != nil {
		return err
	}

	if !achievement.IsCustom {
		return errors.New("只能删除自定义勋章")
	}
	if achievement.FamilyID != familyID {
		return errors.New("无权删除该勋章")
	}

	tx := database.DB.Begin()

	if err := tx.Where("achievement_id = ?", id).Delete(&model.UserAchievement{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	if err := tx.Delete(&achievement).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

func (s *AchievementService) ListAchievements(familyID uint) ([]model.Achievement, error) {
	var achievements []model.Achievement
	if err := database.DB.Where("family_id = 0 OR family_id = ?", familyID).Find(&achievements).Error; err != nil {
		return nil, err
	}
	return achievements, nil
}

func (s *AchievementService) GetAchievement(id uint, familyID uint) (*model.Achievement, error) {
	var achievement model.Achievement
	if err := database.DB.First(&achievement, id).Error; err != nil {
		return nil, err
	}

	if achievement.IsCustom && achievement.FamilyID != familyID {
		return nil, errors.New("无权查看该勋章")
	}

	return &achievement, nil
}
