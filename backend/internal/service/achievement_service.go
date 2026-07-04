package service

import (
	"errors"
	"fmt"
	"time"

	"growpocket/internal/database"
	"growpocket/internal/model"
)

type AchievementService struct{}

func (s *AchievementService) GetUserAchievements(childID, familyID uint) ([]model.UserAchievement, error) {
	var achievements []model.Achievement
	if err := database.DB.Where("family_id = 0 OR family_id = ?", familyID).Find(&achievements).Error; err != nil {
		return nil, err
	}

	var userAchievements []model.UserAchievement
	for _, achievement := range achievements {
		var ua model.UserAchievement
		err := database.DB.Where("child_id = ? AND achievement_id = ?", childID, achievement.ID).First(&ua).Error
		if err != nil {
			counterValue, _ := s.GetCounterValue(childID, achievement.CounterType, achievement.TemplateID)
			ua = model.UserAchievement{
				ChildID:       childID,
				AchievementID: achievement.ID,
				AwardCount:    0,
				CurrentValue:  counterValue,
			}
		} else {
			counterValue, _ := s.GetCounterValue(childID, achievement.CounterType, achievement.TemplateID)
			ua.CurrentValue = counterValue
		}
		ua.Achievement = achievement
		userAchievements = append(userAchievements, ua)
	}

	return userAchievements, nil
}

func (s *AchievementService) CheckAndUnlock(childID, familyID uint) error {
	var achievements []model.Achievement
	if err := database.DB.Where("family_id = 0 OR family_id = ?", familyID).Find(&achievements).Error; err != nil {
		return err
	}

	for _, achievement := range achievements {
		counterValue, err := s.GetCounterValue(childID, achievement.CounterType, achievement.TemplateID)
		if err != nil {
			return err
		}

		if counterValue >= achievement.CounterTarget {
			_, err := s.AwardAchievement(childID, achievement.ID)
			if err != nil {
				return err
			}

			s.ResetCounter(childID, achievement.CounterType, achievement.TemplateID)
		}
	}

	return nil
}

func (s *AchievementService) IncrementCounter(childID uint, counterType int, templateID uint, delta int) (int, error) {
	var counter model.UserCounter
	err := database.DB.Where("child_id = ? AND counter_type = ? AND template_id = ?", childID, counterType, templateID).First(&counter).Error

	if counterType == model.CounterTypeConsecutiveDays {
		today := time.Now().Format("2006-01-02")
		if err != nil {
			counter = model.UserCounter{
				ChildID:       childID,
				CounterType:   counterType,
				TemplateID:    templateID,
				CurrentValue:  1,
				LastDate:      today,
			}
			if err := database.DB.Create(&counter).Error; err != nil {
				return 0, err
			}
			return 1, nil
		}

		if counter.LastDate == today {
			return counter.CurrentValue, nil
		}

		lastTime, _ := time.Parse("2006-01-02", counter.LastDate)
		todayTime, _ := time.Parse("2006-01-02", today)
		diff := todayTime.Sub(lastTime).Hours() / 24

		if diff == 1 {
			counter.CurrentValue += 1
			counter.LastDate = today
		} else {
			counter.CurrentValue = 1
			counter.LastDate = today
		}

		if err := database.DB.Save(&counter).Error; err != nil {
			return 0, err
		}
		return counter.CurrentValue, nil
	}

	if err != nil {
		counter = model.UserCounter{
			ChildID:       childID,
			CounterType:   counterType,
			TemplateID:    templateID,
			CurrentValue:  delta,
		}
		if err := database.DB.Create(&counter).Error; err != nil {
			return 0, err
		}
		return delta, nil
	}

	counter.CurrentValue += delta
	if err := database.DB.Save(&counter).Error; err != nil {
		return 0, err
	}

	return counter.CurrentValue, nil
}

func (s *AchievementService) ResetCounter(childID uint, counterType int, templateID uint) error {
	return database.DB.Model(&model.UserCounter{}).
		Where("child_id = ? AND counter_type = ? AND template_id = ?", childID, counterType, templateID).
		Update("current_value", 0).Error
}

func (s *AchievementService) GetCounterValue(childID uint, counterType int, templateID uint) (int, error) {
	var counter model.UserCounter
	err := database.DB.Where("child_id = ? AND counter_type = ? AND template_id = ?", childID, counterType, templateID).First(&counter).Error
	if err != nil {
		return 0, nil
	}

	if counterType == model.CounterTypeConsecutiveDays {
		today := time.Now().Format("2006-01-02")
		if counter.LastDate != today {
			lastTime, _ := time.Parse("2006-01-02", counter.LastDate)
			todayTime, _ := time.Parse("2006-01-02", today)
			diff := todayTime.Sub(lastTime).Hours() / 24
			if diff > 1 {
				return 0, nil
			}
		}
	}

	return counter.CurrentValue, nil
}

func (s *AchievementService) CheckAchievements(childID uint, counterType int, templateID uint) ([]model.AchievementAward, error) {
	var achievements []model.Achievement
	query := database.DB.Where("counter_type = ? AND family_id = 0", counterType)
	if counterType == model.CounterTypeTemplateTaskCount {
		query = query.Where("template_id = ?", templateID)
	}
	if err := query.Find(&achievements).Error; err != nil {
		return nil, err
	}

	var awards []model.AchievementAward
	counterValue, err := s.GetCounterValue(childID, counterType, templateID)
	if err != nil {
		return nil, err
	}

	for _, achievement := range achievements {
		if counterValue >= achievement.CounterTarget {
			award, err := s.AwardAchievement(childID, achievement.ID)
			if err != nil {
				return nil, err
			}
			awards = append(awards, *award)

			s.ResetCounter(childID, counterType, templateID)
			counterValue, _ = s.GetCounterValue(childID, counterType, templateID)
		}
	}

	return awards, nil
}

