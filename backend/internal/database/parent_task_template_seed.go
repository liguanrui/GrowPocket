package database

import (
	"log"

	"growpocket/internal/model"

	"gorm.io/gorm"
)

// seedParentTaskTemplate 预置主题任务模板库（6 个年龄段 × 6 个类别，共 36 条）
// 类别：family_creation/creative/community/financial/nature/craft
// 幂等逻辑：按 Title + FamilyID=0 查找，存在则更新，不存在则创建
// KeyMilestones 为 JSON 字符串，格式：[{"title":"...","days":1,"is_key":true}]
func seedParentTaskTemplate(db *gorm.DB) error {
	templates := []model.ParentTaskTemplate{
		// ============ 3-4 岁（AgeMin=3, AgeMax=4） ============
		{
			FamilyID: 0, ChildID: 0, Title: "我的小花园", Description: "在阳台用小花盆种下易于生长的植物，每日浇水观察。", Category: "nature",
			AgeMin: 3, AgeMax: 4, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"准备花盆与种子","days":1,"is_key":true},{"title":"播种","days":2,"is_key":true},{"title":"第一次浇水","days":3,"is_key":false},{"title":"发芽观察","days":7,"is_key":false},{"title":"开花/收获","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "家庭照片墙", Description: "与家长一起挑选照片并布置一面家庭照片墙。", Category: "family_creation",
			AgeMin: 3, AgeMax: 4, EstimatedDays: 7, IsCustom: false,
			KeyMilestones: `[{"title":"挑选照片","days":1,"is_key":true},{"title":"冲洗打印","days":3,"is_key":false},{"title":"布置照片墙","days":5,"is_key":true},{"title":"分享故事","days":7,"is_key":false}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "树叶贴画", Description: "收集不同形状的落叶，拼贴成一幅创意画。", Category: "creative",
			AgeMin: 3, AgeMax: 4, EstimatedDays: 7, IsCustom: false,
			KeyMilestones: `[{"title":"收集树叶","days":1,"is_key":true},{"title":"整理压平","days":3,"is_key":false},{"title":"拼贴创作","days":5,"is_key":true},{"title":"作品展示","days":7,"is_key":false}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "亲子手印画", Description: "用亲子手印组合创作一幅纪念画并装裱。", Category: "craft",
			AgeMin: 3, AgeMax: 4, EstimatedDays: 7, IsCustom: false,
			KeyMilestones: `[{"title":"准备颜料","days":1,"is_key":true},{"title":"按手印","days":2,"is_key":true},{"title":"添画装饰","days":4,"is_key":false},{"title":"装裱完成","days":7,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "零食存钱罐", Description: "用一周时间把零食钱省下并存入存钱罐，培养储蓄意识。", Category: "financial",
			AgeMin: 3, AgeMax: 4, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"准备存钱罐","days":1,"is_key":true},{"title":"第一次存入","days":2,"is_key":true},{"title":"中途记录","days":7,"is_key":false},{"title":"清点总额","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "邻居小朋友分享会", Description: "邀请邻居小朋友来家里分享玩具与零食。", Category: "community",
			AgeMin: 3, AgeMax: 4, EstimatedDays: 7, IsCustom: false,
			KeyMilestones: `[{"title":"制作邀请卡","days":1,"is_key":true},{"title":"准备分享物","days":3,"is_key":false},{"title":"分享会进行","days":5,"is_key":true},{"title":"感谢与回顾","days":7,"is_key":false}]`,
		},

		// ============ 5-6 岁（AgeMin=5, AgeMax=6） ============
		{
			FamilyID: 0, ChildID: 0, Title: "阳台小花圃", Description: "在阳台规划一小块花圃，种植 2-3 种植物并记录生长。", Category: "nature",
			AgeMin: 5, AgeMax: 6, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"规划花圃","days":1,"is_key":true},{"title":"播种与培土","days":2,"is_key":true},{"title":"日常养护","days":7,"is_key":false},{"title":"生长记录","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "家庭绘本共创", Description: "孩子口述故事，家长配文，孩子配图，共同完成一本绘本。", Category: "family_creation",
			AgeMin: 5, AgeMax: 6, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"构思故事","days":1,"is_key":true},{"title":"分页脚本","days":3,"is_key":false},{"title":"绘制插画","days":7,"is_key":true},{"title":"装订成册","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "旧玩具义卖", Description: "整理闲置玩具，在小区义卖并将所得捐给公益。", Category: "community",
			AgeMin: 5, AgeMax: 6, EstimatedDays: 7, IsCustom: false,
			KeyMilestones: `[{"title":"整理玩具","days":1,"is_key":true},{"title":"定价与海报","days":2,"is_key":false},{"title":"义卖进行","days":5,"is_key":true},{"title":"捐赠与复盘","days":7,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "零花钱日记", Description: "用两周时间记录零花钱收入与支出，学习基本记账。", Category: "financial",
			AgeMin: 5, AgeMax: 6, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"准备记账本","days":1,"is_key":true},{"title":"每日记录","days":2,"is_key":false},{"title":"中期汇总","days":7,"is_key":true},{"title":"期末复盘","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "纸盒小屋", Description: "利用废旧纸盒搭建一座小屋模型，可作玩偶之家。", Category: "craft",
			AgeMin: 5, AgeMax: 6, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"收集纸盒","days":1,"is_key":true},{"title":"设计草图","days":2,"is_key":false},{"title":"搭建结构","days":7,"is_key":true},{"title":"装饰完成","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "自然声音收集", Description: "用手机录制身边的自然声音，制作一份声音地图。", Category: "creative",
			AgeMin: 5, AgeMax: 6, EstimatedDays: 7, IsCustom: false,
			KeyMilestones: `[{"title":"准备设备","days":1,"is_key":true},{"title":"户外录音","days":2,"is_key":true},{"title":"整理分类","days":5,"is_key":false},{"title":"声音展示","days":7,"is_key":true}]`,
		},

		// ============ 7-8 岁（AgeMin=7, AgeMax=8） ============
		{
			FamilyID: 0, ChildID: 0, Title: "社区图书角", Description: "在楼栋或社区筹建一个共享图书角，制定借阅规则。", Category: "community",
			AgeMin: 7, AgeMax: 8, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"选址与征集","days":1,"is_key":true},{"title":"书目整理","days":5,"is_key":false},{"title":"制定规则","days":10,"is_key":true},{"title":"正式开放","days":14,"is_key":true},{"title":"运营复盘","days":21,"is_key":false}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "零花钱记账", Description: "每日记录零花钱收支并分类，月末输出一份简单报表。", Category: "financial",
			AgeMin: 7, AgeMax: 8, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"建立账本","days":1,"is_key":true},{"title":"每日记账","days":2,"is_key":false},{"title":"中期分类","days":7,"is_key":true},{"title":"月度报表","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "阳台种植", Description: "在阳台种植番茄或辣椒，全程记录从播种到结果。", Category: "nature",
			AgeMin: 7, AgeMax: 8, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"选种与播种","days":1,"is_key":true},{"title":"发芽观察","days":5,"is_key":false},{"title":"移栽定植","days":10,"is_key":true},{"title":"开花结果","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "家庭厨艺日", Description: "每周一次家庭厨艺日，孩子负责一道简单菜品。", Category: "family_creation",
			AgeMin: 7, AgeMax: 8, EstimatedDays: 7, IsCustom: false,
			KeyMilestones: `[{"title":"选定菜谱","days":1,"is_key":true},{"title":"采购食材","days":2,"is_key":false},{"title":"下厨烹饪","days":5,"is_key":true},{"title":"家人品评","days":7,"is_key":false}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "手工贺卡", Description: "为节日或家人制作一套手工贺卡并赠送。", Category: "craft",
			AgeMin: 7, AgeMax: 8, EstimatedDays: 7, IsCustom: false,
			KeyMilestones: `[{"title":"设计贺卡","days":1,"is_key":true},{"title":"准备材料","days":2,"is_key":false},{"title":"制作贺卡","days":4,"is_key":true},{"title":"赠送亲友","days":7,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "短视频日记", Description: "用手机拍摄一周生活短视频，剪辑成一支日记短片。", Category: "creative",
			AgeMin: 7, AgeMax: 8, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"策划主题","days":1,"is_key":true},{"title":"每日拍摄","days":2,"is_key":false},{"title":"剪辑成片","days":10,"is_key":true},{"title":"家庭首映","days":14,"is_key":true}]`,
		},

		// ============ 9-10 岁（AgeMin=9, AgeMax=10） ============
		{
			FamilyID: 0, ChildID: 0, Title: "家庭运动会策划", Description: "孩子主导策划一场家庭趣味运动会，含项目设计与颁奖。", Category: "family_creation",
			AgeMin: 9, AgeMax: 10, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"项目设计","days":1,"is_key":true},{"title":"场地与道具","days":3,"is_key":false},{"title":"规则手册","days":5,"is_key":true},{"title":"运动会执行","days":10,"is_key":true},{"title":"颁奖复盘","days":14,"is_key":false}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "校园公益义卖", Description: "在校园内发起一次公益义卖，所得捐赠指定项目。", Category: "community",
			AgeMin: 9, AgeMax: 10, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"方案与立项","days":1,"is_key":true},{"title":"物资募集","days":5,"is_key":false},{"title":"宣传推广","days":10,"is_key":true},{"title":"义卖执行","days":15,"is_key":true},{"title":"捐赠与复盘","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "储蓄目标计划", Description: "为一件心仪物品制定 3 周储蓄计划并完成兑换。", Category: "financial",
			AgeMin: 9, AgeMax: 10, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"设定目标","days":1,"is_key":true},{"title":"储蓄计划","days":2,"is_key":false},{"title":"中期检查","days":10,"is_key":true},{"title":"达成兑换","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "阳台菜园初体验", Description: "在阳台种植生菜与小葱，体验从种植到餐桌。", Category: "nature",
			AgeMin: 9, AgeMax: 10, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"选种与播种","days":1,"is_key":true},{"title":"日常养护","days":7,"is_key":false},{"title":"间苗与施肥","days":14,"is_key":true},{"title":"采摘食用","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "手工编织", Description: "学习简单编织技巧，完成一条围巾或杯垫。", Category: "craft",
			AgeMin: 9, AgeMax: 10, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"学习基础针法","days":1,"is_key":true},{"title":"起针练习","days":3,"is_key":false},{"title":"正式编织","days":7,"is_key":true},{"title":"收针完成","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "家乡美食地图", Description: "调研并绘制一张家乡美食地图，配图文介绍。", Category: "creative",
			AgeMin: 9, AgeMax: 10, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"美食调研","days":1,"is_key":true},{"title":"实地探访","days":5,"is_key":false},{"title":"绘制地图","days":10,"is_key":true},{"title":"图文成册","days":14,"is_key":true}]`,
		},

		// ============ 11-12 岁（AgeMin=11, AgeMax=12） ============
		{
			FamilyID: 0, ChildID: 0, Title: "家庭厨艺周", Description: "用一周时间为家人准备每日一道菜，并完成一本家庭菜谱。", Category: "family_creation",
			AgeMin: 11, AgeMax: 12, EstimatedDays: 14, IsCustom: false,
			KeyMilestones: `[{"title":"菜单设计","days":1,"is_key":true},{"title":"采购与备料","days":2,"is_key":false},{"title":"每日一菜","days":7,"is_key":true},{"title":"菜谱整理","days":14,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "手工义卖", Description: "制作手工制品进行义卖，所得捐赠公益机构。", Category: "community",
			AgeMin: 11, AgeMax: 12, EstimatedDays: 28, IsCustom: false,
			KeyMilestones: `[{"title":"作品设计","days":1,"is_key":true},{"title":"批量制作","days":7,"is_key":false},{"title":"宣传预售","days":14,"is_key":true},{"title":"义卖执行","days":21,"is_key":true},{"title":"捐赠复盘","days":28,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "储蓄计划", Description: "制定 3 周零花钱储蓄计划，并尝试简单的预算分配。", Category: "financial",
			AgeMin: 11, AgeMax: 12, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"预算制定","days":1,"is_key":true},{"title":"分类储蓄","days":2,"is_key":false},{"title":"中期复盘","days":10,"is_key":true},{"title":"期末结算","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "屋顶花园", Description: "在屋顶或阳台搭建一处花园，种植观赏与食用植物。", Category: "nature",
			AgeMin: 11, AgeMax: 12, EstimatedDays: 28, IsCustom: false,
			KeyMilestones: `[{"title":"空间规划","days":1,"is_key":true},{"title":"搭建花架","days":5,"is_key":false},{"title":"分批种植","days":10,"is_key":true},{"title":"养护记录","days":21,"is_key":false},{"title":"开花结果","days":28,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "木工小制作", Description: "学习基础木工，完成一件实用的小木制品。", Category: "craft",
			AgeMin: 11, AgeMax: 12, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"学习工具","days":1,"is_key":true},{"title":"设计图纸","days":3,"is_key":false},{"title":"加工制作","days":10,"is_key":true},{"title":"打磨上漆","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "城市观察笔记", Description: "连续 3 周观察并记录城市某一角落的变化，输出图文笔记。", Category: "creative",
			AgeMin: 11, AgeMax: 12, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"选定主题","days":1,"is_key":true},{"title":"每周观察","days":7,"is_key":false},{"title":"资料整理","days":14,"is_key":true},{"title":"笔记成册","days":21,"is_key":true}]`,
		},

		// ============ 13+ 岁（AgeMin=13, AgeMax=99） ============
		{
			FamilyID: 0, ChildID: 0, Title: "阳台菜园", Description: "在阳台搭建系统化菜园，实现 4 周内自给部分蔬菜。", Category: "nature",
			AgeMin: 13, AgeMax: 99, EstimatedDays: 28, IsCustom: false,
			KeyMilestones: `[{"title":"系统设计","days":1,"is_key":true},{"title":"搭建与播种","days":5,"is_key":true},{"title":"养护管理","days":14,"is_key":false},{"title":"首次采收","days":21,"is_key":true},{"title":"持续优化","days":28,"is_key":false}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "短视频记录家乡", Description: "围绕家乡主题拍摄并剪辑一支 3-5 分钟短视频。", Category: "creative",
			AgeMin: 13, AgeMax: 99, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"选题与脚本","days":1,"is_key":true},{"title":"实地拍摄","days":7,"is_key":true},{"title":"剪辑初版","days":14,"is_key":true},{"title":"发布分享","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "社区志愿服务", Description: "在社区开展为期 3 周的志愿服务，如敬老陪伴或环境维护。", Category: "community",
			AgeMin: 13, AgeMax: 99, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"联系机构","days":1,"is_key":true},{"title":"制定计划","days":3,"is_key":false},{"title":"每周服务","days":7,"is_key":true},{"title":"中期反馈","days":14,"is_key":false},{"title":"总结报告","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "家庭月度预算", Description: "主导制定家庭一月预算方案并跟踪执行情况。", Category: "family_creation",
			AgeMin: 13, AgeMax: 99, EstimatedDays: 21, IsCustom: false,
			KeyMilestones: `[{"title":"预算方案","days":1,"is_key":true},{"title":"分类明细","days":3,"is_key":false},{"title":"执行跟踪","days":7,"is_key":true},{"title":"中期调整","days":14,"is_key":false},{"title":"月度复盘","days":21,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "个人理财规划", Description: "制定 4 周个人理财规划，含储蓄、预算与简单投资模拟。", Category: "financial",
			AgeMin: 13, AgeMax: 99, EstimatedDays: 28, IsCustom: false,
			KeyMilestones: `[{"title":"财务盘点","days":1,"is_key":true},{"title":"规划制定","days":3,"is_key":false},{"title":"执行储蓄","days":7,"is_key":true},{"title":"投资模拟","days":14,"is_key":true},{"title":"期末复盘","days":28,"is_key":true}]`,
		},
		{
			FamilyID: 0, ChildID: 0, Title: "手工皮具制作", Description: "学习基础皮艺，完成一件皮具作品如卡包或钥匙扣。", Category: "craft",
			AgeMin: 13, AgeMax: 99, EstimatedDays: 28, IsCustom: false,
			KeyMilestones: `[{"title":"学习基础","days":1,"is_key":true},{"title":"设计与裁切","days":5,"is_key":false},{"title":"缝制成型","days":14,"is_key":true},{"title":"打磨封边","days":21,"is_key":false},{"title":"成品完成","days":28,"is_key":true}]`,
		},
	}

	for i := range templates {
		var existing model.ParentTaskTemplate
		err := db.Where("title = ? AND family_id = 0", templates[i].Title).First(&existing).Error
		if err == nil {
			// 存在则更新
			if err := db.Model(&existing).Updates(map[string]interface{}{
				"description":     templates[i].Description,
				"category":        templates[i].Category,
				"age_min":         templates[i].AgeMin,
				"age_max":         templates[i].AgeMax,
				"estimated_days":  templates[i].EstimatedDays,
				"key_milestones":  templates[i].KeyMilestones,
			}).Error; err != nil {
				return err
			}
		} else if err == gorm.ErrRecordNotFound {
			// 不存在则创建
			if err := db.Create(&templates[i]).Error; err != nil {
				return err
			}
		} else {
			return err
		}
	}
	log.Printf("已处理 %d 条预设主题任务模板", len(templates))
	return nil
}
