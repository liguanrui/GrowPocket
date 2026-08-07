package service

import (
	"encoding/json"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"growpocket/internal/util/timeutil"
	"log"
	"math/rand"
	"sort"
	"strings"
	"time"
)

// TaskGenerationService 负责 AI 每日任务生成（v3.1 模块 C：三段式混合生成 + 规则守门员）
type TaskGenerationService struct {
	aiService    *AIService
	ability      *AbilityService
	cycleService *GrowthCycleService
	taskService  *TaskService
	habitService *HabitService
}

// NewTaskGenerationService 创建任务生成服务
func NewTaskGenerationService(aiService *AIService) *TaskGenerationService {
	return &TaskGenerationService{
		aiService:    aiService,
		ability:      NewAbilityService(),
		cycleService: NewGrowthCycleService(),
		taskService:  NewTaskService(),
		habitService: NewHabitService(aiService),
	}
}

// aiTaskSuggestion AI 返回的单个任务建议
type aiTaskSuggestion struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Points      int    `json:"points"`
	Difficulty  string `json:"difficulty"`
	Category    string `json:"category"`
	DimensionID uint   `json:"dimension_id"`
}

// taskTitleBlacklist 标题黑名单（守门员规则 f）：含这些词的任务直接丢弃
var taskTitleBlacklist = []string{"登月", "中彩票", "一天学完", "考100分", "一夜暴富", "不劳而获"}

// academicBoostKeywords V3.1 模块 D：学业趋势需关注时，学习认知维度下这些关键词的模板获得 rank 加分
var academicBoostKeywords = []string{"错题订正", "检查清单", "作业规划", "错题本"}

// learningDimBoost 学业趋势召回加权标记
type learningDimBoost struct {
	apply         bool // 是否启用学业支持类模板加权
	learningDimID uint // 学习认知维度 ID（code='learning'）
}

