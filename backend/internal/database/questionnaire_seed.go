package database

import (
	"encoding/json"
	"log"

	"growpocket/internal/model"

	"gorm.io/gorm"
)

// seedQuestionnaires 预置问卷：3 个通用阶段 + 6 档分龄注册问卷
// 按 stage+level 缺失补齐，已有数据不会被重复插入
func seedQuestionnaires(db *gorm.DB) error {
	type seedItem struct {
		stage, level, title string
		questions            string
	}

	// 构建全部种子项
	items := []seedItem{}
	registerQuestions := toJSON(buildQuestions(1, 6))
	weeklyQuestions := toJSON(buildQuestions(1, 6))
	reviewQuestions := toJSON(buildQuestions(2, 6))
	items = append(items,
		seedItem{"register", "", "初始能力评估", registerQuestions},
		seedItem{"weekly", "", "每周能力更新", weeklyQuestions},
		seedItem{"review", "", "阶段回顾评估", reviewQuestions},
	)
	for _, levelData := range buildLeveledQuestions() {
		items = append(items, seedItem{"register", levelData.level, levelData.title, toJSON(levelData.questions)})
	}

	created := 0
	for _, it := range items {
		// 按 stage+level 检查是否已存在（level 为空时匹配空串或 NULL）
		var existing model.Questionnaire
		query := db.Where("stage = ?", it.stage)
		if it.level == "" {
			query = query.Where("level = '' OR level IS NULL")
		} else {
			query = query.Where("level = ?", it.level)
		}
		if err := query.First(&existing).Error; err == nil {
			continue // 已存在，跳过
		}
		// 不存在，创建
		q := model.Questionnaire{
			Stage:     it.stage,
			Level:     it.level,
			Title:     it.title,
			Questions: it.questions,
		}
		if err := db.Create(&q).Error; err != nil {
			return err
		}
		created++
	}
	if created > 0 {
		log.Printf("已补齐 %d 份问卷（含 6 档分龄）", created)
	}
	return nil
}

type leveledQuestionData struct {
	level     string
	title     string
	questions []map[string]interface{}
}

// buildQuestions 构建题目列表：perDim 每维度题数，totalDims 维度总数
func buildQuestions(perDim int, totalDims int) []map[string]interface{} {
	// 题库：每维度 2 题
	allQuestions := map[int][]map[string]interface{}{
		1: { // 生活自理
			{"question": "周末早上起床后，你会自己整理床铺吗？", "options": []map[string]interface{}{{"text": "每天都会整理", "score": 5}, {"text": "偶尔会整理", "score": 3}, {"text": "很少整理", "score": 1}}},
			{"question": "你会自己整理书包和书桌吗？", "options": []map[string]interface{}{{"text": "总是自己整理", "score": 5}, {"text": "有时需要提醒", "score": 3}, {"text": "基本不整理", "score": 1}}},
		},
		2: { // 独立自主
			{"question": "遇到不会的作业，你会怎么做？", "options": []map[string]interface{}{{"text": "先自己思考再求助", "score": 5}, {"text": "马上问家长", "score": 3}, {"text": "直接放弃", "score": 1}}},
			{"question": "周末的时间你会如何安排？", "options": []map[string]interface{}{{"text": "自己制定计划", "score": 5}, {"text": "家长帮忙安排", "score": 3}, {"text": "随意度过", "score": 1}}},
		},
		3: { // 动手实践
			{"question": "周末妈妈让你帮忙做饭，你会？", "options": []map[string]interface{}{{"text": "独立完成简单菜品", "score": 5}, {"text": "帮忙洗菜切菜", "score": 3}, {"text": "在旁边看着", "score": 1}}},
			{"question": "你会自己动手制作手工或修理物品吗？", "options": []map[string]interface{}{{"text": "经常动手制作", "score": 5}, {"text": "偶尔尝试", "score": 3}, {"text": "几乎不会", "score": 1}}},
		},
		4: { // 学习认知
			{"question": "放学后你会主动完成作业吗？", "options": []map[string]interface{}{{"text": "主动完成", "score": 5}, {"text": "需要提醒", "score": 3}, {"text": "很不情愿", "score": 1}}},
			{"question": "你会主动阅读课外书吗？", "options": []map[string]interface{}{{"text": "经常阅读", "score": 5}, {"text": "偶尔阅读", "score": 3}, {"text": "基本不读", "score": 1}}},
		},
		5: { // 社交情感
			{"question": "和同学发生矛盾时，你会？", "options": []map[string]interface{}{{"text": "主动沟通解决", "score": 5}, {"text": "等对方先开口", "score": 3}, {"text": "不再理对方", "score": 1}}},
			{"question": "朋友难过时，你会？", "options": []map[string]interface{}{{"text": "主动安慰", "score": 5}, {"text": "陪在旁边", "score": 3}, {"text": "不知道怎么办", "score": 1}}},
		},
		6: { // 身心健康
			{"question": "你每天会运动多长时间？", "options": []map[string]interface{}{{"text": "1小时以上", "score": 5}, {"text": "30分钟左右", "score": 3}, {"text": "基本不运动", "score": 1}}},
			{"question": "你晚上几点睡觉？", "options": []map[string]interface{}{{"text": "9点前", "score": 5}, {"text": "10点前", "score": 3}, {"text": "11点后", "score": 1}}},
		},
	}

	var result []map[string]interface{}
	id := 1
	for dimID := 1; dimID <= totalDims; dimID++ {
		qs := allQuestions[dimID]
		for i := 0; i < perDim && i < len(qs); i++ {
			q := qs[i]
			q["id"] = id
			q["dimension_id"] = dimID
			result = append(result, q)
			id++
		}
	}
	return result
}

