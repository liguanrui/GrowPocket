package database

import (
	"growpocket/internal/model"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
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

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
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
		&model.Achievement{},
		&model.UserAchievement{},
		&model.UserCounter{},
		&model.AchievementAward{},
		&model.TaskTemplate{},
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
	// Seed 公益项目
	var projectCount int64
	db.Model(&model.CharityProject{}).Count(&projectCount)
	if projectCount == 0 {
		projects := []model.CharityProject{
			{Title: "捐书", Icon: "book", Description: "为偏远地区的孩子们捐赠图书，帮助他们打开知识的大门。", Points: 50},
			{Title: "捐衣服", Icon: "shirt", Description: "捐赠干净的衣物，让温暖传递给需要帮助的家庭。", Points: 80},
			{Title: "捐玩具", Icon: "gift", Description: "捐赠闲置的玩具，给更多孩子带来快乐。", Points: 60},
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
