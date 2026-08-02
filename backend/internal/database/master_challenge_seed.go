package database

import (
	"log"

	"growpocket/internal/model"

	"gorm.io/gorm"
)

// seedMasterChallengeTemplates 预置大师挑战项目模板（V3.1 模块 B）
// 4 大类 × L1~L5 分档，共 30 条
// 维度 ID 1-6：1=生活自理, 2=独立自主, 3=动手实践, 4=学习认知, 5=社交情感, 6=身心健康
func seedMasterChallengeTemplates(db *gorm.DB) error {
	var count int64
	db.Model(&model.MasterChallengeTemplate{}).Count(&count)
	if count > 0 {
		return nil // 幂等：已存在则跳过
	}

	templates := []model.MasterChallengeTemplate{
		// ============ family_cocreation 家庭共创（8 条） ============
		{
			Title: "策划周末旅行", Category: "family_cocreation", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[2,4,5]",
			Description: "孩子主导策划一次周末家庭出行，包含目的地调研、行程安排、预算估算与备选方案。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 200, Icon: "plane", IsActive: true,
		},
		{
			Title: "家庭会议海报", Category: "family_cocreation", DifficultyLevel: 1,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[3,4,5]",
			Description: "为下周家庭会议设计一张主题海报，包含议程、议题插画与会议时间安排。",
			RecommendedStages: 2, EstimatedDays: 3, PointsReward: 100, Icon: "clipboard", IsActive: true,
		},
		{
			Title: "3道菜晚餐", Category: "family_cocreation", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[1,3,4]",
			Description: "孩子主导为家人准备一顿3菜晚餐，从菜单设计、食材采购到烹饪全流程负责。",
			RecommendedStages: 3, EstimatedDays: 5, PointsReward: 200, Icon: "utensils", IsActive: true,
		},
		{
			Title: "孝心拜访", Category: "family_cocreation", DifficultyLevel: 1,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[1,5]",
			Description: "策划并完成一次对长辈的孝心拜访，准备一份手作心意并陪长辈聊家常。",
			RecommendedStages: 2, EstimatedDays: 2, PointsReward: 100, Icon: "heart", IsActive: true,
		},
		{
			Title: "家庭读书会", Category: "family_cocreation", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[4,5,2]",
			Description: "组织一周家庭读书会，每人选一本书共读，并在周末进行分享讨论与角色扮演。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 200, Icon: "book-open", IsActive: true,
		},
		{
			Title: "家庭运动会", Category: "family_cocreation", DifficultyLevel: 1,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[6,5,3]",
			Description: "孩子设计一场家庭趣味运动会，包含3个比赛项目、规则说明、场地布置与奖品设置。",
			RecommendedStages: 2, EstimatedDays: 3, PointsReward: 100, Icon: "activity", IsActive: true,
		},
		{
			Title: "家庭电影夜影评", Category: "family_cocreation", DifficultyLevel: 1,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[4,2,5]",
			Description: "组织家庭电影夜，观影后撰写一篇图文影评并主持家庭讨论。",
			RecommendedStages: 2, EstimatedDays: 2, PointsReward: 100, Icon: "film", IsActive: true,
		},
		{
			Title: "家庭预算规划", Category: "family_cocreation", DifficultyLevel: 3,
			MinGrade: 2, MaxGrade: 6, PrimaryDimIDs: "[2,4,5]",
			Description: "主导制定家庭一月支出预算方案，分类记录消费并提出优化建议。",
			RecommendedStages: 4, EstimatedDays: 14, PointsReward: 300, Icon: "pie-chart", IsActive: true,
		},

		// ============ creative_expression 创意表达（8 条） ============
		{
			Title: "自绘绘本", Category: "creative_expression", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[3,4,2]",
			Description: "创作一本原创手绘绘本，包含故事大纲、8页以上插画与封面封底设计。",
			RecommendedStages: 3, EstimatedDays: 10, PointsReward: 200, Icon: "book", IsActive: true,
		},
		{
			Title: "家庭小话剧", Category: "creative_expression", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[3,5,2]",
			Description: "编写剧本、分配角色、制作道具，并上演一场15分钟的家庭小话剧。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 200, Icon: "drama", IsActive: true,
		},
		{
			Title: "梦想小屋模型", Category: "creative_expression", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[3,4,2]",
			Description: "用纸板/积木等材料设计并搭建一座梦想小屋立体模型，附带设计说明。",
			RecommendedStages: 3, EstimatedDays: 10, PointsReward: 200, Icon: "home", IsActive: true,
		},
		{
			Title: "自然观察日记", Category: "creative_expression", DifficultyLevel: 1,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[4,3,6]",
			Description: "连续一周观察一种身边动植物，用图文形式记录每日变化与发现。",
			RecommendedStages: 2, EstimatedDays: 7, PointsReward: 100, Icon: "leaf", IsActive: true,
		},
		{
			Title: "手作礼物", Category: "creative_expression", DifficultyLevel: 1,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[3,5,2]",
			Description: "为家人或朋友手工制作一份节日礼物，附上手写卡片。",
			RecommendedStages: 2, EstimatedDays: 3, PointsReward: 100, Icon: "gift", IsActive: true,
		},
		{
			Title: "家庭歌谣创作", Category: "creative_expression", DifficultyLevel: 1,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[3,4,5]",
			Description: "为家庭创作一首原创歌谣，包含歌词、简单旋律与演唱表演。",
			RecommendedStages: 2, EstimatedDays: 3, PointsReward: 100, Icon: "music", IsActive: true,
		},
		{
			Title: "摄影故事", Category: "creative_expression", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[3,4,2]",
			Description: "围绕一个主题拍摄6张照片，并配上故事性文字组成摄影故事集。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 200, Icon: "camera", IsActive: true,
		},
		{
			Title: "科学小实验展示", Category: "creative_expression", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[3,4,2]",
			Description: "完成一个科学小实验，记录实验步骤、原理讲解与现象展示视频。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 200, Icon: "flask", IsActive: true,
		},

		// ============ community_service 社区服务（7 条，min_grade=3） ============
		{
			Title: "旧玩具募捐", Category: "community_service", DifficultyLevel: 3,
			MinGrade: 3, MaxGrade: 6, PrimaryDimIDs: "[5,2,3]",
			Description: "在小区或学校发起一次旧玩具募捐活动，整理并捐赠给公益机构。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 300, Icon: "gift", IsActive: true,
		},
		{
			Title: "流浪猫喂猫点", Category: "community_service", DifficultyLevel: 3,
			MinGrade: 3, MaxGrade: 6, PrimaryDimIDs: "[5,6,1]",
			Description: "在社区设立并维护一个流浪猫定期喂食点，持续记录猫咪状况。",
			RecommendedStages: 3, EstimatedDays: 14, PointsReward: 300, Icon: "cat", IsActive: true,
		},
		{
			Title: "社区花园维护", Category: "community_service", DifficultyLevel: 3,
			MinGrade: 3, MaxGrade: 6, PrimaryDimIDs: "[3,6,5]",
			Description: "认领社区花园一块区域，负责种植、浇水、除草与美化维护。",
			RecommendedStages: 3, EstimatedDays: 14, PointsReward: 300, Icon: "flower", IsActive: true,
		},
		{
			Title: "敬老院探访", Category: "community_service", DifficultyLevel: 3,
			MinGrade: 3, MaxGrade: 6, PrimaryDimIDs: "[5,1,4]",
			Description: "组织一次敬老院探访，准备节目与手作礼物，陪伴老人聊天互动。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 300, Icon: "users", IsActive: true,
		},
		{
			Title: "环保回收倡议", Category: "community_service", DifficultyLevel: 3,
			MinGrade: 3, MaxGrade: 6, PrimaryDimIDs: "[5,3,4]",
			Description: "在社区发起一次垃圾分类/可回收物收集倡议，含宣传海报与回收活动。",
			RecommendedStages: 4, EstimatedDays: 14, PointsReward: 300, Icon: "recycle", IsActive: true,
		},
		{
			Title: "社区读书角", Category: "community_service", DifficultyLevel: 4,
			MinGrade: 3, MaxGrade: 6, PrimaryDimIDs: "[5,4,2,3]",
			Description: "在社区或楼栋筹建一个共享读书角，含书目募集、分类整理与借阅规则制定。",
			RecommendedStages: 4, EstimatedDays: 21, PointsReward: 400, Icon: "book-open", IsActive: true,
		},
		{
			Title: "义卖活动", Category: "community_service", DifficultyLevel: 4,
			MinGrade: 3, MaxGrade: 6, PrimaryDimIDs: "[5,3,2,4]",
			Description: "策划并执行一次义卖活动，所得款项捐赠给指定公益项目。",
			RecommendedStages: 4, EstimatedDays: 21, PointsReward: 400, Icon: "shopping-bag", IsActive: true,
		},

		// ============ financial_literacy 财商素养（7 条） ============
		{
			Title: "积分储蓄月计划", Category: "financial_literacy", DifficultyLevel: 1,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[2,4,1]",
			Description: "制定一份积分储蓄月计划，每周记录收支并达成储蓄目标。",
			RecommendedStages: 3, EstimatedDays: 30, PointsReward: 100, Icon: "piggy-bank", IsActive: true,
		},
		{
			Title: "大额兑换冲刺", Category: "financial_literacy", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[2,4,3]",
			Description: "为心仪的大额兑换物品制定3周积分冲刺计划，并完成兑换。",
			RecommendedStages: 3, EstimatedDays: 21, PointsReward: 200, Icon: "target", IsActive: true,
		},
		{
			Title: "家庭超市预算", Category: "financial_literacy", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[2,4,1]",
			Description: "主导制定一次家庭超市采购预算清单，并完成实际采购与对比复盘。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 200, Icon: "shopping-cart", IsActive: true,
		},
		{
			Title: "跳蚤市场体验", Category: "financial_literacy", DifficultyLevel: 2,
			MinGrade: 1, MaxGrade: 6, PrimaryDimIDs: "[5,2,4,3]",
			Description: "在跳蚤市场摆摊出售闲置物品，记录定价策略、交易过程与利润用途。",
			RecommendedStages: 3, EstimatedDays: 7, PointsReward: 200, Icon: "store", IsActive: true,
		},
		{
			Title: "慈善捐赠计划", Category: "financial_literacy", DifficultyLevel: 3,
			MinGrade: 2, MaxGrade: 6, PrimaryDimIDs: "[5,2,4]",
			Description: "用一部分积分余额策划一次定向慈善捐赠，并撰写捐赠说明与感谢反馈。",
			RecommendedStages: 4, EstimatedDays: 14, PointsReward: 300, Icon: "heart", IsActive: true,
		},
		{
			Title: "家庭投资游戏", Category: "financial_literacy", DifficultyLevel: 3,
			MinGrade: 2, MaxGrade: 6, PrimaryDimIDs: "[4,2,5]",
			Description: "组织一场家庭模拟投资游戏，记录决策逻辑、收益对比与复盘反思。",
			RecommendedStages: 4, EstimatedDays: 14, PointsReward: 300, Icon: "trending-up", IsActive: true,
		},
		{
			Title: "月度消费复盘", Category: "financial_literacy", DifficultyLevel: 4,
			MinGrade: 3, MaxGrade: 6, PrimaryDimIDs: "[4,2,1]",
			Description: "对家庭一月消费数据进行分类整理与可视化，输出复盘报告与下月优化建议。",
			RecommendedStages: 4, EstimatedDays: 30, PointsReward: 400, Icon: "bar-chart", IsActive: true,
		},
	}

	for i := range templates {
		if err := db.Create(&templates[i]).Error; err != nil {
			return err
		}
	}
	log.Printf("已创建 %d 条大师挑战模板", len(templates))
	return nil
}
