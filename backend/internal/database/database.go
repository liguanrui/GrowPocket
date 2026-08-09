package database

import (
	"growpocket/internal/model"
	"growpocket/pkg/util"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

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

	// SQLite 并发配置：WAL 模式 + busy_timeout，避免事务嵌套错误
	dsn := dbPath + "?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=on"
	db, err := gorm.Open(sqlite.Dialector{
		DSN:        dsn,
		DriverName: "sqlite",
	}, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("打开 SQLite 数据库失败: %v", err)
	}

	// SQLite 单连接：避免并发事务冲突（"cannot start a transaction within a transaction"）
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("获取底层 sql.DB 失败: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxLifetime(0)
	sqlDB.SetConnMaxIdleTime(0)

	// 启用 WAL 模式（若 DSN 未生效，再用 PRAGMA 兜底）
	db.Exec("PRAGMA journal_mode=WAL")
	db.Exec("PRAGMA busy_timeout=5000")
	db.Exec("PRAGMA foreign_keys=ON")

	DB = db

	// AutoMigrate
	err = db.AutoMigrate(
		&model.Family{},
		&model.User{},
		&model.Task{},
		&model.Transaction{},
		&model.Achievement{},
		&model.UserAchievement{},
		&model.UserCounter{},
		&model.AchievementAward{},
		&model.RedeemItem{},
		&model.Redeem{},
		&model.CommunityShare{},
		&model.CommunityLike{},
		&model.CommunityComment{},
		&model.CharityProject{},
		&model.CharityDonation{},
		&model.CharityActivity{},
		&model.ActivityParticipant{},
		&model.SystemMessage{},
		&model.TaskTemplate{},
		&model.TaskRecurringConfig{},
		&model.AbilityDimension{},
		&model.GradeDimensionGuide{},
		&model.ChildAbilityScore{},
		&model.GrowthCycle{},
		&model.Goal{},
		&model.Questionnaire{},
		&model.QuestionnaireAnswer{},
		&model.ChatSession{},
		&model.ChatMessage{},
		&model.GrowthStory{},
		// V3.2 AI 助理 Function Calling：写操作审计日志
		&model.AIAuditLog{},
		// V3.1 模块 D：学业双层结构（学业趋势档位 + 学业奖励池）
		&model.AcademicMilestone{},
		&model.AcademicTrendEntry{},
		// V3.1 模块 B：大师挑战
		&model.MasterChallengeTemplate{},
		&model.MasterChallengeInstance{},
		&model.MasterChallengeStage{},
		&model.MasterChallengeSubmission{},
		&model.AdminUser{},
		&model.AdminOperationLog{},
	)
	if err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	if err := ensureFamilyShareCodes(db); err != nil {
		log.Printf("家庭分享码补全失败: %v", err)
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

	if err := seedGradeDimensionGuides(db); err != nil {
		log.Printf("年级·维度发展矩阵 Seed 数据失败: %v", err)
	}

	if err := seedQuestionnaires(db); err != nil {
		log.Printf("问卷数据初始化失败: %v", err)
	}

	if err := seedMasterChallengeTemplates(db); err != nil {
		log.Printf("大师挑战模板 Seed 数据失败: %v", err)
	}

	log.Printf("数据库初始化完成: %s", dbPath)
}

// ensureFamilyShareCodes 为缺少分享码的旧家庭补全唯一码
func ensureFamilyShareCodes(db *gorm.DB) error {
	var families []model.Family
	if err := db.Where("share_code = ? OR share_code IS NULL", "").Find(&families).Error; err != nil {
		return err
	}
	for i := range families {
		assigned := false
		for retry := 0; retry < 12; retry++ {
			code, err := util.GenerateShareCode(8)
			if err != nil {
				return err
			}
			if err := db.Model(&families[i]).Update("share_code", code).Error; err != nil {
				continue // 唯一冲突则重试
			}
			assigned = true
			break
		}
		if !assigned {
			log.Printf("家庭 %d 分享码补全失败（冲突过多）", families[i].ID)
		}
	}
	return nil
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

// seedGradeDimensionGuides 初始化年级·维度发展指南矩阵（6 年级 × 6 维 = 36 行）
// 维度 ID 1-6 分别对应：1=生活自理, 2=独立自主, 3=动手实践, 4=学习认知, 5=社交情感, 6=身心健康
// 矩阵数据格式：weight / cap / focus_level(primary 主轴 / secondary 次轴 / latent 蓄势)
func seedGradeDimensionGuides(db *gorm.DB) error {
	var count int64
	db.Model(&model.GradeDimensionGuide{}).Count(&count)
	if count > 0 {
		return nil // 幂等：已存在则跳过
	}

	guides := []model.GradeDimensionGuide{
		// 年级 1：主轴=生活自理、独立自主、身心健康；次轴=动手实践；蓄势=学习认知、社交情感
		{Grade: 1, DimensionID: 1, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		{Grade: 1, DimensionID: 2, Weight: 1.5, Cap: 95, FocusLevel: "primary"},
		{Grade: 1, DimensionID: 3, Weight: 1.0, Cap: 80, FocusLevel: "secondary"},
		{Grade: 1, DimensionID: 4, Weight: 0.3, Cap: 40, FocusLevel: "latent"},
		{Grade: 1, DimensionID: 5, Weight: 0.3, Cap: 35, FocusLevel: "latent"},
		{Grade: 1, DimensionID: 6, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		// 年级 2：主轴=生活自理、独立自主、身心健康；次轴=动手实践、学习认知；蓄势=社交情感
		{Grade: 2, DimensionID: 1, Weight: 1.6, Cap: 100, FocusLevel: "primary"},
		{Grade: 2, DimensionID: 2, Weight: 1.5, Cap: 100, FocusLevel: "primary"},
		{Grade: 2, DimensionID: 3, Weight: 1.2, Cap: 85, FocusLevel: "secondary"},
		{Grade: 2, DimensionID: 4, Weight: 1.0, Cap: 80, FocusLevel: "secondary"},
		{Grade: 2, DimensionID: 5, Weight: 0.4, Cap: 45, FocusLevel: "latent"},
		{Grade: 2, DimensionID: 6, Weight: 1.6, Cap: 100, FocusLevel: "primary"},
		// 年级 3：主轴=动手实践、学习认知；次轴=生活自理、独立自主、社交情感、身心健康
		{Grade: 3, DimensionID: 1, Weight: 1.0, Cap: 85, FocusLevel: "secondary"},
		{Grade: 3, DimensionID: 2, Weight: 1.0, Cap: 80, FocusLevel: "secondary"},
		{Grade: 3, DimensionID: 3, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		{Grade: 3, DimensionID: 4, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		{Grade: 3, DimensionID: 5, Weight: 1.0, Cap: 85, FocusLevel: "secondary"},
		{Grade: 3, DimensionID: 6, Weight: 1.0, Cap: 90, FocusLevel: "secondary"},
		// 年级 4：主轴=动手实践、学习认知、社交情感；次轴=生活自理、独立自主、身心健康
		{Grade: 4, DimensionID: 1, Weight: 1.0, Cap: 90, FocusLevel: "secondary"},
		{Grade: 4, DimensionID: 2, Weight: 1.2, Cap: 90, FocusLevel: "secondary"},
		{Grade: 4, DimensionID: 3, Weight: 1.5, Cap: 100, FocusLevel: "primary"},
		{Grade: 4, DimensionID: 4, Weight: 1.5, Cap: 100, FocusLevel: "primary"},
		{Grade: 4, DimensionID: 5, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		{Grade: 4, DimensionID: 6, Weight: 1.0, Cap: 95, FocusLevel: "secondary"},
		// 年级 5：主轴=学习认知、社交情感、动手实践、身心健康；次轴=生活自理、独立自主
		{Grade: 5, DimensionID: 1, Weight: 1.0, Cap: 95, FocusLevel: "secondary"},
		{Grade: 5, DimensionID: 2, Weight: 1.2, Cap: 95, FocusLevel: "secondary"},
		{Grade: 5, DimensionID: 3, Weight: 1.5, Cap: 100, FocusLevel: "primary"},
		{Grade: 5, DimensionID: 4, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		{Grade: 5, DimensionID: 5, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		{Grade: 5, DimensionID: 6, Weight: 1.5, Cap: 100, FocusLevel: "primary"},
		// 年级 6：全部维度 primary
		{Grade: 6, DimensionID: 1, Weight: 1.5, Cap: 100, FocusLevel: "primary"},
		{Grade: 6, DimensionID: 2, Weight: 2.0, Cap: 100, FocusLevel: "primary"},
		{Grade: 6, DimensionID: 3, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		{Grade: 6, DimensionID: 4, Weight: 1.5, Cap: 100, FocusLevel: "primary"},
		{Grade: 6, DimensionID: 5, Weight: 1.8, Cap: 100, FocusLevel: "primary"},
		{Grade: 6, DimensionID: 6, Weight: 1.5, Cap: 100, FocusLevel: "primary"},
	}
	for i := range guides {
		if err := db.Create(&guides[i]).Error; err != nil {
			return err
		}
	}
	log.Printf("已创建 %d 行年级·维度发展指南", len(guides))
	return nil
}