// toJSON 序列化为 JSON 字符串
func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// mkQ 构建单题 map（便捷函数）
func mkQ(id, dimID int, question string, opts [3][2]interface{}) map[string]interface{} {
	options := make([]map[string]interface{}, 0, 3)
	for _, o := range opts {
		options = append(options, map[string]interface{}{"text": o[0], "score": o[1]})
	}
	return map[string]interface{}{
		"id":            id,
		"dimension_id":  dimID,
		"question":      question,
		"options":       options,
	}
}

// buildLeveledQuestions 构建 6 档分龄注册题库（L1-L6）
func buildLeveledQuestions() []leveledQuestionData {
	return []leveledQuestionData{
		{
			level: "L1",
			title: "初始能力评估-L1(一年级)",
			questions: []map[string]interface{}{
				mkQ(101, 1, "你会自己穿衣服吗？", [3][2]interface{}{{"每天都自己穿", 5}, {"有时候自己穿", 3}, {"都是妈妈帮我穿", 1}}),
				mkQ(102, 1, "吃完饭你会自己收拾碗筷吗？", [3][2]interface{}{{"每次都会收拾", 5}, {"有时候会收拾", 3}, {"从来不会收拾", 1}}),
				mkQ(103, 1, "你会自己系鞋带吗？", [3][2]interface{}{{"很熟练", 5}, {"还在学", 3}, {"还不会", 1}}),
				mkQ(104, 2, "早上起床需要妈妈叫几次？", [3][2]interface{}{{"叫一次就起", 5}, {"要叫两三次", 3}, {"要叫很多次", 1}}),
				mkQ(105, 2, "你会自己决定今天穿什么衣服吗？", [3][2]interface{}{{"自己决定", 5}, {"妈妈给建议", 3}, {"都是妈妈选", 1}}),
				mkQ(106, 2, "东西找不到时你会怎么办？", [3][2]interface{}{{"自己慢慢找", 5}, {"找一会儿就问妈妈", 3}, {"马上叫妈妈帮忙", 1}}),
				mkQ(107, 3, "你会帮家里做简单的事情吗（比如拿东西）？", [3][2]interface{}{{"经常帮忙", 5}, {"偶尔帮忙", 3}, {"从不帮忙", 1}}),
				mkQ(108, 3, "你会用剪刀剪简单的形状吗？", [3][2]interface{}{{"剪得很好", 5}, {"还在学", 3}, {"还不会用", 1}}),
				mkQ(109, 3, "你会自己折纸或做小手工吗？", [3][2]interface{}{{"经常做", 5}, {"偶尔做", 3}, {"很少做", 1}}),
				mkQ(110, 4, "写作业时需要大人陪吗？", [3][2]interface{}{{"自己独立写", 5}, {"有时候要陪", 3}, {"每次都要陪", 1}}),
				mkQ(111, 4, "你喜欢听故事或看绘本吗？", [3][2]interface{}{{"每天都看", 5}, {"有时候看", 3}, {"很少看", 1}}),
				mkQ(112, 4, "遇到不会的字你会怎么办？", [3][2]interface{}{{"自己想办法查", 5}, {"问大人", 3}, {"就跳过去了", 1}}),
				mkQ(113, 5, "在幼儿园或学校有好朋友吗？", [3][2]interface{}{{"有好几个好朋友", 5}, {"有一两个", 3}, {"还没有", 1}}),
				mkQ(114, 5, "小朋友想玩你的玩具你会怎么办？", [3][2]interface{}{{"一起分享玩", 5}, {"看心情", 3}, {"不想给", 1}}),
				mkQ(115, 6, "你喜欢到户外跑跑跳跳吗？", [3][2]interface{}{{"每天都出去玩", 5}, {"有时候出去", 3}, {"喜欢待在家", 1}}),
				mkQ(116, 6, "晚上几点睡觉呢？", [3][2]interface{}{{"9点前就睡", 5}, {"9到10点睡", 3}, {"10点以后才睡", 1}}),
			},
		},
		{
			level: "L2",
			title: "初始能力评估-L2(二年级)",
			questions: []map[string]interface{}{
				mkQ(201, 1, "你会自己整理书包吗？", [3][2]interface{}{{"每天自己整理", 5}, {"有时候整理", 3}, {"都是妈妈整理", 1}}),
				mkQ(202, 1, "你会自己洗澡吗？", [3][2]interface{}{{"自己洗", 5}, {"妈妈帮忙", 3}, {"还不会", 1}}),
				mkQ(203, 1, "你的房间会自己收拾吗？", [3][2]interface{}{{"经常收拾", 5}, {"偶尔收拾", 3}, {"从不收拾", 1}}),
				mkQ(204, 2, "放学回家你会先做什么？", [3][2]interface{}{{"先写作业", 5}, {"看心情", 3}, {"先看电视玩玩具", 1}}),
				mkQ(205, 2, "你有自己想做的事情时，会主动告诉爸爸妈妈吗？", [3][2]interface{}{{"会主动说", 5}, {"有时候说", 3}, {"很少说", 1}}),
				mkQ(206, 2, "遇到不会的作业题你会怎么办？", [3][2]interface{}{{"自己先想想", 5}, {"直接问大人", 3}, {"就空着不写", 1}}),
				mkQ(207, 3, "你会帮忙做哪些家务呢？", [3][2]interface{}{{"经常做家务", 5}, {"偶尔帮忙", 3}, {"从不做家务", 1}}),
				mkQ(208, 3, "你会自己折衣服或叠被子吗？", [3][2]interface{}{{"叠得很好", 5}, {"还在学", 3}, {"还不会", 1}}),
				mkQ(209, 3, "你喜欢做手工或画画吗？", [3][2]interface{}{{"经常做", 5}, {"偶尔做", 3}, {"很少做", 1}}),
				mkQ(210, 4, "你能自己完成作业吗？", [3][2]interface{}{{"独立完成", 5}, {"需要一点提醒", 3}, {"需要一直陪", 1}}),
				mkQ(211, 4, "你会主动看课外书吗？", [3][2]interface{}{{"经常看", 5}, {"偶尔看", 3}, {"很少看", 1}}),
				mkQ(212, 4, "学会的新知识会和家人分享吗？", [3][2]interface{}{{"经常分享", 5}, {"问才说", 3}, {"很少说", 1}}),
				mkQ(213, 5, "和同学发生矛盾时你会怎么办？", [3][2]interface{}{{"自己想办法解决", 5}, {"找老师帮忙", 3}, {"就哭或生气", 1}}),
				mkQ(214, 5, "看到同学不开心你会怎么做？", [3][2]interface{}{{"去关心安慰", 5}, {"告诉老师", 3}, {"不关我事", 1}}),
				mkQ(215, 6, "你每天都有运动吗？", [3][2]interface{}{{"每天运动", 5}, {"有时候运动", 3}, {"很少运动", 1}}),
				mkQ(216, 6, "你会自己按时睡觉吗？", [3][2]interface{}{{"到点就睡", 5}, {"要催才睡", 3}, {"经常晚睡", 1}}),
			},
		},
		{
			level: "L3",
			title: "初始能力评估-L3(三年级)",
			questions: []map[string]interface{}{
				mkQ(301, 1, "你会自己规划每天穿什么衣服吗？", [3][2]interface{}{{"自己规划", 5}, {"参考建议", 3}, {"都是妈妈选", 1}}),
				mkQ(302, 1, "你的书桌会自己整理吗？", [3][2]interface{}{{"每天整理", 5}, {"偶尔整理", 3}, {"从不整理", 1}}),
				mkQ(303, 1, "你会自己洗头发吗？", [3][2]interface{}{{"自己洗", 5}, {"有时候自己洗", 3}, {"都是妈妈洗", 1}}),
				mkQ(304, 2, "你会自己安排周末的时间吗？", [3][2]interface{}{{"自己安排", 5}, {"和妈妈商量", 3}, {"都是妈妈安排", 1}}),
				mkQ(305, 2, "遇到困难的事情你会先尝试自己做吗？", [3][2]interface{}{{"先自己试", 5}, {"试一下就求助", 3}, {"直接求助", 1}}),
				mkQ(306, 2, "你会自己定闹钟起床吗？", [3][2]interface{}{{"自己定闹钟", 5}, {"妈妈叫醒", 3}, {"经常赖床", 1}}),
				mkQ(307, 3, "你会帮忙洗碗或扫地吗？", [3][2]interface{}{{"经常帮忙", 5}, {"偶尔帮忙", 3}, {"从不帮忙", 1}}),
				mkQ(308, 3, "你会做简单的食物吗（比如三明治、煮鸡蛋）？", [3][2]interface{}{{"会做好几种", 5}, {"会一两种", 3}, {"还不会", 1}}),
				mkQ(309, 3, "你喜欢动手做小实验或小发明吗？", [3][2]interface{}{{"经常做", 5}, {"偶尔做", 3}, {"很少做", 1}}),
				mkQ(310, 4, "写作业时会自己检查吗？", [3][2]interface{}{{"每次都检查", 5}, {"有时候检查", 3}, {"从不检查", 1}}),
				mkQ(311, 4, "遇到不懂的问题会主动查资料吗？", [3][2]interface{}{{"经常查", 5}, {"偶尔查", 3}, {"从不查", 1}}),
				mkQ(312, 4, "你会主动预习或复习功课吗？", [3][2]interface{}{{"经常预习复习", 5}, {"偶尔会", 3}, {"从来不会", 1}}),
				mkQ(313, 5, "在新环境里你会主动交朋友吗？", [3][2]interface{}{{"主动交友", 5}, {"等别人来", 3}, {"不主动交友", 1}}),
				mkQ(314, 5, "和朋友意见不合时你会怎么办？", [3][2]interface{}{{"商量解决", 5}, {"各玩各的", 3}, {"就吵架", 1}}),
				mkQ(315, 5, "你会主动帮助有困难的同学吗？", [3][2]interface{}{{"经常帮助", 5}, {"偶尔帮助", 3}, {"很少帮助", 1}}),
				mkQ(316, 6, "你每周运动几次呢？", [3][2]interface{}{{"4次以上", 5}, {"2到3次", 3}, {"0到1次", 1}}),
				mkQ(317, 6, "你觉得自己的睡眠充足吗？", [3][2]interface{}{{"很充足", 5}, {"一般", 3}, {"经常不够", 1}}),
				mkQ(318, 6, "心情不好的时候你会怎么办？", [3][2]interface{}{{"找方式调节", 5}, {"闷着", 3}, {"发脾气", 1}}),
			},
		},
		{
			level: "L4",
			title: "初始能力评估-L4(四年级)",
			questions: []map[string]interface{}{
				mkQ(401, 1, "你会自己管理零花钱吗？", [3][2]interface{}{{"有计划地花", 5}, {"有时候乱花", 3}, {"想花就花", 1}}),
				mkQ(402, 1, "你的衣物会自己清洗吗（手洗小件）？", [3][2]interface{}{{"经常自己洗", 5}, {"偶尔洗", 3}, {"从不洗", 1}}),
				mkQ(403, 1, "你会提前准备好明天要用的东西吗？", [3][2]interface{}{{"每次都准备", 5}, {"有时候准备", 3}, {"从不准备", 1}}),
				mkQ(404, 2, "你会自己制定学习计划吗？", [3][2]interface{}{{"自己制定", 5}, {"妈妈帮忙", 3}, {"没有计划", 1}}),
				mkQ(405, 2, "做决定时你会权衡利弊吗？", [3][2]interface{}{{"会想一想", 5}, {"偶尔想", 3}, {"凭感觉", 1}}),
				mkQ(406, 2, "遇到挫折你会怎么应对？", [3][2]interface{}{{"想办法克服", 5}, {"先难过再说", 3}, {"就放弃了", 1}}),
				mkQ(407, 3, "你会做哪些家务呢？", [3][2]interface{}{{"做3种以上", 5}, {"做1到2种", 3}, {"不做家务", 1}}),
				mkQ(408, 3, "你会修理简单的东西吗？", [3][2]interface{}{{"经常修", 5}, {"偶尔试", 3}, {"从不修", 1}}),
				mkQ(409, 3, "你喜欢参加手工或科技活动吗？", [3][2]interface{}{{"经常参加", 5}, {"偶尔参加", 3}, {"很少参加", 1}}),
				mkQ(410, 4, "你有自己的学习目标吗？", [3][2]interface{}{{"有明确目标", 5}, {"模糊目标", 3}, {"没有目标", 1}}),
				mkQ(411, 4, "你会做读书笔记或学习笔记吗？", [3][2]interface{}{{"经常做", 5}, {"偶尔做", 3}, {"从不做", 1}}),
				mkQ(412, 4, "遇到难题你会坚持想多久？", [3][2]interface{}{{"坚持想出来", 5}, {"想一会儿", 3}, {"很快放弃", 1}}),
				mkQ(413, 5, "你会主动和陌生人交流吗？", [3][2]interface{}{{"大方交流", 5}, {"看情况", 3}, {"不敢交流", 1}}),
				mkQ(414, 5, "朋友犯错时你会怎么做？", [3][2]interface{}{{"善意提醒", 5}, {"默默不说", 3}, {"跟着一起", 1}}),
				mkQ(415, 5, "你能察觉到别人的情绪变化吗？", [3][2]interface{}{{"很敏锐", 5}, {"有时候", 3}, {"察觉不到", 1}}),
				mkQ(416, 6, "你有自己喜欢的运动项目吗？", [3][2]interface{}{{"有且常练", 5}, {"有但少练", 3}, {"没有", 1}}),
				mkQ(417, 6, "你会主动控制看手机/电视的时间吗？", [3][2]interface{}{{"自我控制", 5}, {"要人提醒", 3}, {"控制不住", 1}}),
				mkQ(418, 6, "你会用什么方式放松心情？", [3][2]interface{}{{"运动/爱好", 5}, {"看电视", 3}, {"吃东西", 1}}),
			},
		},
		{
			level: "L5",
			title: "初始能力评估-L5(五年级)",
			questions: []map[string]interface{}{
				mkQ(501, 1, "你会自己规划一周的生活吗？", [3][2]interface{}{{"有周计划", 5}, {"大概安排", 3}, {"没有计划", 1}}),
				mkQ(502, 1, "你的居住空间会自己打理吗？", [3][2]interface{}{{"保持整洁", 5}, {"偶尔整理", 3}, {"总是乱糟糟", 1}}),
				mkQ(503, 1, "你会自己准备考试复习资料吗？", [3][2]interface{}{{"自己准备", 5}, {"妈妈帮忙", 3}, {"不准备", 1}}),
				mkQ(504, 2, "你会自己判断事情的优先级吗？", [3][2]interface{}{{"清楚判断", 5}, {"有时候", 3}, {"分不清", 1}}),
				mkQ(505, 2, "遇到多个任务时你会怎么安排？", [3][2]interface{}{{"列清单排序", 5}, {"想到什么做什么", 3}, {"随便做", 1}}),
				mkQ(506, 2, "你会反思自己的错误吗？", [3][2]interface{}{{"经常反思", 5}, {"偶尔反思", 3}, {"很少反思", 1}}),
				mkQ(507, 3, "你会独立完成一顿简单的饭菜吗？", [3][2]interface{}{{"会做", 5}, {"在学", 3}, {"不会", 1}}),
				mkQ(508, 3, "你会参与家里的采购决策吗？", [3][2]interface{}{{"经常参与", 5}, {"偶尔参与", 3}, {"从不参与", 1}}),
				mkQ(509, 3, "你喜欢自己动手解决问题而不是买现成的吗？", [3][2]interface{}{{"喜欢动手", 5}, {"看情况", 3}, {"买现成", 1}}),
				mkQ(510, 4, "你会主动寻找课外知识吗？", [3][2]interface{}{{"经常找", 5}, {"偶尔找", 3}, {"从不找", 1}}),
				mkQ(511, 4, "你有自己的学习方法吗？", [3][2]interface{}{{"有方法", 5}, {"还在摸索", 3}, {"没有方法", 1}}),
				mkQ(512, 4, "遇到和老师不同的观点你会怎么做？", [3][2]interface{}{{"思考后讨论", 5}, {"默默接受", 3}, {"不理会", 1}}),
				mkQ(513, 5, "你能在团队中承担领导角色吗？", [3][2]interface{}{{"经常承担", 5}, {"偶尔承担", 3}, {"从不承担", 1}}),
				mkQ(514, 5, "朋友遇到烦恼会找你倾诉吗？", [3][2]interface{}{{"经常找我", 5}, {"有时候", 3}, {"从不找我", 1}}),
				mkQ(515, 5, "你能控制自己的情绪吗？", [3][2]interface{}{{"控制很好", 5}, {"有时候失控", 3}, {"经常失控", 1}}),
				mkQ(516, 6, "你有规律的作息时间吗？", [3][2]interface{}{{"很规律", 5}, {"有时候乱", 3}, {"很不规律", 1}}),
				mkQ(517, 6, "你会主动关注自己的健康状况吗？", [3][2]interface{}{{"经常关注", 5}, {"偶尔关注", 3}, {"不关注", 1}}),
				mkQ(518, 6, "压力大时你会怎么缓解？", [3][2]interface{}{{"运动/倾诉", 5}, {"玩游戏", 3}, {"闷着", 1}}),
			},
		},
		{
			level: "L6",
			title: "初始能力评估-L6(六年级)",
			questions: []map[string]interface{}{
				mkQ(601, 1, "你会自己管理每月的零花钱吗？", [3][2]interface{}{{"有预算", 5}, {"大概规划", 3}, {"没有规划", 1}}),
				mkQ(602, 1, "你会自己处理个人卫生和健康管理吗？", [3][2]interface{}{{"自己管理", 5}, {"需要提醒", 3}, {"从不管理", 1}}),
				mkQ(603, 1, "你会提前为升学做准备吗？", [3][2]interface{}{{"主动准备", 5}, {"妈妈提醒", 3}, {"没有准备", 1}}),
				mkQ(604, 2, "你会自己制定长期目标吗？", [3][2]interface{}{{"有长期目标", 5}, {"短期目标", 3}, {"没有目标", 1}}),
				mkQ(605, 2, "做重要决定时你会收集信息分析吗？", [3][2]interface{}{{"充分分析", 5}, {"简单了解", 3}, {"凭直觉", 1}}),
				mkQ(606, 2, "你会自我监督学习进度吗？", [3][2]interface{}{{"经常监督", 5}, {"偶尔监督", 3}, {"从不监督", 1}}),
				mkQ(607, 3, "你会独立完成复杂家务吗（如做一桌菜）？", [3][2]interface{}{{"能独立完成", 5}, {"需要帮忙", 3}, {"不会做", 1}}),
				mkQ(608, 3, "你会修理家用电器或自行车吗？", [3][2]interface{}{{"经常修", 5}, {"偶尔修", 3}, {"从不修", 1}}),
				mkQ(609, 3, "你有自己的创作或作品吗（文章/手工/程序）？", [3][2]interface{}{{"经常创作", 5}, {"偶尔创作", 3}, {"从不创作", 1}}),
				mkQ(610, 4, "你有明确的学习方向和兴趣领域吗？", [3][2]interface{}{{"有明确方向", 5}, {"在探索", 3}, {"没有方向", 1}}),
				mkQ(611, 4, "你会批判性地看待书本知识吗？", [3][2]interface{}{{"经常质疑", 5}, {"偶尔质疑", 3}, {"全盘接受", 1}}),
				mkQ(612, 4, "你会主动总结学习经验吗？", [3][2]interface{}{{"经常总结", 5}, {"偶尔总结", 3}, {"从不总结", 1}}),
				mkQ(613, 5, "你能在陌生环境中快速建立社交关系吗？", [3][2]interface{}{{"很快适应", 5}, {"慢慢适应", 3}, {"很难适应", 1}}),
				mkQ(614, 5, "你能妥善处理人际冲突吗？", [3][2]interface{}{{"妥善处理", 5}, {"回避冲突", 3}, {"激化冲突", 1}}),
				mkQ(615, 5, "你会换位思考理解他人吗？", [3][2]interface{}{{"经常换位", 5}, {"偶尔换位", 3}, {"只顾自己", 1}}),
				mkQ(616, 6, "你有自己的运动习惯和锻炼计划吗？", [3][2]interface{}{{"有计划坚持", 5}, {"偶尔运动", 3}, {"很少运动", 1}}),
				mkQ(617, 6, "你会主动调节心理压力吗？", [3][2]interface{}{{"主动调节", 5}, {"需要帮助", 3}, {"压抑自己", 1}}),
				mkQ(618, 6, "你会关注营养均衡和健康饮食吗？", [3][2]interface{}{{"主动关注", 5}, {"偶尔关注", 3}, {"不关注", 1}}),
			},
		},
	}
}
