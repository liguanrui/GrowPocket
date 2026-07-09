package service

import (
	"errors"
	"fmt"
	"log"
	"time"

	"growpocket/internal/database"
	"growpocket/internal/model"

	"gorm.io/gorm"
)

type AchievementService struct{}

func (s *AchievementService) GetUserAchievements(childID, familyID uint) ([]model.UserAchievement, error) {
	var achievements []model.Achievement
	if err := database.DB.Where("family_id = 0 OR family_id = ?", familyID).
		Order("counter_type ASC, counter_target ASC").Find(&achievements).Error; err != nil {
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
				Unlocked:      false,
			}
		} else {
			counterValue, _ := s.GetCounterValue(childID, achievement.CounterType, achievement.TemplateID)
			ua.CurrentValue = counterValue
			ua.Unlocked = ua.AwardCount > 0
		}
		ua.Achievement = achievement
		userAchievements = append(userAchievements, ua)
	}

	return userAchievements, nil
}

func (s *AchievementService) CheckAndUnlock(childID, familyID uint) error {
	var achievements []model.Achievement
	if err := database.DB.Where("family_id = 0 OR family_id = ?", familyID).
		Order("counter_type ASC, counter_target ASC").Find(&achievements).Error; err != nil {
		return err
	}

	for _, achievement := range achievements {
		counterValue, err := s.GetCounterValue(childID, achievement.CounterType, achievement.TemplateID)
		if err != nil {
			return err
		}
		if counterValue < achievement.CounterTarget {
			continue
		}

		var existingUA model.UserAchievement
		if err := database.DB.Where("child_id = ? AND achievement_id = ?", childID, achievement.ID).First(&existingUA).Error; err == nil {
			if !isRepeatableAchievement(&achievement) && existingUA.AwardCount > 0 {
				continue
			}
		}

		if _, err := s.AwardAchievement(childID, achievement.ID); err != nil {
			return err
		}
		if isRepeatableAchievement(&achievement) {
			s.ResetCounter(childID, achievement.CounterType, achievement.TemplateID)
		}
	}

	return nil
}

func (s *AchievementService) IncrementCounter(childID uint, counterType int, templateID uint, delta int) (int, error) {
	if counterType == model.CounterTypeConsecutiveDays {
		return s.incrementConsecutiveDays(childID, delta)
	}
	return s.incrementSimpleCounter(childID, counterType, templateID, delta)
}

func (s *AchievementService) incrementSimpleCounter(childID uint, counterType int, templateID uint, delta int) (int, error) {
	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var counter model.UserCounter
	err := tx.Where("child_id = ? AND counter_type = ? AND template_id = ?", childID, counterType, templateID).First(&counter).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			counter = model.UserCounter{
				ChildID:      childID,
				CounterType:  counterType,
				TemplateID:   templateID,
				CurrentValue: delta,
			}
			if err := tx.Create(&counter).Error; err != nil {
				tx.Rollback()
				return 0, err
			}
			if err := tx.Commit().Error; err != nil {
				return 0, err
			}
			return delta, nil
		}
		tx.Rollback()
		return 0, err
	}

	counter.CurrentValue += delta
	if err := tx.Save(&counter).Error; err != nil {
		tx.Rollback()
		return 0, err
	}

	if err := tx.Commit().Error; err != nil {
		return 0, err
	}

	return counter.CurrentValue, nil
}

func (s *AchievementService) incrementConsecutiveDays(childID uint, delta int) (int, error) {
	today := time.Now().Format("2006-01-02")

	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var counter model.UserCounter
	err := tx.Where("child_id = ? AND counter_type = ? AND template_id = ?", childID, model.CounterTypeConsecutiveDays, 0).First(&counter).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			tx.Rollback()
			return 0, err
		}
		counter = model.UserCounter{
			ChildID:      childID,
			CounterType:  model.CounterTypeConsecutiveDays,
			TemplateID:   0,
			CurrentValue: 1,
			LastDate:     today,
		}
		if err := tx.Create(&counter).Error; err != nil {
			tx.Rollback()
			return 0, err
		}
		if err := tx.Commit().Error; err != nil {
			return 0, err
		}
		return 1, nil
	}

	if counter.LastDate == today {
		tx.Rollback()
		return counter.CurrentValue, nil
	}

	lastTime, err := time.Parse("2006-01-02", counter.LastDate)
	if err != nil {
		tx.Rollback()
		return 0, err
	}
	todayTime, _ := time.Parse("2006-01-02", today)
	diff := todayTime.Sub(lastTime).Hours() / 24

	if diff == 1 {
		counter.CurrentValue += 1
	} else {
		counter.CurrentValue = 1
	}
	counter.LastDate = today

	if err := tx.Save(&counter).Error; err != nil {
		tx.Rollback()
		return 0, err
	}

	if err := tx.Commit().Error; err != nil {
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
			lastTime, err := time.Parse("2006-01-02", counter.LastDate)
			if err != nil {
				return 0, nil
			}
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
	return s.checkAchievementsInternal(childID, 0, counterType, templateID)
}

func (s *AchievementService) CheckAchievementsForFamily(childID, familyID uint, counterType int, templateID uint) ([]model.AchievementAward, error) {
	return s.checkAchievementsInternal(childID, familyID, counterType, templateID)
}