// GenerateTasksForChild 为儿童生成每日 AI 任务（三段式混合生成主流程）
// 不改变函数签名：每日 08:00 scheduler 与 hasTodayAITask 幂等逻辑保持不变
func (s *TaskGenerationService) GenerateTasksForChild(childID, familyID, createdBy uint, childName string) error {
	// 先确保习惯每日子任务就绪（habit_daily），与 AI 任务生成相互独立
	if s.habitService != nil {
		if err := s.habitService.EnsureHabitDailyReady(childID); err != nil {
			log.Printf("[TaskGen] 习惯每日任务就绪检查失败 child=%d: %v", childID, err)
		}
	}

	// Step 1: 收集上下文（保留现有逻辑）
	scores, _ := s.ability.GetChildScores(childID, familyID)
	dimensions, _ := s.ability.ListDimensions()
	cycle, goals, _ := s.cycleService.GetCurrentCycle(childID, familyID)

	// 最弱维度（ID + 名称，用于召回排序与守门员 fallback）
	weakestDimID := uint(0)
	weakestDimName := ""
	minScore := 101
	for _, sc := range scores {
		if sc.Score < minScore {
			minScore = sc.Score
			weakestDimID = sc.DimensionID
			for _, d := range dimensions {
				if d.ID == sc.DimensionID {
					weakestDimName = d.Name
					break
				}
			}
		}
	}

	// 查儿童档案（取生日/年级用于适龄与蓄势维判断）
	var child model.User
	database.DB.Where("id = ?", childID).First(&child)
	grade, _ := ResolveGrade(&child)

	// 近 14 天已完成标题（召回去重 + prompt 注入），近 7 天标题（守门员去重）
	recentTaskTitles := s.getRecentCompletedTitles(childID, familyID, 14)
	recent7TaskTitles := s.getRecentCompletedTitles(childID, familyID, 7)

	// Step 2: 召回候选模板（RAG，含 Task A5 蓄势维配额）
	candidates, _ := s.recallCandidateTemplates(child, grade, scores, recentTaskTitles)

	// Step 3: 构造三段式 Prompt
	prompt := s.buildHybridPrompt(childName, child, grade, weakestDimName, weakestDimID, scores, dimensions, cycle, goals, candidates, recentTaskTitles)

	// Step 4 + Step 5: 调 LLM 并解析 JSON，最多重试 3 次
	var suggestions []aiTaskSuggestion
	parseOK := false
	userMsg := "请从候选中选 2 条作为基础，额外自造 1 条（category 末尾加 * 标记），共返回 3 个任务的纯 JSON 数组。"
	for attempt := 0; attempt < 3; attempt++ {
		reply, err := s.aiService.Chat(prompt, nil, userMsg)
		if err != nil {
			log.Printf("[TaskGen] child=%d LLM 调用失败 attempt=%d: %v", childID, attempt, err)
			continue
		}
		reply = cleanJSONResponse(reply)
		// 无 API Key 时 AI 会返回降级文本（非 JSON），跳过重试
		if !strings.HasPrefix(reply, "[") && !strings.HasPrefix(reply, "{") {
			log.Printf("[TaskGen] child=%d AI 返回非 JSON（可能未配置 API Key）", childID)
			break
		}
		var parsed []aiTaskSuggestion
		if err := json.Unmarshal([]byte(reply), &parsed); err != nil {
			log.Printf("[TaskGen] child=%d 解析 JSON 失败 attempt=%d: %v", childID, attempt, err)
			continue
		}
		suggestions = parsed
		parseOK = true
		break
	}

	// JSON 解析失败 3 次 fallback：直接从召回 top 3 模板出任务
	llmReturned := len(suggestions)
	candIdx := 0
	if !parseOK {
		log.Printf("[TaskGen] child=%d JSON 解析 3 次失败，fallback 到召回模板", childID)
		fallback := s.suggestionsFromCandidates(candidates, 3)
		suggestions = fallback
		// fallback 已消费前 N 条候选，顶替池从其后取
		candIdx = len(fallback)
		llmReturned = len(suggestions)
	}

	// Step 6: 守门员——对每条 suggestion 调 sanitizeTaskSuggestion，丢弃的从 candidates 顶替
	sanitizedCount := 0
	rejectedCount := 0
	finalTasks := make([]aiTaskSuggestion, 0, len(suggestions))
	for i := range suggestions {
		san, ok := s.sanitizeTaskSuggestion(&suggestions[i], grade, recent7TaskTitles, candidates, weakestDimID)
		if ok {
			finalTasks = append(finalTasks, *san)
			sanitizedCount++
			continue
		}
		rejectedCount++
		// 从候选模板顶替
		if candIdx < len(candidates) {
			t := candidates[candIdx]
			candIdx++
			finalTasks = append(finalTasks, aiTaskSuggestion{
				Title:       t.Title,
				Description: t.Description,
				Points:      t.Points,
				Difficulty:  t.Difficulty,
				Category:    t.Category,
				DimensionID: t.AbilityDimensionID,
			})
		}
	}

	// Step 7: 写库（RuleSanitized=true, AIGenerated=true）
	created := 0
	for _, sug := range finalTasks {
		if sug.Title == "" || sug.Points == 0 {
			continue
		}
		difficulty := sug.Difficulty
		if difficulty == "" {
			difficulty = "medium"
		}
		category := sug.Category
		if category == "" {
			category = "其他"
		}
		now := timeutil.Now()
		task := &model.Task{
			FamilyID:           familyID,
			Title:              sug.Title,
			Description:        sug.Description,
			Points:             sug.Points,
			Status:             model.TaskStatusInProgress,
			ChildID:            childID,
			ChildName:          childName,
			CreatedBy:          createdBy,
			Difficulty:         difficulty,
			Category:           category,
			AbilityDimensionID: sug.DimensionID,
			AIGenerated:        true,
			RuleSanitized:      true,
			CreatedAt:          now,
			UpdatedAt:          now,
		}
		if err := database.DB.Create(task).Error; err != nil {
			log.Printf("[TaskGen] 创建 AI 任务失败: %v", err)
			continue
		}
		created++
	}

	// 结构化日志（模块 C3）
	log.Printf("[TaskGen] child=%d recalled=%d prompt_sent=true llm_returned=%d sanitized=%d rejected=%d",
		childID, len(candidates), llmReturned, sanitizedCount, rejectedCount)

	// 补齐 GoalType=parent_task 目标关联的父任务子任务推进（Task 27.2）
	// 单个 parent_task 补齐失败不阻断整体流程，仅记录日志
	s.processParentTaskGoals(goals)

	// 兜底：检查该孩子是否有 3 天未完成的 parent 任务，推进下一批实例化
	// 失败不阻断 GenerateTasksForChild 主流程，仅记录日志
	if err := s.CheckStaleParentTasks(childID); err != nil {
		log.Printf("[TaskGen] CheckStaleParentTasks 失败 child=%d: %v", childID, err)
	}

	return nil
}

