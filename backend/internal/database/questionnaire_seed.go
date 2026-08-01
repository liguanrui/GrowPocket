package database

import (
	"encoding/json"
	"log"

	"growpocket/internal/model"

	"gorm.io/gorm"
)

// seedQuestionnaires 预置 3 个阶段的问卷（register/weekly/review）
func seedQuestionnaires(db *gorm.DB) error {
	var count int64
	db.Model(&model.Questionnaire{}).Count(&count)
	if count > 0 {
		return nil
	}

	// 注册问卷：6 题（每维度 1 题）
	registerQuestions := buildQuestions(1, 6)
	// 每周问卷：6 题（每维度 1 题）
	weeklyQuestions := buildQuestions(1, 6)
	// 回顾问卷：12 题（每维度 2 题）
	reviewQuestions := buildQuestions(2, 6)

	questionnaires := []model.Questionnaire{
		{Stage: "register", Title: "初始能力评估", Questions: toJSON(registerQuestions)},
		{Stage: "weekly", Title: "每周能力更新", Questions: toJSON(weeklyQuestions)},
		{Stage: "review", Title: "阶段回顾评估", Questions: toJSON(reviewQuestions)},
	}
	for i := range questionnaires {
		if err := db.Create(&questionnaires[i]).Error; err != nil {
			return err
		}
	}
	log.Printf("已创建 3 份问卷")
	return nil
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
