package database

import (
	"log"

	"growpocket/internal/model"

	"gorm.io/gorm"
)

// seedHabit 预置习惯库（6 个年龄段 × 9 个类别，共 66 条预设习惯）
// 幂等逻辑：按 Title + FamilyID=0 查找，存在则更新 Description/Category/AgeMin/AgeMax，不存在则创建
func seedHabit(db *gorm.DB) error {
	habits := []model.Habit{
		// ============ 3-4 岁（AgeMin=3, AgeMax=4） ============
		{FamilyID: 0, ChildID: 0, Title: "自己穿鞋子", Description: "学习分辨左右脚，独立完成穿脱鞋子。", Category: "life", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "收拾玩具", Description: "玩耍结束后将玩具归类放回收纳箱。", Category: "chore", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "洗手", Description: "饭前便后用流水和肥皂认真洗手。", Category: "life", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "分享玩具", Description: "愿意与同伴分享自己的玩具，体验分享的快乐。", Category: "social", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "不碰热水", Description: "识别热水危险，不擅自触碰热水壶与水龙头热水。", Category: "safety", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "自己吃饭", Description: "独立使用勺子或叉子完成进餐。", Category: "life", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "扔垃圾", Description: "将垃圾扔进垃圾桶，不随手丢弃。", Category: "chore", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "说请和谢谢", Description: "在请求帮助和接受帮助时使用礼貌用语。", Category: "social", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "早睡早起", Description: "按时上床睡觉和起床，建立规律作息。", Category: "life", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "涂鸦画画", Description: "用蜡笔或彩笔自由涂鸦，发展手部精细动作。", Category: "craft", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "跟着音乐做操", Description: "跟随音乐节奏做简单的肢体动作。", Category: "sports", AgeMin: 3, AgeMax: 4, IsCustom: false, IsActive: true},

		// ============ 5-6 岁（AgeMin=5, AgeMax=6） ============
		{FamilyID: 0, ChildID: 0, Title: "自己叠被子", Description: "起床后尝试折叠整理自己的被子。", Category: "life", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "帮忙摆碗筷", Description: "餐前协助摆放碗筷与餐具。", Category: "chore", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "刷牙洗脸", Description: "早晚独立完成刷牙和洗脸。", Category: "life", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "画画涂色", Description: "在轮廓内涂色，培养色彩感知与专注力。", Category: "craft", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "主动问好", Description: "见到长辈和同伴主动打招呼问好。", Category: "social", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "系鞋带", Description: "学习并独立完成系鞋带。", Category: "life", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "绘本阅读", Description: "每日与家长共读一本绘本并复述故事。", Category: "study", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "认识红绿灯", Description: "了解红绿灯含义，过马路走斑马线。", Category: "safety", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "帮忙浇花", Description: "定时为家中植物浇水。", Category: "chore", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "骑平衡车", Description: "练习骑平衡车或带辅助轮的自行车，锻炼平衡感。", Category: "sports", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "自己穿衣", Description: "独立完成穿脱上衣与裤子，分辨前后。", Category: "life", AgeMin: 5, AgeMax: 6, IsCustom: false, IsActive: true},

		// ============ 7-8 岁（AgeMin=7, AgeMax=8） ============
		{FamilyID: 0, ChildID: 0, Title: "整理书包", Description: "按课程表独立整理书包，备齐学习用品。", Category: "study", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "扫地", Description: "使用扫把清扫地面并归拢垃圾。", Category: "chore", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "做三明治", Description: "在家长指导下制作简单的三明治。", Category: "cooking", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "跳绳", Description: "每日练习跳绳，逐步提升连续跳跃次数。", Category: "sports", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "过马路看灯", Description: "过马路前观察红绿灯和来往车辆，确认安全后通过。", Category: "safety", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "自己洗头", Description: "独立完成洗头并冲洗干净。", Category: "life", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "折纸", Description: "跟随图解完成简单的折纸作品。", Category: "craft", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "每日阅读20分钟", Description: "每天坚持课外阅读 20 分钟并复述大意。", Category: "study", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "主动问好道别", Description: "见到熟人主动问好，离开时礼貌道别。", Category: "social", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "帮忙收衣服", Description: "将晾干的衣物取下并分类叠好。", Category: "chore", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "做水果沙拉", Description: "清洗水果并切块拌成沙拉。", Category: "cooking", AgeMin: 7, AgeMax: 8, IsCustom: false, IsActive: true},

		// ============ 9-10 岁（AgeMin=9, AgeMax=10） ============
		{FamilyID: 0, ChildID: 0, Title: "每日阅读30分钟", Description: "每天坚持课外阅读 30 分钟并做摘抄笔记。", Category: "study", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "洗碗", Description: "餐后清洗碗筷并沥干归位。", Category: "chore", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "煎鸡蛋", Description: "在家长看护下独立煎制鸡蛋。", Category: "cooking", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "骑自行车", Description: "熟练骑行两轮自行车并遵守交通规则。", Category: "sports", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "折纸进阶", Description: "完成中等难度的折纸作品，如千纸鹤、纸花。", Category: "craft", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "独自上学安全", Description: "熟悉上学路线，掌握途中避险与求助方法。", Category: "safety", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "写日记", Description: "每周写 2-3 篇日记，记录生活与感受。", Category: "study", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "帮忙拖地", Description: "使用拖把清洁地面并拧干水分。", Category: "chore", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "煮面条", Description: "独立煮制一碗简单的面条并调味。", Category: "cooking", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "与同学合作", Description: "在小组任务中主动分工、倾听并配合同伴。", Category: "social", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "整理书桌", Description: "每日整理书桌，保持学习区域整洁有序。", Category: "life", AgeMin: 9, AgeMax: 10, IsCustom: false, IsActive: true},

		// ============ 11-12 岁（AgeMin=11, AgeMax=12） ============
		{FamilyID: 0, ChildID: 0, Title: "做作业不催", Description: "自主规划作业时间，无需家长督促即可完成。", Category: "study", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "独自买菜", Description: "在小区附近独立完成一次食材采购。", Category: "cooking", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "跑步锻炼", Description: "每周坚持跑步 3 次，每次不少于 15 分钟。", Category: "sports", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "照顾宠物", Description: "负责宠物的喂食、清洁与陪伴。", Category: "social", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "用刀安全", Description: "正确使用刀具切菜，掌握安全握法与收纳。", Category: "safety", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "简单缝补", Description: "学习针线基础，完成纽扣缝补与简单破洞修补。", Category: "craft", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "自己洗衣服", Description: "独立完成衣物的手洗与机洗晾晒。", Category: "life", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "制定学习计划", Description: "每周制定学习计划并执行复盘。", Category: "study", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "煮米饭", Description: "量米、淘米、加水并用电饭煲煮出软硬适中的米饭。", Category: "cooking", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "邻里互助", Description: "主动帮助邻居做力所能及的小事。", Category: "social", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "整理房间", Description: "每周彻底整理房间，分类收纳物品。", Category: "chore", AgeMin: 11, AgeMax: 12, IsCustom: false, IsActive: true},

		// ============ 13+ 岁（AgeMin=13, AgeMax=99） ============
		{FamilyID: 0, ChildID: 0, Title: "炒菜基础", Description: "掌握 2-3 道家常菜的炒制方法。", Category: "cooking", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "时间管理", Description: "使用日历或待办工具规划学习与生活，提升效率。", Category: "study", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "健身锻炼", Description: "每周进行 3 次有计划的健身训练。", Category: "sports", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "社区志愿服务", Description: "每月参与一次社区或公益志愿活动。", Category: "social", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "急救常识", Description: "学习并掌握心肺复苏、止血包扎等基础急救技能。", Category: "safety", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "木工小制作", Description: "用简单木工工具完成一件实用小物件。", Category: "craft", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "网络安全意识", Description: "识别网络诈骗与不良信息，保护个人隐私。", Category: "safety", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "烹饪完整一餐", Description: "独立为家人准备一餐两菜一汤的饭菜。", Category: "cooking", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "财务记账", Description: "记录个人收支并每月做一次财务复盘。", Category: "study", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "团队协作", Description: "在团队项目中承担角色职责，推动目标达成。", Category: "social", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
		{FamilyID: 0, ChildID: 0, Title: "家电使用安全", Description: "正确使用家用电器并掌握断电应急处理。", Category: "safety", AgeMin: 13, AgeMax: 99, IsCustom: false, IsActive: true},
	}

	for i := range habits {
		var existing model.Habit
		err := db.Where("title = ? AND family_id = 0", habits[i].Title).First(&existing).Error
		if err == nil {
			// 存在则更新 Description/Category/AgeMin/AgeMax
			if err := db.Model(&existing).Updates(map[string]interface{}{
				"description": habits[i].Description,
				"category":    habits[i].Category,
				"age_min":     habits[i].AgeMin,
				"age_max":     habits[i].AgeMax,
			}).Error; err != nil {
				return err
			}
		} else if err == gorm.ErrRecordNotFound {
			// 不存在则创建
			if err := db.Create(&habits[i]).Error; err != nil {
				return err
			}
		} else {
			return err
		}
	}
	log.Printf("已处理 %d 条预设习惯", len(habits))
	return nil
}