// processParentTaskGoals 处理 GoalType=parent_task 的目标，补齐父任务子任务推进（Task 27.2）
// 对每个 parent_task 目标：
//  1. 加载关联父任务（通过 ParentTaskID）
//  2. 若父任务 SubTaskOutline 为空，调用 GenerateSubTaskOutline 生成大纲
//  3. 检查父任务当前是否有正在进行的 child 任务（status != 3）
//  4. 若无正在进行的 child（即所有已实例化的 child 都完成了），调用 AdvanceBatch 实例化下一个
//
// 这部分是"补齐"逻辑，不直接生成 task 记录，而是通过调用 ParentTaskService 的方法确保父任务子任务推进正常
// 单个 parent_task 补齐失败不阻断整体生成流程，仅记录日志
func (s *TaskGenerationService) processParentTaskGoals(goals []model.Goal) {
	var parentTaskGoals []model.Goal
	for _, g := range goals {
		if g.GoalType == "parent_task" {
			parentTaskGoals = append(parentTaskGoals, g)
		}
	}
	if len(parentTaskGoals) == 0 {
		return
	}
	log.Printf("[TaskGen] 读取到 %d 个 parent_task 目标，开始补齐子任务", len(parentTaskGoals))

	// 按需创建 ParentTaskService，避免循环依赖（参考 Task 20 写法）
	// 注入 aiService 以便 GenerateSubTaskOutline 走 AI 路径（失败时内部有 fallback）
	parentTaskService := &ParentTaskService{aiService: s.aiService}

	for _, g := range parentTaskGoals {
		if g.ParentTaskID == nil || *g.ParentTaskID == 0 {
			log.Printf("[TaskGen] parent_task 目标 %d 缺少 ParentTaskID，跳过", g.ID)
			continue
		}
		parentTaskID := *g.ParentTaskID

		var parent model.Task
		if err := database.DB.First(&parent, parentTaskID).Error; err != nil {
			log.Printf("[TaskGen] 加载父任务失败 goal=%d parent=%d: %v", g.ID, parentTaskID, err)
			continue
		}
		if parent.TaskKind != "parent" {
			log.Printf("[TaskGen] 目标关联任务 %d 不是 parent 类型，跳过", parentTaskID)
			continue
		}

		// 若 SubTaskOutline 为空，先生成大纲
		if strings.TrimSpace(parent.SubTaskOutline) == "" {
			log.Printf("[TaskGen] parent=%d SubTaskOutline 为空，调用 GenerateSubTaskOutline", parentTaskID)
			if err := parentTaskService.GenerateSubTaskOutline(parentTaskID, ""); err != nil {
				log.Printf("[TaskGen] GenerateSubTaskOutline 失败 parent=%d: %v", parentTaskID, err)
				// 大纲生成失败仍继续检查是否需要推进（可能 fallback 已生成大纲）
			}
		}

		// 检查 parent 当前是否有正在进行的 child 任务（status != 3，即未完成）
		var inProgressCount int64
		database.DB.Model(&model.Task{}).
			Where("parent_id = ? AND task_kind = ? AND status != ?",
				parentTaskID, "child", model.TaskStatusCompleted).
			Count(&inProgressCount)
		if inProgressCount > 0 {
			log.Printf("[TaskGen] parent=%d 当前有 %d 个进行中的 child，无需补齐", parentTaskID, inProgressCount)
			continue
		}

		// 没有正在进行的 child（所有已实例化的 child 都完成了），调用 AdvanceBatch 实例化下一个
		log.Printf("[TaskGen] parent=%d 无进行中 child，调用 AdvanceBatch 推进下一批", parentTaskID)
		if _, err := parentTaskService.AdvanceBatch(parentTaskID); err != nil {
			log.Printf("[TaskGen] AdvanceBatch 推进失败 parent=%d: %v", parentTaskID, err)
			continue
		}
		log.Printf("[TaskGen] AdvanceBatch 推进成功 parent=%d", parentTaskID)
	}
}