// isRepeatableAchievement 判断成就是否为可重复获得类型
// 模板任务专属成就（CounterTypeTemplateTaskCount）支持重复获得，解锁后重置计数器
// 其他累计型成就（任务数、连续天数、累计积分、自定义非模板）为一次性里程碑，不重置、不重复颁发
func isRepeatableAchievement(a *model.Achievement) bool {
	return a.CounterType == model.CounterTypeTemplateTaskCount
}

func (s *AchievementService) checkAchievementsInternal(childID, familyID uint, counterType int, templateID uint) ([]model.AchievementAward, error) {
	var achievements []model.Achievement
	query := database.DB.Model(&model.Achievement{}).
		Where("counter_type = ? AND (family_id = 0 OR family_id = ?)", counterType, familyID).
		Order("counter_target ASC")
	if counterType == model.CounterTypeTemplateTaskCount {
		query = query.Where("template_id = ?", templateID)
	}
	if err := query.Find(&achievements).Error; err != nil {
		return nil, err
	}

	var awards []model.AchievementAward

	for _, achievement := range achievements {
		counterValue, err := s.GetCounterValue(childID, achievement.CounterType, achievement.TemplateID)
		if err != nil {
			return nil, err
		}

		if counterValue < achievement.CounterTarget {
			continue
		}

		var existingUA model.UserAchievement
		if err := database.DB.Where("child_id = ? AND achievement_id = ?", childID, achievement.ID).First(&existingUA).Error; err == nil {
			if !isRepeatableAchievement(&achievement) && existingUA.AwardCount > 0 {
				continue
			}
		}

		award, err := s.AwardAchievement(childID, achievement.ID)
		if err != nil {
			return nil, err
		}
		awards = append(awards, *award)

		if isRepeatableAchievement(&achievement) {
			s.ResetCounter(childID, achievement.CounterType, achievement.TemplateID)
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

	if achievement.Points > 0 {
		if err := s.addAchievementPoints(childID, achievement.Points, achievement.Name); err != nil {
			return nil, err
		}
	}

	var ua model.UserAchievement
	err := database.DB.Where("child_id = ? AND achievement_id = ?", childID, achievementID).First(&ua).Error
	if err != nil {
		ua = model.UserAchievement{
			ChildID:       childID,
			AchievementID: achievementID,
			AwardCount:    1,
			CurrentValue:  0,
			Unlocked:      true,
		}
		if err := database.DB.Create(&ua).Error; err != nil {
			return nil, err
		}
	} else {
		ua.AwardCount += 1
		ua.Unlocked = true
		if err := database.DB.Save(&ua).Error; err != nil {
			return nil, err
		}
	}

	award.Achievement = achievement
	log.Printf("[Achievement] Awarded achievement '%s' (id=%d) to child=%d, awardCount=%d", achievement.Name, achievement.ID, childID, ua.AwardCount)
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
	if err := database.DB.Where("id = ? AND role = ?", childID, model.RoleChild).First(&child).Error; err != nil {
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
		{Name: "任务达人", Description: "完成50个任务", Icon: "⭐", CounterType: model.CounterTypeTaskCount, CounterTarget: 50, Points: 100},
		{Name: "超级劳模", Description: "完成100个任务", Icon: "🏆", CounterType: model.CounterTypeTaskCount, CounterTarget: 100, Points: 200},
		{Name: "坚持7天", Description: "连续7天完成任务", Icon: "💪", CounterType: model.CounterTypeConsecutiveDays, CounterTarget: 7, Points: 80},
		{Name: "坚持30天", Description: "连续30天完成任务", Icon: "💎", CounterType: model.CounterTypeConsecutiveDays, CounterTarget: 30, Points: 200},
		{Name: "小试牛刀", Description: "累计获得500积分", Icon: "🥈", CounterType: model.CounterTypeTotalPoints, CounterTarget: 500, Points: 50},
		{Name: "积分达人", Description: "累计获得1000积分", Icon: "🥇", CounterType: model.CounterTypeTotalPoints, CounterTarget: 1000, Points: 100},
		{Name: "富甲一方", Description: "累计获得5000积分", Icon: "👑", CounterType: model.CounterTypeTotalPoints, CounterTarget: 5000, Points: 300},
	}

	for _, achievement := range achievements {
		var existing model.Achievement
		if err := database.DB.Where("name = ?", achievement.Name).First(&existing).Error; err != nil {
			if err := database.DB.Create(&achievement).Error; err != nil {
				return err
			}
		}
	}

	oldAchievementNames := []string{"初露锋芒", "勤劳小蜜蜂", "坚持3天", "精打细算", "公益小天使"}

	tx := database.DB.Begin()

	var oldAchievements []model.Achievement
	if err := tx.Where("name IN (?)", oldAchievementNames).Find(&oldAchievements).Error; err != nil {
		tx.Rollback()
		return err
	}

	for _, oldAchievement := range oldAchievements {
		if err := tx.Where("achievement_id = ?", oldAchievement.ID).Delete(&model.UserAchievement{}).Error; err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Where("achievement_id = ?", oldAchievement.ID).Delete(&model.AchievementAward{}).Error; err != nil {
			tx.Rollback()
			return err
		}
		if err := tx.Delete(&oldAchievement).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit().Error
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

	if achievement.IsCustom {
		if achievement.FamilyID != familyID {
			return nil, errors.New("无权修改该勋章")
		}
	}

	updates := make(map[string]interface{})

	if achievement.IsCustom {
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
