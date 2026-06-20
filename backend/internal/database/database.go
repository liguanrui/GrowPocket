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
	)
	if err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	log.Printf("数据库初始化完成: %s", dbPath)
}