// recallCandidateTemplates 召回候选任务模板（RAG 阶段）
// 流程：查家庭模板→无则全局 → 适龄过滤 → 蓄势维过滤(含 Task A5 配额) → Jaccard 去重 → 主轴/最弱/随机排序 → top 20
func (s *TaskGenerationService) recallCandidateTemplates(child model.User, grade int, scores []model.ChildAbilityScore, recentTaskTitles []string) ([]model.TaskTemplate, error) {
	// 1. 查家庭模板，没有则查全局模板（family_id = 0）
	var templates []model.TaskTemplate
	if err := database.DB.Where("family_id = ? AND is_active = ?", child.FamilyID, true).Find(&templates).Error; err != nil {
		return nil, err
	}
	if len(templates) == 0 {
		if err := database.DB.Where("family_id = ? AND is_active = ?", 0, true).Find(&templates).Error; err != nil {
			return nil, err
		}
	}
	if len(templates) == 0 {
		return nil, nil
	}

	// 年龄（用 child.Birthday 计算）
	age := 0
	if child.Birthday != nil {
		age = computeAge(*child.Birthday)
	}

	// 蓄势维集合 + Task A5 配额：统计近 7 天已完成的蓄势维任务数
	latentDims := s.getFocusDimIDs(grade, "latent")
	latentExperienced := s.countRecentLatentTasks(child.ID, child.FamilyID, latentDims, 7)
	latentQuota := 2            // 默认最多保留 2 条蓄势维模板
	latentEasyOnly := false     // 是否仅保留 easy
	if latentExperienced >= 1 { // 本周已体验过蓄势维 → 仅 1 条且仅 easy
		latentQuota = 1
		latentEasyOnly = true
	}

	// 最弱维度 ID（用于排序）
	weakestDimID := uint(0)
	minScore := 101
	for _, sc := range scores {
		if sc.Score < minScore {
			minScore = sc.Score
			weakestDimID = sc.DimensionID
		}
	}
	primaryDims := s.getFocusDimIDs(grade, "primary")

	// 2. 过滤
	filtered := make([]model.TaskTemplate, 0, len(templates))
	latentCount := 0
	for _, t := range templates {
		// a. 适龄：min_age <= childAge <= max_age（MinAge/MaxAge 为 0 表示不限）
		if age > 0 {
			if t.MinAge > 0 && age < t.MinAge {
				continue
			}
			if t.MaxAge > 0 && age > t.MaxAge {
				continue
			}
		}
		// b. 蓄势维过滤：仅 easy、不超过配额
		isLatent := latentDims[t.AbilityDimensionID]
		if isLatent {
			if latentEasyOnly && t.Difficulty != "easy" {
				continue
			}
			if latentCount >= latentQuota {
				continue
			}
		}
		// c. 去重：与近 14 天标题 Jaccard 相似度 > 0.4 排除
		dup := false
		for _, r := range recentTaskTitles {
			if jaccardSimilarity(t.Title, r) > 0.4 {
				dup = true
				break
			}
		}
		if dup {
			continue
		}
		filtered = append(filtered, t)
		if isLatent {
			latentCount++
		}
	}

	// 3. 排序：主轴维优先 > 最弱维度优先 > 随机
	// V3.1 模块 D：若近 2 周作业档为 B/C，学习认知维度的"错题订正/检查清单/作业规划"类模板 +300
	academicBoost := s.buildAcademicBoost(child.ID, child.FamilyID)
	sort.SliceStable(filtered, func(i, j int) bool {
		return rankScoreWithAcademicBoost(filtered[i], primaryDims, weakestDimID, academicBoost) >
			rankScoreWithAcademicBoost(filtered[j], primaryDims, weakestDimID, academicBoost)
	})

	// 4. 返回 top 20
	if len(filtered) > 20 {
		filtered = filtered[:20]
	}
	return filtered, nil
}

// buildAcademicBoost 查询近 2 周学业趋势，判断是否需要提升学习认知维度的学业支持类模板权重
// 触发条件：任一学科最近一次作业档（homework）为 B 或 C
func (s *TaskGenerationService) buildAcademicBoost(childID, familyID uint) learningDimBoost {
	boost := learningDimBoost{apply: false}
	// 查询学习认知维度 ID（code='learning'）
	var learningDim model.AbilityDimension
	if err := database.DB.Where("code = ?", "learning").First(&learningDim).Error; err != nil {
		return boost
	}
	boost.learningDimID = learningDim.ID
	// 查询近 2 周作业档趋势（按 created_at 倒序，取最近 10 条）
	cutoff := timeutil.Now().AddDate(0, 0, -14)
	var trends []model.AcademicTrendEntry
	database.DB.Where("child_id = ? AND family_id = ? AND metric_type = ? AND created_at >= ?",
		childID, familyID, model.TrendMetricHomework, cutoff).
		Order("created_at DESC").
		Limit(10).
		Find(&trends)
	if len(trends) == 0 {
		return boost
	}
	// 取每个学科最近一次作业档（trends 已按 created_at 倒序，首次出现即最新）
	latestBySubject := make(map[string]string)
	for _, e := range trends {
		if _, ok := latestBySubject[e.Subject]; !ok {
			latestBySubject[e.Subject] = e.ValueABC
		}
	}
	for _, v := range latestBySubject {
		if v == "B" || v == "C" {
			boost.apply = true
			log.Printf("[TaskGen] academic_boost child=%d 最新作业档=%s，启用学习认知维度学业支持类模板加权", childID, v)
			return boost
		}
	}
	return boost
}

// rankScoreWithAcademicBoost 在 templateRankScore 基础上叠加学业趋势加权
// 不改变 templateRankScore 签名：通过包装函数注入学业支持类模板的 +300 加分
func rankScoreWithAcademicBoost(t model.TaskTemplate, primaryDims map[uint]bool, weakestDimID uint, boost learningDimBoost) float64 {
	score := templateRankScore(t, primaryDims, weakestDimID)
	if !boost.apply || boost.learningDimID == 0 {
		return score
	}
	if t.AbilityDimensionID != boost.learningDimID {
		return score
	}
	for _, kw := range academicBoostKeywords {
		if strings.Contains(t.Title, kw) {
			score += 300
			break
		}
	}
	return score
}