func (s *AchievementService) AwardAchievement(childID uint, achievementID uint) (*model.AchievementAward, error) {
	var achievement model.Achievement
	if err := database.DB.First(&achievement, achievementID).Error; err != nil {
		return nil, errors.New("成就不存在")
	}

	award := model.AchievementAward{
		ChildID:       childID,
		AchievementID: achievementID,
		AwardedAt:     time.Now(),
		Points:        achievement.Points,
	}

	if err := database.DB.Create(&award).Error; err != nil {
		return nil, err
	}

	if err := s.addAchievementPoints(childID, achievement.Points, achievement.Name); err != nil {
		return nil, err
	}

	var ua model.UserAchievement
	err := database.DB.Where("child_id = ? AND achievement_id = ?", childID, achievementID).First(&ua).Error
	if err != nil {
		ua = model.UserAchievement{
			ChildID:       childID,
			AchievementID: achievementID,
			AwardCount:    1,
			CurrentValue:  0,
		}
		if err := database.DB.Create(&ua).Error; err != nil {
			return nil, err
		}
	} else {
		ua.AwardCount += 1
		ua.CurrentValue = 0
		if err := database.DB.Save(&ua).Error; err != nil {
			return nil, err
		}
	}

	award.Achievement = achievement
	return &award, nil
}

func (s *AchievementService) GetAchievementAwards(childID uint, achievementID uint) ([]model.AchievementAward, error) {
	var awards []model.AchievementAward
	query := database.DB.Where("child_id = ?", childID)
	if achievementID > 0 {
		query = query.Where("achievement_id = ?", achievementID)
	}
	if err := query.Preload("Achievement").Order("awarded_at DESC").Find(&awards).Error; err != nil {
		return nil, err
	}
	return awards, nil
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
		Type:         model.TransactionTypeIncome,
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

func InitAchievements() error {
	achievements := []model.Achievement{
		{Name: "初露锋芒", Description: "完成第一个任务", Icon: "🌟", CounterType: model.CounterTypeTaskCount, CounterTarget: 1, Points: 100},
		{Name: "坚持3天", Description: "连续3天完成任务", Icon: "🔥", CounterType: model.CounterTypeConsecutiveDays, CounterTarget: 3, Points: 150},
		{Name: "坚持7天", Description: "连续7天完成任务", Icon: "💪", CounterType: model.CounterTypeConsecutiveDays, CounterTarget: 7, Points: 300},
		{Name: "坚持30天", Description: "连续30天完成任务", Icon: "💎", CounterType: model.CounterTypeConsecutiveDays, CounterTarget: 30, Points: 800},
		{Name: "小试牛刀", Description: "累计获得500积分", Icon: "🥈", CounterType: model.CounterTypeTotalPoints, CounterTarget: 500, Points: 200},
		{Name: "积分达人", Description: "累计获得1000积分", Icon: "🥇", CounterType: model.CounterTypeTotalPoints, CounterTarget: 1000, Points: 350},
		{Name: "富甲一方", Description: "累计获得5000积分", Icon: "👑", CounterType: model.CounterTypeTotalPoints, CounterTarget: 5000, Points: 1000},
		{Name: "勤劳小蜜蜂", Description: "完成10个任务", Icon: "🐝", CounterType: model.CounterTypeTaskCount, CounterTarget: 10, Points: 200},
		{Name: "任务达人", Description: "完成50个任务", Icon: "⭐", CounterType: model.CounterTypeTaskCount, CounterTarget: 50, Points: 500},
		{Name: "超级劳模", Description: "完成100个任务", Icon: "🏆", CounterType: model.CounterTypeTaskCount, CounterTarget: 100, Points: 1000},
		{Name: "精打细算", Description: "兑换5次奖品", Icon: "🎁", CounterType: model.CounterTypeRedeemCount, CounterTarget: 5, Points: 150},
		{Name: "公益小天使", Description: "参与1次公益活动", Icon: "❤️", CounterType: model.CounterTypeCharity, CounterTarget: 1, Points: 200},
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

func (s *AchievementService) CreateAchievement(familyID uint, createdBy uint, name, description, icon, iconColor string, counterType, counterTarget, templateID, points int) (*model.Achievement, error) {
	if name == "" {
		return nil, errors.New("name不能为空")
	}
	if counterTarget < 0 {
		return nil, fmt.Errorf("counterTarget必须>=0")
	}
	if points < 0 {
		return nil, fmt.Errorf("points必须>=0")
	}

	achievement := &model.Achievement{
		FamilyID:      familyID,
		CreatedBy:     createdBy,
		Name:          name,
		Description:   description,
		Icon:          icon,
		IconColor:     iconColor,
		CounterType:   counterType,
		CounterTarget: counterTarget,
		TemplateID:    uint(templateID),
		Points:        points,
		IsCustom:      true,
	}

	if err := database.DB.Create(achievement).Error; err != nil {
		return nil, err
	}

	return achievement, nil
}

func (s *AchievementService) UpdateAchievement(id uint, familyID uint, name, description, icon, iconColor *string, counterType, counterTarget, templateID, points *int) (*model.Achievement, error) {
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
	if counterType != nil {
		updates["counter_type"] = *counterType
	}
	if counterTarget != nil {
		if *counterTarget < 0 {
			return nil, fmt.Errorf("counterTarget必须>=0")
		}
		updates["counter_target"] = *counterTarget
	}
	if templateID != nil {
		updates["template_id"] = *templateID
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

	if err := tx.Where("achievement_id = ?", id).Delete(&model.AchievementAward{}).Error; err != nil {
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
