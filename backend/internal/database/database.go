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
		&model.TaskTemplate{},
	)
	if err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	// Seed 数据
	if err := seedCommunityData(db); err != nil {
		log.Printf("Seed 数据失败: %v", err)
	}

	log.Printf("数据库初始化完成: %s", dbPath)
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