// templateRankScore 计算模板排序分：主轴维 +1000，最弱维 +500，再加随机扰动作为末位 tiebreaker
func templateRankScore(t model.TaskTemplate, primaryDims map[uint]bool, weakestDimID uint) float64 {
	score := rand.Float64()
	if primaryDims[t.AbilityDimensionID] {
		score += 1000
	}
	if weakestDimID != 0 && t.AbilityDimensionID == weakestDimID {
		score += 500
	}
	return score
}

// jaccardSimilarity 计算两个字符串的 Jaccard 相似度（交集/并集）
// 分词策略：中文按单字，英文/数字按空格与标点切分（用于标题去重）
func jaccardSimilarity(a, b string) float64 {
	setA := tokenize(a)
	setB := tokenize(b)
	if len(setA) == 0 && len(setB) == 0 {
		return 0
	}
	inter := 0
	for k := range setA {
		if setB[k] {
			inter++
		}
	}
	union := len(setA) + len(setB) - inter
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}

// tokenize 标题分词：中文（CJK）每字一词，英文/数字连续段作为一词
func tokenize(s string) map[string]bool {
	set := make(map[string]bool)
	var buf strings.Builder
	flush := func() {
		if buf.Len() > 0 {
			set[strings.ToLower(buf.String())] = true
			buf.Reset()
		}
	}
	for _, r := range s {
		switch {
		case r >= 0x4E00 && r <= 0x9FFF: // CJK 统一汉字
			flush()
			set[string(r)] = true
		case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9'):
			buf.WriteRune(r)
		default:
			flush()
		}
	}
	flush()
	return set
}

// buildHybridPrompt 构造三段式混合生成提示词
// 注入：候选模板简表 + 近 14 天已完成标题 + 主轴重点维度 + 蓄势维限制 + 选 2 造 1 指令
func (s *TaskGenerationService) buildHybridPrompt(childName string, child model.User, grade int, weakestDimName string, weakestDimID uint, scores []model.ChildAbilityScore, dims []model.AbilityDimension, cycle *model.GrowthCycle, goals []model.Goal, candidates []model.TaskTemplate, recentTaskTitles []string) string {
	_ = weakestDimID // 保留参数以便后续扩展（当前未直接使用）
	var parts []string
	parts = append(parts, fmt.Sprintf("你是儿童成长任务设计师。为儿童 %s 设计每日任务。", childName))
	if child.Birthday != nil {
		age := computeAge(*child.Birthday)
		if age > 0 {
			parts = append(parts, fmt.Sprintf("儿童年龄：%d 岁，年级：%d。", age, grade))
		}
	}

	// 候选模板简表（id + title + points + dimension_id + difficulty）
	if len(candidates) > 0 {
		parts = append(parts, "可参考的候选任务模板（id | title | points | dimension_id | difficulty）：")
		for _, c := range candidates {
			parts = append(parts, fmt.Sprintf("  #%d %s | %d分 | dim=%d | %s", c.ID, c.Title, c.Points, c.AbilityDimensionID, c.Difficulty))
		}
	}

	// 维度取值
	if len(dims) > 0 {
		parts = append(parts, "dimension_id 取值：")
		for _, d := range dims {
			parts = append(parts, fmt.Sprintf("  %d=%s", d.ID, d.Name))
		}
	}

	// 主轴重点维度
	if primaryNames := s.getFocusDimNames(grade, "primary", dims); len(primaryNames) > 0 {
		parts = append(parts, fmt.Sprintf("本年级主轴重点维度：%s，请优先围绕主轴设计。", strings.Join(primaryNames, "、")))
	}

	// 蓄势维限制 + Task A5 配额提示
	if latentNames := s.getFocusDimNames(grade, "latent", dims); len(latentNames) > 0 {
		latentDims := s.getFocusDimIDs(grade, "latent")
		if s.countRecentLatentTasks(child.ID, child.FamilyID, latentDims, 7) >= 1 {
			parts = append(parts, fmt.Sprintf("蓄势维（%s）本周已体验过，仅可选 1 条 easy 任务，不得给 hard。", strings.Join(latentNames, "、")))
		} else {
			parts = append(parts, fmt.Sprintf("蓄势维（%s）限制：不得给 hard 任务，最多 1 条。", strings.Join(latentNames, "、")))
		}
	}

	// 近 14 天已完成标题（勿重复）
	if len(recentTaskTitles) > 0 {
		parts = append(parts, "近 14 天已完成任务标题（请勿重复）：")
		parts = append(parts, "  "+strings.Join(recentTaskTitles, "；"))
	}

	if weakestDimName != "" {
		parts = append(parts, fmt.Sprintf("重点提升维度：%s（当前最弱）。", weakestDimName))
	}

	// 本周期重点关注维度（来自 GoalType=dimension 的目标，不再传目标分数）
	// GoalType='dimension'：仅维度 ID，TargetScore=0 不再用作目标分数
	// GoalType='habit' / 'parent_task'：不在此处生成 Prompt（由各自服务独立处理）
	var focusDimNames []string
	for _, g := range goals {
		goalType := g.GoalType
		if goalType == "" {
			goalType = "dimension"
		}
		if goalType != "dimension" {
			continue
		}
		for _, d := range dims {
			if d.ID == g.DimensionID {
				focusDimNames = append(focusDimNames, d.Name)
				break
			}
		}
	}
	if len(focusDimNames) > 0 {
		parts = append(parts, fmt.Sprintf("本周期重点关注维度：%s。请基于关注维度生成适合的日常任务。", strings.Join(focusDimNames, "、")))
	}

	// 三段式生成指令
	parts = append(parts, "生成要求：")
	parts = append(parts, "1. 从候选模板中选 2 条作为基础（可改写描述以适配该儿童）。")
	parts = append(parts, "2. 额外自行新造 1 条任务，并在该任务 category 末尾加 * 标记。")
	parts = append(parts, "3. 共返回 3 个任务，纯 JSON 数组（不要 markdown 代码块）。")
	parts = append(parts, "每个任务字段：title, description, points, difficulty(easy/medium/hard), category(学习/家务/行为习惯/运动/其他), dimension_id。")
	parts = append(parts, "任务要适龄、有趣、可执行；积分建议 10-200。")
	return strings.Join(parts, "\n")
}

