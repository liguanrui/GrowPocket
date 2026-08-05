package service

import (
	"errors"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"time"
)

type TaskTemplateService struct{}

func NewTaskTemplateService() *TaskTemplateService {
	return &TaskTemplateService{}
}

func (s *TaskTemplateService) CreateTemplate(familyID uint, createdBy uint, title, description, icon, category string, points, sortOrder int, minAge, maxAge, estimatedTime int, difficulty, frequency, tags string) (*model.TaskTemplate, error) {
	if title == "" {
		return nil, errors.New("任务模板标题不能为空")
	}
	if points < 0 {
		return nil, errors.New("积分值不能小于 0")
	}

	if category == "" {
		category = "学习"
	}
	if icon == "" {
		icon = "⭐"
	}
	if difficulty == "" {
		difficulty = "medium"
	}
	if frequency == "" {
		frequency = "once"
	}
	if minAge == 0 {
		minAge = 3
	}
	if maxAge == 0 {
		maxAge = 12
	}

	template := &model.TaskTemplate{
		FamilyID:      familyID,
		CreatedBy:     createdBy,
		Title:         title,
		Description:   description,
		Icon:          icon,
		Category:      category,
		Points:        points,
		SortOrder:     sortOrder,
		IsActive:      true,
		MinAge:        minAge,
		MaxAge:        maxAge,
		Difficulty:    difficulty,
		Frequency:     frequency,
		EstimatedTime: estimatedTime,
		Tags:          tags,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := database.DB.Create(template).Error; err != nil {
		return nil, errors.New("创建任务模板失败")
	}
	return template, nil
}

func (s *TaskTemplateService) UpdateTemplate(id uint, familyID uint, title, description, icon, category, difficulty, frequency, tags *string, points, sortOrder, minAge, maxAge, estimatedTime *int, isActive *bool) (*model.TaskTemplate, error) {
	template, err := s.GetTemplate(id, familyID)
	if err != nil {
		return nil, err
	}

	if title != nil {
		if *title == "" {
			return nil, errors.New("任务模板标题不能为空")
		}
		template.Title = *title
	}
	if description != nil {
		template.Description = *description
	}
	if icon != nil {
		template.Icon = *icon
	}
	if category != nil {
		template.Category = *category
	}
	if points != nil {
		if *points < 0 {
			return nil, errors.New("积分值不能小于 0")
		}
		template.Points = *points
	}
	if sortOrder != nil {
		template.SortOrder = *sortOrder
	}
	if isActive != nil {
		template.IsActive = *isActive
	}
	if minAge != nil {
		template.MinAge = *minAge
	}
	if maxAge != nil {
		template.MaxAge = *maxAge
	}
	if difficulty != nil {
		template.Difficulty = *difficulty
	}
	if frequency != nil {
		template.Frequency = *frequency
	}
	if estimatedTime != nil {
		template.EstimatedTime = *estimatedTime
	}
	if tags != nil {
		template.Tags = *tags
	}

	template.UpdatedAt = time.Now()
	if err := database.DB.Save(template).Error; err != nil {
		return nil, errors.New("更新任务模板失败")
	}
	return template, nil
}

func (s *TaskTemplateService) DeleteTemplate(id uint, familyID uint) error {
	template, err := s.GetTemplate(id, familyID)
	if err != nil {
		return err
	}
	if err := database.DB.Delete(template).Error; err != nil {
		return errors.New("删除任务模板失败")
	}
	return nil
}

func (s *TaskTemplateService) ListTemplates(familyID uint) ([]model.TaskTemplate, error) {
	var templates []model.TaskTemplate
	err := database.DB.Where("family_id = ?", familyID).
		Order("sort_order ASC, created_at ASC").
		Find(&templates).Error
	if err != nil {
		return nil, errors.New("查询任务模板列表失败")
	}
	return templates, nil
}

func (s *TaskTemplateService) GetTemplate(id uint, familyID uint) (*model.TaskTemplate, error) {
	var template model.TaskTemplate
	err := database.DB.Where("id = ? AND family_id = ?", id, familyID).First(&template).Error
	if err != nil {
		return nil, errors.New("任务模板不存在")
	}
	return &template, nil
}

func (s *TaskTemplateService) CreateTaskFromTemplate(templateID uint, familyID uint, childID uint, childName string, createdBy uint) (*model.Task, error) {
	template, err := s.GetTemplate(templateID, familyID)
	if err != nil {
		return nil, err
	}

	task := &model.Task{
		FamilyID:    familyID,
		Title:       template.Title,
		Description: template.Description,
		Points:      template.Points,
		Status:      model.TaskStatusInProgress,
		ChildID:     childID,
		ChildName:   childName,
		CreatedBy:   createdBy,
		TemplateID:  templateID,
		Category:    template.Category,
		Difficulty:  template.Difficulty,
		Frequency:   template.Frequency,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := database.DB.Create(task).Error; err != nil {
		return nil, errors.New("从模板创建任务失败")
	}
	return task, nil
}

func (s *TaskTemplateService) SeedInitialTemplates(familyID, createdBy uint) error {
	var count int64
	if err := database.DB.Model(&model.TaskTemplate{}).Where("family_id = ?", familyID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	defaults := []model.TaskTemplate{
		// ===== daily_fixed 锚任务(每日保底,3-5 个) =====
		// 维度: 1=生活自理 2=责任担当 3=动手实践 4=学习认知 5=社交情感 6=身心健康
		{FamilyID: familyID, CreatedBy: createdBy, Title: "自己穿衣服", Description: "独立完成穿衣、穿袜子和鞋子", Icon: "👕", Category: "行为习惯", Points: 10, SortOrder: 0, IsActive: true, MinAge: 3, MaxAge: 5, Difficulty: "easy", Frequency: "daily", EstimatedTime: 5, Tags: "自理能力", IsSystem: true, TaskKind: "daily_fixed", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "自己刷牙", Description: "独立刷牙2分钟，刷干净每一颗牙齿", Icon: "🦷", Category: "行为习惯", Points: 10, SortOrder: 1, IsActive: true, MinAge: 3, MaxAge: 6, Difficulty: "easy", Frequency: "daily", EstimatedTime: 3, Tags: "卫生习惯", IsSystem: true, TaskKind: "daily_fixed", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "收拾玩具", Description: "玩完玩具后，把所有玩具放回原位", Icon: "🧸", Category: "行为习惯", Points: 15, SortOrder: 2, IsActive: true, MinAge: 3, MaxAge: 6, Difficulty: "easy", Frequency: "daily", EstimatedTime: 10, Tags: "整理", IsSystem: true, TaskKind: "daily_fixed", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "整理书包", Description: "自己整理书包，准备明天的学习用品", Icon: "🎒", Category: "学习", Points: 20, SortOrder: 7, IsActive: true, MinAge: 6, MaxAge: 9, Difficulty: "easy", Frequency: "daily", EstimatedTime: 10, Tags: "学习习惯", IsSystem: true, TaskKind: "daily_fixed", AbilityDimensionID: 4, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "按时睡觉", Description: "晚上9点前上床睡觉", Icon: "🌙", Category: "行为习惯", Points: 15, SortOrder: 12, IsActive: true, MinAge: 6, MaxAge: 10, Difficulty: "easy", Frequency: "daily", EstimatedTime: 0, Tags: "作息习惯", IsSystem: true, TaskKind: "daily_fixed", AbilityDimensionID: 6, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "独立完成作业", Description: "独立完成当天的作业，不拖延", Icon: "✏️", Category: "学习", Points: 50, SortOrder: 13, IsActive: true, MinAge: 6, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 30, Tags: "学习", IsSystem: true, TaskKind: "daily_fixed", AbilityDimensionID: 4, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "户外运动", Description: "每天户外活动至少1小时", Icon: "⚽", Category: "运动", Points: 40, SortOrder: 16, IsActive: true, MinAge: 6, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 60, Tags: "运动", IsSystem: true, TaskKind: "daily_fixed", AbilityDimensionID: 6, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		// ===== weekly_recurring 拓展任务(供 Cycle 拓展槽抽样) =====
		{FamilyID: familyID, CreatedBy: createdBy, Title: "摆碗筷", Description: "吃饭前帮忙摆放碗筷", Icon: "🍽️", Category: "家务", Points: 10, SortOrder: 3, IsActive: true, MinAge: 3, MaxAge: 6, Difficulty: "easy", Frequency: "daily", EstimatedTime: 3, Tags: "家务", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 2, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "随手关门", Description: "进门后随手把门关好", Icon: "🚪", Category: "行为习惯", Points: 5, SortOrder: 4, IsActive: true, MinAge: 3, MaxAge: 6, Difficulty: "easy", Frequency: "daily", EstimatedTime: 1, Tags: "好习惯", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 2, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "独立如厕", Description: "自己上厕所并冲水", Icon: "🚽", Category: "行为习惯", Points: 10, SortOrder: 5, IsActive: true, MinAge: 3, MaxAge: 6, Difficulty: "easy", Frequency: "daily", EstimatedTime: 5, Tags: "自理能力", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "洗手", Description: "饭前便后认真洗手", Icon: "🖐️", Category: "行为习惯", Points: 5, SortOrder: 6, IsActive: true, MinAge: 3, MaxAge: 8, Difficulty: "easy", Frequency: "daily", EstimatedTime: 2, Tags: "卫生习惯", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "阅读15分钟", Description: "每天坚持阅读15分钟", Icon: "📚", Category: "学习", Points: 20, SortOrder: 8, IsActive: true, MinAge: 6, MaxAge: 9, Difficulty: "easy", Frequency: "daily", EstimatedTime: 15, Tags: "阅读", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 4, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "倒垃圾", Description: "把家里的垃圾倒到楼下垃圾桶", Icon: "🗑️", Category: "家务", Points: 15, SortOrder: 9, IsActive: true, MinAge: 6, MaxAge: 10, Difficulty: "easy", Frequency: "daily", EstimatedTime: 5, Tags: "家务", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 2, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "擦桌子", Description: "用餐后把桌子擦干净", Icon: "🧹", Category: "家务", Points: 15, SortOrder: 10, IsActive: true, MinAge: 6, MaxAge: 10, Difficulty: "easy", Frequency: "daily", EstimatedTime: 5, Tags: "家务", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 3, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "穿好衣服叠被子", Description: "早上起床后自己穿衣服并叠好被子", Icon: "🛏️", Category: "行为习惯", Points: 20, SortOrder: 11, IsActive: true, MinAge: 6, MaxAge: 9, Difficulty: "easy", Frequency: "daily", EstimatedTime: 10, Tags: "习惯养成", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "洗碗", Description: "饭后把碗筷洗干净并放好", Icon: "🍽️", Category: "家务", Points: 30, SortOrder: 14, IsActive: true, MinAge: 6, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 15, Tags: "家务", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 3, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "整理房间", Description: "整理床铺、叠好衣物、收拾书桌", Icon: "🏠", Category: "家务", Points: 50, SortOrder: 15, IsActive: true, MinAge: 6, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 20, Tags: "整理", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "跳绳100个", Description: "连续跳绳100个", Icon: "🪢", Category: "运动", Points: 25, SortOrder: 17, IsActive: true, MinAge: 6, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 10, Tags: "运动", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 6, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "预习功课", Description: "预习明天要学的内容", Icon: "📖", Category: "学习", Points: 30, SortOrder: 18, IsActive: true, MinAge: 7, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 15, Tags: "学习", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 4, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "复习功课", Description: "复习当天学过的内容", Icon: "📝", Category: "学习", Points: 30, SortOrder: 19, IsActive: true, MinAge: 7, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 15, Tags: "学习", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 4, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "浇花", Description: "给家里的植物浇水", Icon: "🌱", Category: "家务", Points: 20, SortOrder: 20, IsActive: true, MinAge: 7, MaxAge: 12, Difficulty: "easy", Frequency: "daily", EstimatedTime: 5, Tags: "家务", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 3, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "照顾宠物", Description: "给宠物喂食、换水、清理卫生", Icon: "🐶", Category: "家务", Points: 30, SortOrder: 21, IsActive: true, MinAge: 8, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 15, Tags: "责任", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 2, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "阅读30分钟", Description: "阅读课外书籍30分钟", Icon: "📚", Category: "学习", Points: 40, SortOrder: 22, IsActive: true, MinAge: 8, MaxAge: 12, Difficulty: "medium", Frequency: "daily", EstimatedTime: 30, Tags: "阅读", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 4, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "拖地", Description: "用拖把把地面拖干净", Icon: "🧹", Category: "家务", Points: 40, SortOrder: 23, IsActive: true, MinAge: 8, MaxAge: 12, Difficulty: "medium", Frequency: "weekly", EstimatedTime: 20, Tags: "家务", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 3, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "洗衣服", Description: "自己洗小件衣物（袜子、内衣等）", Icon: "👕", Category: "家务", Points: 50, SortOrder: 24, IsActive: true, MinAge: 8, MaxAge: 12, Difficulty: "hard", Frequency: "weekly", EstimatedTime: 30, Tags: "家务", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 3, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "准备早餐", Description: "自己准备简单的早餐", Icon: "🍳", Category: "家务", Points: 60, SortOrder: 25, IsActive: true, MinAge: 9, MaxAge: 12, Difficulty: "hard", Frequency: "weekly", EstimatedTime: 30, Tags: "自理能力", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "做一道菜", Description: "学会做一道简单的菜", Icon: "👩🍳", Category: "家务", Points: 80, SortOrder: 26, IsActive: true, MinAge: 10, MaxAge: 12, Difficulty: "hard", Frequency: "once", EstimatedTime: 60, Tags: "挑战", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 3, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "写一篇作文", Description: "独立完成一篇作文", Icon: "✍️", Category: "学习", Points: 60, SortOrder: 27, IsActive: true, MinAge: 9, MaxAge: 12, Difficulty: "hard", Frequency: "weekly", EstimatedTime: 45, Tags: "写作", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 4, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "制定学习计划", Description: "为一周制定学习计划", Icon: "📅", Category: "学习", Points: 50, SortOrder: 28, IsActive: true, MinAge: 10, MaxAge: 12, Difficulty: "hard", Frequency: "weekly", EstimatedTime: 30, Tags: "时间管理", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 2, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "主动问候长辈", Description: "见到长辈主动打招呼", Icon: "👋", Category: "行为习惯", Points: 10, SortOrder: 29, IsActive: true, MinAge: 6, MaxAge: 12, Difficulty: "easy", Frequency: "daily", EstimatedTime: 1, Tags: "礼貌", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 5, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "整理书架", Description: "把书架上的书整理分类", Icon: "📚", Category: "家务", Points: 30, SortOrder: 30, IsActive: true, MinAge: 8, MaxAge: 12, Difficulty: "medium", Frequency: "weekly", EstimatedTime: 20, Tags: "整理", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 1, CreatedAt: time.Now(), UpdatedAt: time.Now()},
		{FamilyID: familyID, CreatedBy: createdBy, Title: "独立购物", Description: "在家长陪同下独立购买物品", Icon: "🛒", Category: "行为习惯", Points: 50, SortOrder: 31, IsActive: true, MinAge: 9, MaxAge: 12, Difficulty: "hard", Frequency: "once", EstimatedTime: 30, Tags: "独立", IsSystem: true, TaskKind: "weekly_recurring", AbilityDimensionID: 2, CreatedAt: time.Now(), UpdatedAt: time.Now()},
	}

	for i := range defaults {
		if err := database.DB.Create(&defaults[i]).Error; err != nil {
			log.Printf("初始化任务模板失败(family=%d, title=%s): %v", familyID, defaults[i].Title, err)
			return err
		}
	}
	log.Printf("已为家庭 %d 初始化 %d 个任务模板", familyID, len(defaults))
	return nil
}

func SeedAllFamiliesTemplates() error {
	var families []model.Family
	if err := database.DB.Find(&families).Error; err != nil {
		return err
	}
	s := NewTaskTemplateService()
	for _, f := range families {
		if err := s.SeedInitialTemplates(f.ID, 0); err != nil {
			log.Printf("为家庭 %d 补齐任务模板失败: %v", f.ID, err)
		}
	}
	return nil
}
