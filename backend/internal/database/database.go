package database

import (
	"growpocket/internal/model"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	_ "modernc.org/sqlite"
)

var DB *gorm.DB

func Init(dbPath string) {
	// 确保 data 目录存在
	dir := filepath.Dir(dbPath)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("创建数据目录失败: %v", err)
		}
	}

	db, err := gorm.Open(sqlite.Dialector{
		DSN:        dbPath,
		DriverName: "sqlite",
	}, &gorm.Config{})
	if err != nil {
		log.Fatalf("打开 SQLite 数据库失败: %v", err)
	}

	DB = db

	// AutoMigrate
	err = db.AutoMigrate(
		&model.Family{},
		&model.User{},
		&model.Task{},
		&model.Transaction{},
		&model.RedeemItem{},
		&model.Redeem{},
		&model.CommunityShare{},
		&model.CommunityLike{},
		&model.CommunityComment{},
		&model.CharityProject{},
		&model.CharityDonation{},
		&model.CharityActivity{},
		&model.ActivityParticipant{},
		&model.TaskTemplate{},
		&model.TaskRecurringConfig{},
		&model.AbilityDimension{},
		&model.ChildAbilityScore{},
		&model.GrowthCycle{},
		&model.Goal{},
		&model.Questionnaire{},
		&model.QuestionnaireAnswer{},
		&model.ChatSession{},
		&model.ChatMessage{},
		&model.GrowthStory{},
	)
	if err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	if err := migrateAchievementData(db); err != nil {
		log.Printf("成就数据迁移失败: %v", err)
	}

	// Seed 数据
	if err := seedCommunityData(db); err != nil {
		log.Printf("Seed 数据失败: %v", err)
	}

	if err := seedAbilityDimensions(db); err != nil {
		log.Printf("能力维度 Seed 数据失败: %v", err)
	}

	if err := seedQuestionnaires(db); err != nil {
		log.Printf("问卷数据初始化失败: %v", err)
	}

	log.Printf("数据库初始化完成: %s", dbPath)
}

func migrateAchievementData(db *gorm.DB) error {
	// 检查是否存在旧的 type 列（旧 schema 遗留）
	type columnInfo struct {
		Name string
	}
	var columns []columnInfo
	if err := db.Raw("PRAGMA table_info(achievements)").Scan(&columns).Error; err != nil {
		return err
	}
	hasOldTypeColumn := false
	for _, col := range columns {
		if col.Name == "type" {
			hasOldTypeColumn = true
			break
		}
	}

	// 仅当存在旧列时才执行数据迁移并删除旧列
	if !hasOldTypeColumn {
		return nil
	}

	type oldTypeMapping struct {
		OldType int
		NewType int
	}
	mappings := []oldTypeMapping{
		{1, 1},
		{2, 3},
		{3, 4},
		{4, 1},
		{5, 6},
		{6, 7},
	}

	tx := db.Begin()

	for _, m := range mappings {
		if err := tx.Model(&model.Achievement{}).
			Where("type = ? AND counter_type = 1 AND counter_target = 0", m.OldType).
			Updates(map[string]interface{}{
				"counter_type":   m.NewType,
				"counter_target": gorm.Expr("target_value"),
			}).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	// 迁移完成后删除旧的 type 和 target_value 列
	// 旧列带有 NOT NULL 约束，会导致新记录插入失败（NOT NULL constraint failed: achievements.type）
	if err := db.Exec("ALTER TABLE achievements DROP COLUMN type").Error; err != nil {
		log.Printf("删除 achievements.type 列失败（可忽略若列不存在）: %v", err)
	}
	if err := db.Exec("ALTER TABLE achievements DROP COLUMN target_value").Error; err != nil {
		log.Printf("删除 achievements.target_value 列失败（可忽略若列不存在）: %v", err)
	}

	return nil
}

func seedCommunityData(db *gorm.DB) error {
	var projectCount int64
	db.Model(&model.CharityProject{}).Count(&projectCount)
	if projectCount == 0 {
		projects := []model.CharityProject{
			{Title: "捐书", Icon: "book", Description: "为偏远地区的孩子们捐赠图书，帮助他们打开知识的大门。每公斤图书可获得积分奖励。", PointsPerKg: 30},
			{Title: "捐衣服", Icon: "shirt", Description: "捐赠干净的衣物，让温暖传递给需要帮助的家庭。每公斤衣物可获得积分奖励。", PointsPerKg: 20},
			{Title: "捐玩具", Icon: "gift", Description: "捐赠闲置的玩具，给更多孩子带来快乐。每公斤玩具可获得积分奖励。", PointsPerKg: 25},
		}
		for i := range projects {
			if err := db.Create(&projects[i]).Error; err != nil {
				return err
			}
		}
		log.Printf("已创建 3 个公益项目")
	}
	return nil
}

func seedAbilityDimensions(db *gorm.DB) error {
	var count int64
	db.Model(&model.AbilityDimension{}).Count(&count)
	if count > 0 {
		return nil
	}
	dimensions := []model.AbilityDimension{
		{Code: "self_care", Name: "生活自理", Description: "完成日常起居、个人卫生、整理收纳等生活技能", Icon: "home", Color: "#7EC850", ResearchSrc: "蒙台梭利生活技能教育", SortOrder: 1},
		{Code: "independence", Name: "独立自主", Description: "独立思考、自主决策、自我管理的能力", Icon: "compass", Color: "#4A90D9", ResearchSrc: "埃里克森心理社会发展理论", SortOrder: 2},
		{Code: "hands_on", Name: "动手实践", Description: "动手制作、手工创作、家务劳动等实践能力", Icon: "wrench", Color: "#FF9500", ResearchSrc: "Gardner多元智能理论", SortOrder: 3},
		{Code: "learning", Name: "学习认知", Description: "知识获取、思维训练、学习方法与学习习惯", Icon: "book", Color: "#9B59B6", ResearchSrc: "中国学生发展核心素养", SortOrder: 4},
		{Code: "social_emotional", Name: "社交情感", Description: "人际交往、情绪管理、共情与合作能力", Icon: "heart", Color: "#E74C3C", ResearchSrc: "CASEL SEL框架", SortOrder: 5},
		{Code: "health", Name: "身心健康", Description: "体育锻炼、健康习惯、心理韧性与抗压能力", Icon: "activity", Color: "#16A085", ResearchSrc: "中国学生发展核心素养", SortOrder: 6},
	}
	for i := range dimensions {
		if err := db.Create(&dimensions[i]).Error; err != nil {
			return err
		}
	}
	log.Printf("已创建 6 个能力维度")
	return nil
}