// sanitizeTaskSuggestion 规则守门员：返回 (sanitizedTask, true) 或 (nil, false) 表示丢弃
// 规则：a.蓄势维 hard→easy b.积分 clamp c.dimension_id 越界→最弱维 d.近 7 天标题 Jaccard>0.6 丢弃
//      e.标题长度<4 或>30 丢弃 f.黑名单词丢弃 g.category 空→"其他"
func (s *TaskGenerationService) sanitizeTaskSuggestion(task *aiTaskSuggestion, grade int, recentTaskTitles []string, candidates []model.TaskTemplate, weakestDimID uint) (*aiTaskSuggestion, bool) {
	_ = candidates // 保留参数与产品口径一致，当前未直接使用
	if task == nil {
		return nil, false
	}

	// e. 标题长度（按 rune 计数）
	titleLen := len([]rune(strings.TrimSpace(task.Title)))
	if titleLen < 4 || titleLen > 30 {
		return nil, false
	}

	// f. 黑名单词
	for _, w := range taskTitleBlacklist {
		if strings.Contains(task.Title, w) {
			return nil, false
		}
	}

	// d. 与近 7 天标题 Jaccard > 0.6 丢弃
	for _, r := range recentTaskTitles {
		if jaccardSimilarity(task.Title, r) > 0.6 {
			return nil, false
		}
	}

	// 复制一份再清洗，避免改动原始切片元素
	out := *task

	// a. 蓄势维 hard 降级为 easy
	latentDims := s.getFocusDimIDs(grade, "latent")
	if latentDims[out.DimensionID] && out.Difficulty == "hard" {
		out.Difficulty = "easy"
	}

	// difficulty 兜底
	if out.Difficulty == "" {
		out.Difficulty = "medium"
	}

	// b. 积分 clamp：easy<=50, medium<=120, hard<=200
	switch out.Difficulty {
	case "easy":
		if out.Points > 50 {
			out.Points = 50
		}
	case "hard":
		if out.Points > 200 {
			out.Points = 200
		}
	default: // medium
		if out.Points > 120 {
			out.Points = 120
		}
	}
	if out.Points < 0 {
		out.Points = 0
	}

	// c. dimension_id 不在 1-6 时 fallback 到最弱维度
	if out.DimensionID < 1 || out.DimensionID > 6 {
		out.DimensionID = weakestDimID
	}

	// g. category 兜底 + 去掉自造任务的 * 标记
	cat := strings.TrimSpace(out.Category)
	cat = strings.TrimSuffix(cat, "*")
	cat = strings.TrimSpace(cat)
	if cat == "" {
		cat = "其他"
	}
	out.Category = cat

	return &out, true
}

// suggestionsFromCandidates 从召回候选直接构造任务建议（fallback 用）
func (s *TaskGenerationService) suggestionsFromCandidates(candidates []model.TaskTemplate, n int) []aiTaskSuggestion {
	out := make([]aiTaskSuggestion, 0, n)
	for i := 0; i < n && i < len(candidates); i++ {
		t := candidates[i]
		out = append(out, aiTaskSuggestion{
			Title:       t.Title,
			Description: t.Description,
			Points:      t.Points,
			Difficulty:  t.Difficulty,
			Category:    t.Category,
			DimensionID: t.AbilityDimensionID,
		})
	}
	return out
}

// getRecentCompletedTitles 取近 N 天已完成任务标题（按创建时间倒序，最多 50 条）
func (s *TaskGenerationService) getRecentCompletedTitles(childID, familyID uint, days int) []string {
	cutoff := timeutil.Now().AddDate(0, 0, -days)
	var tasks []model.Task
	database.DB.Where("child_id = ? AND family_id = ? AND status = ? AND created_at >= ?",
		childID, familyID, model.TaskStatusCompleted, cutoff).
		Order("created_at DESC").
		Limit(50).
		Find(&tasks)
	titles := make([]string, 0, len(tasks))
	for _, t := range tasks {
		if t.Title != "" {
			titles = append(titles, t.Title)
		}
	}
	return titles
}

// getFocusDimIDs 查询某年级指定 focus_level 的维度 ID 集合
func (s *TaskGenerationService) getFocusDimIDs(grade int, focusLevel string) map[uint]bool {
	set := make(map[uint]bool)
	if grade < 1 || grade > 6 {
		return set
	}
	var guides []model.GradeDimensionGuide
	database.DB.Where("grade = ? AND focus_level = ?", grade, focusLevel).Find(&guides)
	for _, g := range guides {
		set[g.DimensionID] = true
	}
	return set
}

// getFocusDimNames 查询某年级指定 focus_level 的维度名称列表（按 dims 顺序）
func (s *TaskGenerationService) getFocusDimNames(grade int, focusLevel string, dims []model.AbilityDimension) []string {
	set := s.getFocusDimIDs(grade, focusLevel)
	names := make([]string, 0, len(set))
	for _, d := range dims {
		if set[d.ID] {
			names = append(names, d.Name)
		}
	}
	return names
}

// countRecentLatentTasks 统计近 N 天该孩子已完成的蓄势维任务数（Task A5 配额用）
func (s *TaskGenerationService) countRecentLatentTasks(childID, familyID uint, latentDims map[uint]bool, days int) int64 {
	if len(latentDims) == 0 {
		return 0
	}
	ids := make([]uint, 0, len(latentDims))
	for id := range latentDims {
		ids = append(ids, id)
	}
	cutoff := timeutil.Now().AddDate(0, 0, -days)
	var count int64
	database.DB.Model(&model.Task{}).
		Where("child_id = ? AND family_id = ? AND status = ? AND created_at >= ? AND ability_dimension_id IN ?",
			childID, familyID, model.TaskStatusCompleted, cutoff, ids).
		Count(&count)
	return count
}

// computeAge 根据生日计算周岁
func computeAge(birthday time.Time) int {
	now := timeutil.Now()
	age := now.Year() - birthday.Year()
	if now.Month() < birthday.Month() || (now.Month() == birthday.Month() && now.Day() < birthday.Day()) {
		age--
	}
	if age < 0 {
		return 0
	}
	return age
}

// cleanJSONResponse 清理 AI 返回中的 markdown 代码块标记
func cleanJSONResponse(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

// GenerateForAllChildren 为所有儿童生成任务（定时任务调用）
// 同一天内已生成过 AI 任务的儿童会被跳过，避免重复
func (s *TaskGenerationService) GenerateForAllChildren() {
	var children []model.User
	database.DB.Where("role = ?", model.RoleChild).Find(&children)
	for _, child := range children {
		// 检查今日是否已生成过 AI 任务
		if hasTodayAITask(child.ID, child.FamilyID) {
			log.Printf("[TaskGen] 儿童 %d 今日已生成过 AI 任务，跳过", child.ID)
			continue
		}
		// 找家长 ID
		var parent model.User
		database.DB.Where("family_id = ? AND role = ?", child.FamilyID, model.RoleParent).First(&parent)
		createdBy := parent.ID
		if createdBy == 0 {
			createdBy = child.ID
		}
		if err := s.GenerateTasksForChild(child.ID, child.FamilyID, createdBy, child.Nickname); err != nil {
			log.Printf("[TaskGen] 儿童 %d 生成失败: %v", child.ID, err)
		}
	}
}

// PrepareDayForFamily 调试快进用：仅为指定家庭做轻量日切（习惯打卡 + 主题过期推进），不调 LLM
func (s *TaskGenerationService) PrepareDayForFamily(familyID uint) {
	var children []model.User
	database.DB.Where("family_id = ? AND role = ?", familyID, model.RoleChild).Find(&children)
	for _, child := range children {
		if s.habitService != nil {
			if err := s.habitService.EnsureHabitDailyReadyLite(child.ID); err != nil {
				log.Printf("[DebugAdvance] 习惯日切失败 child=%d: %v", child.ID, err)
			}
		}
		if err := s.CheckStaleParentTasks(child.ID); err != nil {
			log.Printf("[DebugAdvance] CheckStaleParentTasks 失败 child=%d: %v", child.ID, err)
		}
	}
}

// GenerateAIForFamily 仅为指定家庭补生成今日 AI 任务（幂等）
func (s *TaskGenerationService) GenerateAIForFamily(familyID uint) {
	var children []model.User
	database.DB.Where("family_id = ? AND role = ?", familyID, model.RoleChild).Find(&children)
	var parent model.User
	database.DB.Where("family_id = ? AND role = ?", familyID, model.RoleParent).First(&parent)
	for _, child := range children {
		if hasTodayAITask(child.ID, child.FamilyID) {
			continue
		}
		createdBy := parent.ID
		if createdBy == 0 {
			createdBy = child.ID
		}
		if err := s.GenerateTasksForChild(child.ID, child.FamilyID, createdBy, child.Nickname); err != nil {
			log.Printf("[TaskGen] 家庭 %d 儿童 %d 生成失败: %v", familyID, child.ID, err)
		}
	}
}

// hasTodayAITask 判断儿童今日是否已有 AI 生成的任务
func hasTodayAITask(childID, familyID uint) bool {
	today := timeutil.Today()
	tomorrow := timeutil.Tomorrow()
	var count int64
	database.DB.Model(&model.Task{}).
		Where("child_id = ? AND family_id = ? AND ai_generated = ? AND created_at >= ? AND created_at < ?",
			childID, familyID, true, today, tomorrow).
		Count(&count)
	return count > 0
}

// CheckStaleParentTasks 检查指定孩子的 parent 任务下是否有超过 3 天（72 小时）未完成的 child 任务
// 若有，则调用 AdvanceBatch 推进下一批实例化（兜底机制）
//
// 幂等性：推进后最新 child 的 CreatedAt 重置为当前时间，下次检查不会重复推进
// 失败不阻断调用方主流程：单个 parent 推进失败仅记录日志，继续处理下一个
func (s *TaskGenerationService) CheckStaleParentTasks(childID uint) error {
	// 查询该孩子所有未完成的 parent 任务（status != 3）
	var parents []model.Task
	if err := database.DB.Where("child_id = ? AND task_kind = ? AND status != ?",
		childID, "parent", model.TaskStatusCompleted).Find(&parents).Error; err != nil {
		return fmt.Errorf("查询父任务失败: %w", err)
	}
	if len(parents) == 0 {
		return nil
	}

	staleThreshold := 72 * time.Hour
	now := timeutil.Now()
	parentTaskService := &ParentTaskService{}

	for _, parent := range parents {
		// 查询该 parent 下未完成的 child（pending 或 in_progress），按 sequence 降序取最大者
		var children []model.Task
		if err := database.DB.Where("parent_id = ? AND task_kind = ? AND status != ?",
			parent.ID, "child", model.TaskStatusCompleted).
			Order("sequence DESC").
			Find(&children).Error; err != nil {
			log.Printf("[StaleCheck] 查询子任务失败 parent=%d: %v", parent.ID, err)
			continue
		}
		if len(children) == 0 {
			continue
		}

		// children 已按 sequence DESC 排序，取第一个即 sequence 最大者
		latest := children[0]
		if now.Sub(latest.CreatedAt) > staleThreshold {
			log.Printf("[StaleCheck] child=%d parent=%d 最新 child=%d seq=%d 已超 72 小时未完成，推进下一批",
				childID, parent.ID, latest.ID, latest.Sequence)
			if _, err := parentTaskService.AdvanceBatch(parent.ID); err != nil {
				// "所有子任务已生成完毕"或其他错误均不阻断，仅记录日志
				log.Printf("[StaleCheck] AdvanceBatch 推进失败 parent=%d: %v", parent.ID, err)
				continue
			}
			log.Printf("[StaleCheck] AdvanceBatch 推进成功 parent=%d", parent.ID)
		}
	}
	return nil
}

// StartDailyScheduler 启动每日定时生成（每天 08:00），非阻塞
// 启动时若今日尚未为儿童生成过任务，会立即生成一次
func (s *TaskGenerationService) StartDailyScheduler() {
	go func() {
		// 启动时立即尝试生成一次（跳过当日已生成的儿童）
		log.Printf("[TaskGen] 启动时检查并生成当日 AI 任务")
		s.GenerateForAllChildren()

		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day(), 8, 0, 0, 0, now.Location())
			if !next.After(now) {
				next = next.Add(24 * time.Hour)
			}
			time.Sleep(next.Sub(now))
			log.Printf("[TaskGen] 开始每日 AI 任务生成")
			s.GenerateForAllChildren()
		}
	}()
}
