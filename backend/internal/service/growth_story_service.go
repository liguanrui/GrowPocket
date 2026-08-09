package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"log"
	"sort"
	"strings"
	"time"
)

// GrowthStoryService 成长故事服务（v3）
type GrowthStoryService struct {
	aiService     *AIService
	ability       *AbilityService
	cycleService  *GrowthCycleService
	questionnaire *QuestionnaireService
}

// NewGrowthStoryService 创建成长故事服务实例
func NewGrowthStoryService(aiService *AIService) *GrowthStoryService {
	return &GrowthStoryService{
		aiService:     aiService,
		ability:       NewAbilityService(),
		cycleService:  NewGrowthCycleService(),
		questionnaire: NewQuestionnaireService(),
	}
}

// aiYearbookCopy 回顾短文案（旁白宜短；photo_captions 与相册顺序一一对应）
type aiYearbookCopy struct {
	Cover         string   `json:"cover"`
	Period        string   `json:"period"`
	FirstTask     string   `json:"first_task"`
	Stats         string   `json:"stats"`
	Photos        string   `json:"photos"`
	Close         string   `json:"close"`
	PhotoCaptions []string `json:"photo_captions"`
}

// aiStoryResult AI 返回的成长故事结构
type aiStoryResult struct {
	Title          string           `json:"title"`
	Content        string           `json:"content"`
	AbilitySummary string           `json:"ability_summary"`
	Yearbook       *aiYearbookCopy  `json:"yearbook"`
}

// habitStat 聚合周期内单个习惯的养成统计（来自 habit_master 任务）
type habitStat struct {
	HabitID         uint       // 习惯配置 ID
	HabitTitle      string     // 习惯标题（取自 Habit 表）
	StreakCount     int        // 当前连续坚持天数（实时值，跨周期）
	TotalCount      int        // 累计坚持天数（跨周期总累计，用于 markFormedHabits 养成判定）
	CycleCount      int        // 本周期内的打卡天数（仅统计本周期 habit_daily 的完成数）
	HabitGoal       int        // 习惯目标天数
	LastCheckinDate *time.Time // 上次打卡日期
	ParentComment   string     // 家长批语（当前任务表无批语字段，暂为空字符串）
	MasterTaskID    uint       // habit_master 任务 ID
}

// collectHabitStats 聚合本周期的习惯养成统计
// 【修复 P0 Bug】：此前直接按 habit_master.created_at BETWEEN 周期时间过滤，
// 导致上一周期创建且未养成的 habit_master（status=1 会跨周期延续）被漏掉。
// 正确的查询路径：
//   1. 查当前周期 GoalType='habit' 的 goals，拿到本周期关注的 habit_id 列表
//   2. 对每个 habit_id，按 (task_kind, habit_id, child_id, status<=3) 查 habit_master
//      （不按 created_at 过滤，允许跨周期延续的 master 被查到）
//   3. 统计本周期内该习惯 habit_daily 的完成数（status=3 AND created_at IN 周期）→ CycleCount
// 家长批语：当前任务表无 review_comment 字段，留空字符串；后续若有批语字段可在此扩展。
func (s *GrowthStoryService) collectHabitStats(familyID, childID uint, cycle model.GrowthCycle) []habitStat {
	// 步骤 1：查当前周期的习惯目标（habit_id 列表）
	var habitGoals []model.Goal
	if err := database.DB.Where("cycle_id = ? AND family_id = ? AND child_id = ? AND goal_type = ?",
		cycle.ID, familyID, childID, "habit").Find(&habitGoals).Error; err != nil {
		log.Printf("[GrowthStory] 查询周期习惯目标失败 cycle=%d family=%d child=%d: %v",
			cycle.ID, familyID, childID, err)
		return nil
	}
	if len(habitGoals) == 0 {
		return nil
	}
	habitIDs := make([]uint, 0, len(habitGoals))
	for _, g := range habitGoals {
		if g.HabitID != nil && *g.HabitID > 0 {
			habitIDs = append(habitIDs, *g.HabitID)
		}
	}
	if len(habitIDs) == 0 {
		return nil
	}

	// 步骤 2：批量查询 habit_master（不限 created_at，允许跨周期延续）
	var masters []model.Task
	if err := database.DB.Where("family_id = ? AND child_id = ? AND task_kind = ? AND habit_id IN ? AND status <= ?",
		familyID, childID, "habit_master", habitIDs, model.TaskStatusCompleted).
		Find(&masters).Error; err != nil {
		log.Printf("[GrowthStory] 查询 habit_master 失败 family=%d child=%d habit_ids=%v: %v",
			familyID, childID, habitIDs, err)
		return nil
	}
	masterByHabit := make(map[uint]model.Task, len(masters))
	for _, m := range masters {
		masterByHabit[m.HabitID] = m
	}

	// 步骤 3：统计本周期内各习惯的 habit_daily 完成数 → CycleCount
	type cycleCountRow struct {
		HabitID uint `gorm:"column:habit_id"`
		Cnt     int  `gorm:"column:cnt"`
	}
	var cycleCounts []cycleCountRow
	if err := database.DB.Model(&model.Task{}).
		Select("habit_id, COUNT(*) AS cnt").
		Where("family_id = ? AND child_id = ? AND task_kind = ? AND habit_id IN ? AND status = ? AND created_at BETWEEN ? AND ?",
			familyID, childID, "habit_daily", habitIDs, model.TaskStatusCompleted, cycle.StartDate, cycle.EndDate).
		Group("habit_id").
		Scan(&cycleCounts).Error; err != nil {
		log.Printf("[GrowthStory] 统计周期 habit_daily 完成数失败: %v", err)
		// 统计失败不阻断，CycleCount 全部记 0
	}
	cycleCountMap := make(map[uint]int, len(cycleCounts))
	for _, r := range cycleCounts {
		cycleCountMap[r.HabitID] = r.Cnt
	}

	// 步骤 4：组装结果（按 habitIDs 顺序，与 goals 顺序保持一致）
	stats := make([]habitStat, 0, len(habitIDs))
	for _, hid := range habitIDs {
		master, ok := masterByHabit[hid]
		var habit model.TaskTemplate
		if err := database.DB.Where("id = ? AND template_type = ? AND family_id = ?",
			hid, "habit", familyID).First(&habit).Error; err != nil {
			log.Printf("[GrowthStory] 习惯配置 %d 不存在或不属于当前家庭: %v", hid, err)
			continue
		}
		stat := habitStat{
			HabitID:         hid,
			HabitTitle:      habit.Title,
			StreakCount:     0,
			TotalCount:      0,
			CycleCount:      cycleCountMap[hid],
			HabitGoal:       21,
			LastCheckinDate: nil,
			ParentComment:   "",
			MasterTaskID:    0,
		}
		if ok {
			stat.StreakCount = master.StreakCount
			stat.TotalCount = master.TotalCount
			stat.HabitGoal = master.HabitGoal
			stat.LastCheckinDate = master.LastCheckinDate
			stat.MasterTaskID = master.ID
		}
		stats = append(stats, stat)
	}
	return stats
}

// markFormedHabits 标记已养成的习惯为 IsActive=false。
// 判定规则：TotalCount >= HabitGoal * 0.8（完成 80% 以上视为已养成）。
// 标记后，下次目标设置时 preset 接口不再返回该习惯。
// 失败仅记录日志，不影响故事生成主流程。
func (s *GrowthStoryService) markFormedHabits(stats []habitStat) {
	for _, st := range stats {
		if st.HabitGoal <= 0 {
			continue
		}
		// 完成度 >= 80% 视为已养成
		if float64(st.TotalCount) >= float64(st.HabitGoal)*0.8 {
			// 仅更新当前仍为 active 的习惯，避免重复写入
			res := database.DB.Model(&model.TaskTemplate{}).
				Where("id = ? AND template_type = ? AND is_active = ?", st.HabitID, "habit", true).
				Update("is_active", false)
			if res.Error != nil {
				log.Printf("[GrowthStory] 标记习惯 %d 为已养成失败: %v", st.HabitID, res.Error)
			} else if res.RowsAffected > 0 {
				log.Printf("[GrowthStory] 习惯 %d「%s」已养成（累计 %d / 目标 %d），标记 IsActive=false",
					st.HabitID, st.HabitTitle, st.TotalCount, st.HabitGoal)
			}
		}
	}
}

// habitAssessLevel 用规则判断习惯养成程度（用于 AI 降级时本地评估）：
//   - 完成度 >= 80%：已养成
//   - 完成度 >= 50%：基本养成
//   - 其他：待加强
func habitAssessLevel(st habitStat) string {
	if st.HabitGoal <= 0 {
		return "待加强"
	}
	ratio := float64(st.TotalCount) / float64(st.HabitGoal)
	switch {
	case ratio >= 0.8:
		return "已养成"
	case ratio >= 0.5:
		return "基本养成"
	default:
		return "待加强"
	}
}

// themeTaskPhoto 主题任务相册中的单张照片信息（子任务成果）
type themeTaskPhoto struct {
	URL            string    `json:"url"`              // 子任务成果照片 URL
	Caption        string    `json:"caption"`          // 照片配文（取子任务标题）
	IsKeyMilestone bool      `json:"is_key_milestone"` // 是否关键里程碑
	Sequence       int       `json:"sequence"`         // 子任务顺序（从 1 开始）
	CompletedAt    time.Time `json:"completed_at"`     // 完成时间
}

// themeTaskGroup 主题任务分组：一个父任务及其在周期内的子任务列表
type themeTaskGroup struct {
	Parent          model.Task       // 父任务
	Children        []model.Task     // 子任务列表（按 Sequence 升序）
	AllCompleted    bool             // 是否全部完成（status=3）
	CompletedCount  int              // 已完成子任务数
	TotalCount      int              // 子任务总数
	InProgressTitle string           // 当前正在进行的子任务标题（未全完成时取第一个未完成的）
	Photos          []themeTaskPhoto // 成果相册（全完成时按时间线排列）
	StartDate       time.Time        // 最早子任务创建时间
	EndDate         time.Time        // 最晚子任务完成时间
	DurationDays    int              // 整体完成天数
}

// collectThemeTasks 聚合周期内所有主题任务（按 ParentID 分组）。
// 查询周期内 task_kind='child' 的任务，按 ParentID 分组，
// 并批量查询对应父任务信息，构造每个分组的相册/进度数据。
// 单个父任务聚合失败仅记录日志，不阻断其他分组与整体故事生成。
func (s *GrowthStoryService) collectThemeTasks(familyID, childID uint, cycle model.GrowthCycle) []themeTaskGroup {
	// 1. 查询周期内所有 child 任务
	var children []model.Task
	if err := database.DB.Where("family_id = ? AND child_id = ? AND task_kind = ? AND created_at BETWEEN ? AND ?",
		familyID, childID, "child", cycle.StartDate, cycle.EndDate).
		Order("parent_id ASC, sequence ASC").Find(&children).Error; err != nil {
		log.Printf("[GrowthStory] 查询 child 任务失败 family=%d child=%d: %v", familyID, childID, err)
		return nil
	}
	if len(children) == 0 {
		return nil
	}

	// 2. 按 ParentID 分组（跳过 ParentID=0 的孤儿任务）
	groupMap := make(map[uint][]model.Task)
	for _, c := range children {
		if c.ParentID == 0 {
			continue
		}
		groupMap[c.ParentID] = append(groupMap[c.ParentID], c)
	}
	if len(groupMap) == 0 {
		return nil
	}

	// 3. 批量查询父任务信息
	parentIDs := make([]uint, 0, len(groupMap))
	for pid := range groupMap {
		parentIDs = append(parentIDs, pid)
	}
	var parents []model.Task
	if err := database.DB.Where("id IN ? AND task_kind = ?", parentIDs, "parent").Find(&parents).Error; err != nil {
		log.Printf("[GrowthStory] 查询父任务失败 ids=%v: %v", parentIDs, err)
		return nil
	}
	parentMap := make(map[uint]model.Task, len(parents))
	for _, p := range parents {
		parentMap[p.ID] = p
	}

	// 4. 构造每个分组：判断完成情况、收集照片、计算时间跨度
	groups := make([]themeTaskGroup, 0, len(parentIDs))
	for pid, childs := range groupMap {
		parent, ok := parentMap[pid]
		if !ok {
			log.Printf("[GrowthStory] 父任务 %d 不存在或非 parent 类型，跳过该分组", pid)
			continue
		}

		// 按 Sequence 升序排序，保证时间线顺序
		sort.SliceStable(childs, func(i, j int) bool {
			return childs[i].Sequence < childs[j].Sequence
		})

		group := themeTaskGroup{
			Parent:     parent,
			Children:   childs,
			TotalCount: len(childs),
		}

		completedCount := 0
		photos := make([]themeTaskPhoto, 0)
		var earliestCreated, latestCompleted time.Time
		inProgressTitle := ""
		for _, c := range childs {
			if c.Status == model.TaskStatusCompleted {
				completedCount++
				// 收集成果照片
				if c.Photo != "" {
					photos = append(photos, themeTaskPhoto{
						URL:            c.Photo,
						Caption:        c.Title,
						IsKeyMilestone: c.IsKeyMilestone,
						Sequence:       c.Sequence,
						CompletedAt:    c.UpdatedAt,
					})
				}
				// 最晚完成时间
				if latestCompleted.IsZero() || c.UpdatedAt.After(latestCompleted) {
					latestCompleted = c.UpdatedAt
				}
			} else {
				// 取第一个未完成的作为当前进行中子任务
				if inProgressTitle == "" {
					inProgressTitle = c.Title
				}
			}
			// 最早创建时间
			if earliestCreated.IsZero() || c.CreatedAt.Before(earliestCreated) {
				earliestCreated = c.CreatedAt
			}
		}
		group.CompletedCount = completedCount
		group.AllCompleted = completedCount == len(childs) && len(childs) > 0
		group.Photos = photos
		group.InProgressTitle = inProgressTitle
		group.StartDate = earliestCreated
		group.EndDate = latestCompleted
		if !earliestCreated.IsZero() && !latestCompleted.IsZero() {
			group.DurationDays = int(latestCompleted.Sub(earliestCreated).Hours() / 24)
		}

		groups = append(groups, group)
	}

	// 按父任务创建时间升序排列，保证故事中主题任务顺序稳定
	sort.SliceStable(groups, func(i, j int) bool {
		return groups[i].Parent.CreatedAt.Before(groups[j].Parent.CreatedAt)
	})

	return groups
}

// buildThemeTaskSection 构造主题任务区块的 markdown 文本。
// 全完成的父任务生成相册区块（含里程碑高亮与时间线），
// 未全完成的显示"进行中"状态与当前进度。
// aiSummary 为 AI 生成的总体评价，为空则省略。
func (s *GrowthStoryService) buildThemeTaskSection(groups []themeTaskGroup, aiSummary string) string {
	if len(groups) == 0 {
		return ""
	}
	parts := []string{"\n### 🎯 主题任务回顾\n"}

	// AI 总体评价（若有）
	if strings.TrimSpace(aiSummary) != "" {
		parts = append(parts, strings.TrimSpace(aiSummary))
		parts = append(parts, "")
	}

	for _, g := range groups {
		parts = append(parts, fmt.Sprintf("#### %s", g.Parent.Title))
		if g.Parent.Description != "" {
			parts = append(parts, fmt.Sprintf("> %s", g.Parent.Description))
		}

		if g.AllCompleted {
			// 全完成 —— 生成相册区块
			parts = append(parts, fmt.Sprintf("✅ 已完成全部 %d 个子任务", g.TotalCount))
			if g.DurationDays > 0 && !g.StartDate.IsZero() && !g.EndDate.IsZero() {
				parts = append(parts, fmt.Sprintf("⏱ 整体用时：%s ~ %s（共 %d 天）",
					g.StartDate.Format("2006-01-02"),
					g.EndDate.Format("2006-01-02"),
					g.DurationDays))
			}

			// 子任务成果照片时间线
			if len(g.Photos) > 0 {
				parts = append(parts, "\n**📷 成果相册**")
				for _, p := range g.Photos {
					line := fmt.Sprintf("- [%d] %s", p.Sequence, p.Caption)
					if p.IsKeyMilestone {
						line = "🌟 关键里程碑 " + line
					}
					if !p.CompletedAt.IsZero() {
						line += fmt.Sprintf("（%s）", p.CompletedAt.Format("2006-01-02"))
					}
					parts = append(parts, line)
				}
			} else {
				parts = append(parts, "\n_本主题任务暂无成果照片_")
			}
		} else {
			// 未全完成 —— 显示进行中状态
			parts = append(parts, fmt.Sprintf("🔄 进行中（已完成 %d/%d 个子任务）",
				g.CompletedCount, g.TotalCount))
			if g.InProgressTitle != "" {
				parts = append(parts, fmt.Sprintf("当前进度：%s", g.InProgressTitle))
			}
		}
		parts = append(parts, "")
	}

	return strings.Join(parts, "\n")
}

// generateThemeTaskSummary 调用 AI 生成主题任务的总体评价。
// AI 不可用或调用失败时返回空字符串，不阻断故事生成。
func (s *GrowthStoryService) generateThemeTaskSummary(childName string, groups []themeTaskGroup) string {
	if s.aiService == nil || len(groups) == 0 {
		return ""
	}
	parts := []string{
		fmt.Sprintf("你是儿童成长记录师。请为儿童 %s 在本阶段的主题任务完成情况给出一段总体评价（80-150字）。", childName),
		"主题任务完成情况：",
	}
	for _, g := range groups {
		if g.AllCompleted {
			line := fmt.Sprintf("- 「%s」已完成全部 %d 个子任务", g.Parent.Title, g.TotalCount)
			if g.DurationDays > 0 {
				line += fmt.Sprintf("（用时 %d 天）", g.DurationDays)
			}
			keyMilestones := 0
			for _, p := range g.Photos {
				if p.IsKeyMilestone {
					keyMilestones++
				}
			}
			if keyMilestones > 0 {
				line += fmt.Sprintf("，含 %d 个关键里程碑", keyMilestones)
			}
			parts = append(parts, line)
		} else {
			parts = append(parts, fmt.Sprintf("- 「%s」进行中（已完成 %d/%d）",
				g.Parent.Title, g.CompletedCount, g.TotalCount))
		}
	}
	parts = append(parts, "要求：评价孩子在主题任务中展现的能力与成长，富有温度。只返回评价正文，不要 JSON、不要标题。")

	reply, err := s.aiService.Chat(strings.Join(parts, "\n"), nil, "请生成主题任务总体评价")
	if err != nil {
		log.Printf("[GrowthStory] 主题任务评价 AI 调用失败: %v", err)
		return ""
	}
	return strings.TrimSpace(reply)
}

// GenerateStory 为指定周期生成阶段成长故事
func (s *GrowthStoryService) GenerateStory(cycleID, familyID, childID uint, childName string) (*model.GrowthStory, error) {
	// 0. 幂等检查：若该周期已有故事记录，直接返回（防止重复生成）
	var existing model.GrowthStory
	if err := database.DB.Where("cycle_id = ?", cycleID).First(&existing).Error; err == nil {
		log.Printf("[GrowthStory] 周期 %d 已有故事记录 story=%d，返回已有故事", cycleID, existing.ID)
		sanitizeGrowthStory(&existing)
		// 旧故事可能缺少年报文案，补生成一次（失败仍返回原故事）
		if strings.TrimSpace(existing.YearbookCopy) == "" {
			if filled, err := s.EnsureYearbookCopy(existing.ID, familyID); err == nil && filled != nil {
				return filled, nil
			}
		}
		return &existing, nil
	}

	// 1. 查询周期并校验权限
	var cycle model.GrowthCycle
	if err := database.DB.First(&cycle, cycleID).Error; err != nil {
		return nil, errors.New("周期不存在")
	}
	if cycle.FamilyID != familyID || cycle.ChildID != childID {
		return nil, errors.New("周期与儿童不匹配")
	}
	// 1.1 状态校验 & 自动恢复：
	// - active：正常生成
	// - reviewing：上次生成过程崩溃/中断的遗留状态（因断电/重启/Panic 导致 defer 未执行）
	//             若无故事记录，自动恢复为 active 后继续生成（幂等检查已确认无故事）
	// - completed：拒绝（已生成过故事，不应再走 GenerateStory）
	switch cycle.Status {
	case "active":
		// OK, 正常流程
	case "reviewing":
		log.Printf("[GrowthStory] 周期 %d 状态为 reviewing（疑似崩溃遗留），自动恢复为 active", cycleID)
		cycle.Status = "active"
		if err := database.DB.Save(&cycle).Error; err != nil {
			log.Printf("[GrowthStory] 周期 %d 状态恢复失败: %v", cycleID, err)
		}
	case "completed":
		return nil, errors.New("该周期已完成阶段回顾，如需重新生成请联系管理员")
	default:
		return nil, fmt.Errorf("周期状态异常：%s", cycle.Status)
	}

	// 1.5 并发保护：立即将周期状态改为 reviewing，防止并发请求重复生成
	cycle.Status = "reviewing"
	if err := database.DB.Save(&cycle).Error; err != nil {
		return nil, errors.New("周期状态更新失败，请稍后重试")
	}
	// 生成失败时恢复状态（defer）
	// 注意：若进程在此之后、completed 之前崩溃/重启，defer 不会执行，
	// 周期会残留 reviewing 状态 → 由下次调用的 1.1 自动恢复逻辑兜底修复
	generationFailed := true
	defer func() {
		if generationFailed {
			cycle.Status = "active"
			if err := database.DB.Save(&cycle).Error; err != nil {
				log.Printf("[GrowthStory] 周期 %d 状态回滚为 active 失败: %v", cycleID, err)
			}
		}
	}()

	// child_name 未提供时从用户表查询
	if childName == "" {
		var child model.User
		if err := database.DB.Where("id = ? AND role = ?", childID, model.RoleChild).First(&child).Error; err == nil {
			childName = child.Nickname
		}
	}

	// 2. 收集周期内完成的任务（status=completed）
	var tasks []model.Task
	database.DB.Where("family_id = ? AND child_id = ? AND status = ? AND created_at BETWEEN ? AND ?",
		familyID, childID, model.TaskStatusCompleted, cycle.StartDate, cycle.EndDate).
		Order("created_at ASC").Find(&tasks)

	// 3. 查询能力维度列表
	dimensions, _ := s.ability.ListDimensions()

	// 4. 【新增】AI 重新评定能力得分
	abilityDeltas, _ := s.ability.ReassessScores(s.aiService, childID, familyID, tasks, dimensions)
	// 将能力变化序列化为 ability_summary
	abilitySummaryJSON := ""
	if len(abilityDeltas) > 0 {
		if data, err := json.Marshal(abilityDeltas); err == nil {
			abilitySummaryJSON = string(data)
		}
	}

	// 5. 查询周期内相册精选（取前若干任务的照片，展平多图）
	var albumTasks []model.Task
	// 与前端回顾相册顺序一致：按创建时间升序展平
	database.DB.Where("family_id = ? AND child_id = ? AND photo IS NOT NULL AND photo != '' AND created_at BETWEEN ? AND ?",
		familyID, childID, cycle.StartDate, cycle.EndDate).
		Order("created_at ASC").Limit(16).Find(&albumTasks)
	photoURLs := make([]string, 0, 12)
	photoTaskTitles := make([]string, 0, 12)
	for _, t := range albumTasks {
		for _, u := range taskPhotoURLs(t.Photo) {
			if len(photoURLs) >= 12 {
				break
			}
			photoURLs = append(photoURLs, u)
			photoTaskTitles = append(photoTaskTitles, t.Title)
		}
		if len(photoURLs) >= 12 {
			break
		}
	}

	// 5.5 聚合周期内习惯养成统计（habit_master 任务 + 关联 Habit 信息）
	// 用于注入 AI prompt 进行养成程度评估，并在故事生成后标记已养成的习惯
	habitStats := s.collectHabitStats(familyID, childID, cycle)

	// 5.6 聚合周期内主题任务（child 任务按 ParentID 分组），用于生成"🎯 主题任务回顾"区块
	// 单个父任务聚合失败不阻断整体故事生成（详见 collectThemeTasks 内部错误处理）
	themeGroups := s.collectThemeTasks(familyID, childID, cycle)

	// 6. 构造 system prompt（使用评定后的能力变化 + 习惯养成统计 + 主题任务）
	prompt := s.buildStoryPrompt(childName, cycle, tasks, abilityDeltas, photoURLs, photoTaskTitles, habitStats, themeGroups)

	// 7. 调用 AI
	reply, err := s.aiService.Chat(prompt, nil, "请根据上述信息生成阶段成长故事，返回 JSON；content 用 Markdown 分节，全文约 500～800 字")
	if err != nil {
		log.Printf("[GrowthStory] AI 调用失败 cycle=%d: %v", cycleID, err)
	}

	// 8. 解析 AI 返回（解析失败时降级为本地拼接的阶段总结，保证页面有内容可展示）
	title := fmt.Sprintf("%s的阶段成长故事", childName)
	content := ""
	yearbookJSON := ""
	aiOK := false
	if reply != "" {
		cleaned := cleanJSONResponse(reply)
		if strings.HasPrefix(cleaned, "{") {
			var result aiStoryResult
			if json.Unmarshal([]byte(cleaned), &result) == nil {
				if result.Title != "" {
					title = result.Title
				}
				if result.Content != "" {
					content = result.Content
					aiOK = true
				}
				if result.Yearbook != nil {
					yearbookJSON = marshalYearbookCopy(normalizeYearbookCopy(result.Yearbook))
				}
			} else {
				content = reply
				aiOK = true
			}
		} else if len(reply) > 20 {
			// AI 正常返回但非 JSON 结构，也视为可用文本，不触发降级
			content = reply
			aiOK = true
		}
	}
	// AI 降级：无 Key / 网络失败 / 返回为空 —— 基于任务与能力变化在本地生成一份可读总结，
	// 保证用户至少能看到阶段框架、任务列表与能力变化，而不是返回 500 让前端白屏。
	if !aiOK {
		// 本地降级：结构贴近正式 AI 文案（开场 + 日常 + 主题）
		parts := []string{fmt.Sprintf("%s，这个阶段你像小太阳一样闪闪发光，完成了 **%d** 个小任务！\n", childName, len(tasks))}
		if len(tasks) > 0 {
			parts = append(parts, "\n### ☀️ 日常小成就\n")
			bits := make([]string, 0, len(tasks))
			for _, t := range tasks {
				bits = append(bits, fmt.Sprintf("**%s**", t.Title))
			}
			parts = append(parts, fmt.Sprintf("你认真完成了%s，每件小事都在见证成长。\n", strings.Join(bits, "、")))
		}
		up := 0
		var top string
		for _, d := range abilityDeltas {
			if d.Delta > up {
				up = d.Delta
				top = fmt.Sprintf("**%s** 提升了%d分", d.DimensionName, d.Delta)
			}
		}
		if top != "" {
			parts = append(parts, fmt.Sprintf("特别值得夸一夸：%s，真了不起！\n", top))
		}
		if len(habitStats) > 0 {
			parts = append(parts, "\n### 🌱 习惯小进步\n")
			for _, st := range habitStats {
				parts = append(parts, fmt.Sprintf("在 **%s** 上，你本阶段打卡 %d 天，连续坚持 %d 天，继续加油！",
					st.HabitTitle, st.CycleCount, st.StreakCount))
			}
		}
		if len(themeGroups) > 0 {
			parts = append(parts, "\n### 🎯 主题探索\n")
			parts = append(parts, "你正在主题任务里勇敢尝试，主动观察和提问的样子真棒。\n")
			parts = append(parts, "\n### 🎯 主题任务回顾\n")
			for _, g := range themeGroups {
				if g.AllCompleted {
					parts = append(parts, fmt.Sprintf("- **%s**：已完成（%d/%d）", g.Parent.Title, g.CompletedCount, g.TotalCount))
				} else {
					parts = append(parts, fmt.Sprintf("- **%s**：进行中（%d/%d）", g.Parent.Title, g.CompletedCount, g.TotalCount))
				}
			}
		}
		parts = append(parts, "\n> 每一步探索都是成长宝藏，继续加油！")
		if err != nil {
			log.Printf("[GrowthStory] cycle=%d 使用本地降级故事（AI 失败原因：%v）", cycleID, err)
		}
		content = strings.Join(parts, "\n")
		title = fmt.Sprintf("%s 的阶段回顾", childName)
	}

	// 8.5 AI 成功但未写主题时，补齐主题回顾区块
	if aiOK && len(themeGroups) > 0 && !strings.Contains(content, "主题") {
		var themeParts []string
		themeParts = append(themeParts, "\n### 🎯 主题探索\n")
		themeParts = append(themeParts, "你正在主题任务里勇敢尝试，主动观察和提问的样子真棒。\n")
		themeParts = append(themeParts, "\n### 🎯 主题任务回顾\n")
		for _, g := range themeGroups {
			if g.AllCompleted {
				themeParts = append(themeParts, fmt.Sprintf("- **%s**：已完成（%d/%d）", g.Parent.Title, g.CompletedCount, g.TotalCount))
			} else {
				themeParts = append(themeParts, fmt.Sprintf("- **%s**：进行中（%d/%d）", g.Parent.Title, g.CompletedCount, g.TotalCount))
			}
		}
		content = content + strings.Join(themeParts, "\n")
	}
	// 软截断：保留完整分节文案，仅防止极端超长
	content = truncateStoryContent(content, 900)

	// 9. 创建 GrowthStory 记录
	photosJSON := ""
	if len(photoURLs) > 0 {
		data, _ := json.Marshal(photoURLs)
		photosJSON = string(data)
	}
	if yearbookJSON == "" {
		yearbookJSON = marshalYearbookCopy(buildLocalYearbookCopy(childName, cycle.Name, tasks, photoTaskTitles, abilityDeltas))
	}
	// 相册旁白以识图为准（看画面，而不是任务标题）
	if len(photoURLs) > 0 {
		visionCaps := s.generatePhotoCaptionsFromImages(photoURLs, photoTaskTitles)
		yearbookJSON = applyVisionCaptionsToYearbook(yearbookJSON, visionCaps)
	}
	story := &model.GrowthStory{
		CycleID:        cycleID,
		FamilyID:       familyID,
		ChildID:        childID,
		Title:          title,
		Content:        content,
		AbilitySummary: abilitySummaryJSON,
		PhotoUrls:      photosJSON,
		YearbookCopy:   yearbookJSON,
	}
	if err := database.DB.Create(story).Error; err != nil {
		log.Printf("[GrowthStory] 保存成长故事失败 cycle=%d: %v", cycleID, err)
		// generationFailed 初始即为 true（Fail-Safe），保持不变
		return nil, errors.New("保存成长故事失败")
	}

	// 10. 标记周期 status=completed
	cycle.Status = "completed"
	if err := database.DB.Save(&cycle).Error; err != nil {
		log.Printf("[GrowthStory] 标记周期 %d 为 completed 失败: %v", cycleID, err)
		// 故事已保存成功，但周期状态异常——保留 reviewing
		// 下次请求时因幂等检查（已有故事）会直接返回故事，不影响用户体验
	}

	// 11. 标记已养成的习惯（IsActive=false），下次目标设置时 preset 接口不再返回该习惯
	// 用规则判断：TotalCount >= HabitGoal * 0.8 视为已养成。
	// 此步骤独立于 AI 评估，失败仅记录日志，不影响故事生成结果。
	s.markFormedHabits(habitStats)

	// 关键：所有步骤成功后，取消失败回滚标记
	// 注意：必须在 100% 成功后才赋值，否则 Fail-Safe 默认回滚
	generationFailed = false

	log.Printf("[GrowthStory] 周期 %d 成长故事生成完成 story=%d", cycleID, story.ID)
	sanitizeGrowthStory(story)
	return story, nil
}

// GetStory 按 cycle_id + family_id 查询成长故事（加家庭归属校验，禁止越权读别家故事）
// 注意：cycle_id 为 0 的 project 类型故事不会被命中，需要用 GetStoryByID
func (s *GrowthStoryService) GetStory(cycleID, familyID uint) (*model.GrowthStory, error) {
	var story model.GrowthStory
	if err := database.DB.Where("cycle_id = ? AND family_id = ?", cycleID, familyID).First(&story).Error; err != nil {
		return nil, errors.New("成长故事不存在")
	}
	sanitizeGrowthStory(&story)
	return &story, nil
}

// GetStoryByID 按成长故事主键 ID + family_id 查询（支持 cycle 和 project 两种类型）
// 比 GetStory 更通用，project 类型故事（cycle_id=0）必须通过此接口查询
func (s *GrowthStoryService) GetStoryByID(storyID, familyID uint) (*model.GrowthStory, error) {
	var story model.GrowthStory
	if err := database.DB.Where("id = ? AND family_id = ?", storyID, familyID).First(&story).Error; err != nil {
		return nil, errors.New("成长故事不存在")
	}
	sanitizeGrowthStory(&story)
	return &story, nil
}

// GenerateProjectStory 为指定大师挑战实例生成项目式成长故事
// V3.1 模块 B：写入 GrowthStory（type='project'，master_challenge_instance_id=instanceID）
// 幂等：若该实例已有 project 故事记录，直接返回已有故事
func (s *GrowthStoryService) GenerateProjectStory(instanceID uint) (*model.GrowthStory, error) {
	// 0. 幂等检查
	var existing model.GrowthStory
	if err := database.DB.Where("type = ? AND master_challenge_instance_id = ?", "project", instanceID).First(&existing).Error; err == nil {
		log.Printf("[GrowthStory] 大师挑战实例 %d 已有项目故事 story=%d，返回已有故事", instanceID, existing.ID)
		sanitizeGrowthStory(&existing)
		if strings.TrimSpace(existing.YearbookCopy) == "" {
			if filled, err := s.EnsureYearbookCopy(existing.ID, existing.FamilyID); err == nil && filled != nil {
				return filled, nil
			}
		}
		return &existing, nil
	}

	// 1. 查询实例
	var instance model.MasterChallengeInstance
	if err := database.DB.First(&instance, instanceID).Error; err != nil {
		return nil, errors.New("大师挑战实例不存在")
	}

	// 2. 查询阶段与提交
	var stages []model.MasterChallengeStage
	database.DB.Where("instance_id = ?", instanceID).Order("stage_index ASC").Find(&stages)

	var submission model.MasterChallengeSubmission
	hasSubmission := false
	if err := database.DB.Where("instance_id = ?", instanceID).Order("created_at DESC").First(&submission).Error; err == nil {
		hasSubmission = true
	}

	// 查询孩子姓名
	childName := ""
	var child model.User
	if err := database.DB.Where("id = ? AND role = ?", instance.ChildID, model.RoleChild).First(&child).Error; err == nil {
		childName = child.Nickname
	}

	// 3. 构造 AI prompt
	prompt := s.buildProjectStoryPrompt(childName, instance, stages, submission, hasSubmission)

	// 4. 调用 AI
	reply, err := s.aiService.Chat(prompt, nil, "请根据上述信息生成大师挑战项目式成长故事，返回 JSON 格式")
	if err != nil {
		log.Printf("[GrowthStory] AI 调用失败 instance=%d: %v", instanceID, err)
	}

	// 5. 解析 AI 返回（解析失败时降级）
	title := "大师挑战成长故事：" + instance.Title
	content := ""
	if reply != "" {
		cleaned := cleanJSONResponse(reply)
		if strings.HasPrefix(cleaned, "{") {
			var result aiStoryResult
			if json.Unmarshal([]byte(cleaned), &result) == nil {
				if result.Title != "" {
					title = result.Title
				}
				if result.Content != "" {
					content = result.Content
				}
			} else {
				content = reply
			}
		} else {
			content = reply
		}
	}

	// 6. 拼接能力摘要（参与维度 + 评分）
	abilitySummary := ""
	if hasSubmission {
		summary := map[string]interface{}{
			"participation_score": submission.ParticipationScore,
			"application_score":   submission.ApplicationScore,
			"quality_score":       submission.QualityScore,
			"passed":              submission.Passed,
			"points_awarded":      submission.PointsAwarded,
		}
		if data, err := json.Marshal(summary); err == nil {
			abilitySummary = string(data)
		}
	}

	// 7. 提取附件作为相册（最多 5 张）
	photoURLs := make([]string, 0, 5)
	if hasSubmission && submission.Attachments != "" {
		var urls []string
		if json.Unmarshal([]byte(submission.Attachments), &urls) == nil {
			for _, u := range urls {
				if len(photoURLs) >= 5 {
					break
				}
				photoURLs = append(photoURLs, u)
			}
		}
	}
	photosJSON := ""
	if len(photoURLs) > 0 {
		data, _ := json.Marshal(photoURLs)
		photosJSON = string(data)
	}

	// 8. 写入 GrowthStory（type='project'）
	instanceIDVal := instanceID
	story := &model.GrowthStory{
		CycleID:                   0, // 项目故事不关联周期
		FamilyID:                  instance.FamilyID,
		ChildID:                   instance.ChildID,
		Title:                     title,
		Content:                   content,
		AbilitySummary:            abilitySummary,
		PhotoUrls:                 photosJSON,
		Type:                      "project",
		MasterChallengeInstanceID: &instanceIDVal,
	}
	if err := database.DB.Create(story).Error; err != nil {
		log.Printf("[GrowthStory] 保存项目故事失败 instance=%d: %v", instanceID, err)
		return nil, errors.New("保存项目成长故事失败")
	}

	log.Printf("[GrowthStory] 大师挑战实例 %d 项目故事生成完成 story=%d", instanceID, story.ID)
	if filled, err := s.EnsureYearbookCopy(story.ID, story.FamilyID); err == nil && filled != nil {
		return filled, nil
	}
	sanitizeGrowthStory(story)
	return story, nil
}

// sanitizeGrowthStory 清理成长故事长文本字段中的非法控制字符，
// 确保 Go JSON 序列化后的响应能被前端 Node/axios 的严格 JSON.parse 正确解析。
//
// 根因背景：旧故事的 Content/Title/AbilitySummary 里可能含有未被转义的 LF/CR/FF/换页符
// 或其他 C0/C1 控制字符。Gin 的 c.JSON（json.Marshal）通常只对 LF/CR/TAB 做转义，
// 其他控制字符会以裸码点形式写入 JSON，导致前端 JSON.parse 抛出
// "Bad control character in string literal" 错误，axios 直接进入 error 分支。
func sanitizeGrowthStory(s *model.GrowthStory) {
	if s == nil {
		return
	}
	s.Title = sanitizeTextForJSON(s.Title)
	s.Content = sanitizeTextForJSON(s.Content)
	s.AbilitySummary = sanitizeTextForJSON(s.AbilitySummary)
	s.PhotoUrls = sanitizeTextForJSON(s.PhotoUrls)
	s.YearbookCopy = sanitizeTextForJSON(s.YearbookCopy)
}

// sanitizeTextForJSON 把会破坏 JSON 严格解析的控制字符清理或规范化：
//   - 移除：U+0000-U+001F 中除了 TAB(9)、LF(10)、CR(13) 之外的所有 C0 控制字符
//   - 移除：DEL (U+007F) 与 C1 控制字符 (U+0080-U+009F)
//   - 规范换行：\r\n、\r 统一为 \n；垂直制表 / 换页符 视作换行
//   - 连续超过 2 个空行压缩为最多 2 个
func sanitizeTextForJSON(s string) string {
	if s == "" {
		return s
	}
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch {
		case r == 0x09: // TAB
			b.WriteRune(r)
		case r == 0x0D: // CR -> LF
			b.WriteRune('\n')
		case r == 0x0A: // LF
			b.WriteRune('\n')
		case r == 0x0B || r == 0x0C: // 垂直制表 / 换页 -> LF
			b.WriteRune('\n')
		case r <= 0x1F:
			continue
		case 0x7F <= r && r <= 0x9F:
			continue
		default:
			b.WriteRune(r)
		}
	}
	out := b.String()
	// 连续 3 个及以上空行折叠成 2 个
	for strings.Contains(out, "\n\n\n") {
		out = strings.ReplaceAll(out, "\n\n\n", "\n\n")
	}
	return out
}

// buildProjectStoryPrompt 构造大师挑战项目故事生成提示词
func (s *GrowthStoryService) buildProjectStoryPrompt(childName string, instance model.MasterChallengeInstance, stages []model.MasterChallengeStage, submission model.MasterChallengeSubmission, hasSubmission bool) string {
	var parts []string
	parts = append(parts, fmt.Sprintf("你是儿童成长记录师。请为儿童 %s 完成的大师挑战项目 [%s] 生成一段项目式成长故事。",
		childName, instance.Title))
	parts = append(parts, fmt.Sprintf("项目状态：%s，启动时间：%s。", instance.Status, instance.StartedAt.Format("2006-01-02")))
	if instance.FinalSummary != "" {
		parts = append(parts, fmt.Sprintf("孩子总结：%s", instance.FinalSummary))
	}

	// 阶段进展
	if len(stages) > 0 {
		parts = append(parts, fmt.Sprintf("项目共分 %d 个阶段：", len(stages)))
		for _, st := range stages {
			statusText := st.Status
			if statusText == "" {
				statusText = "pending"
			}
			line := fmt.Sprintf("- 阶段%d [%s] %s（状态：%s", st.StageIndex+1, st.Title, st.Description, statusText)
			if st.Notes != "" {
				line += "，孩子记录：" + st.Notes
			}
			if st.SelfRating > 0 {
				line += fmt.Sprintf("，自评进度：%d/5", st.SelfRating)
			}
			line += "）"
			parts = append(parts, line)
		}
	}

	// 验收评分
	if hasSubmission {
		parts = append(parts, fmt.Sprintf("家长验收评分：参与度 %d/5，能力应用度 %d/5，成果满意度 %d/5，%s。",
			submission.ParticipationScore, submission.ApplicationScore, submission.QualityScore,
			map[bool]string{true: "通过", false: "未通过"}[submission.Passed]))
		if submission.ChildSummary != "" {
			parts = append(parts, fmt.Sprintf("孩子一句话总结：%s", submission.ChildSummary))
		}
		if submission.PointsAwarded > 0 {
			parts = append(parts, fmt.Sprintf("获得稀有积分奖励：%d。", submission.PointsAwarded))
		}
	}

	parts = append(parts, "要求：生成富有温度的项目式成长故事，突出孩子在项目中展现的能力进阶与心路历程，包含标题、正文（300-600 字）。")
	parts = append(parts, "返回纯 JSON（不要 markdown 代码块），格式：{\"title\":\"...\",\"content\":\"...\"}")
	return strings.Join(parts, "\n")
}

// ListStories 查询儿童所有成长故事（按时间倒序）
func (s *GrowthStoryService) ListStories(childID, familyID uint, page, pageSize int) ([]model.GrowthStory, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	var stories []model.GrowthStory
	var total int64
	db := database.DB.Where("child_id = ? AND family_id = ?", childID, familyID)
	db.Model(&model.GrowthStory{}).Count(&total)
	if err := db.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&stories).Error; err != nil {
		return nil, 0, err
	}
	for i := range stories {
		sanitizeGrowthStory(&stories[i])
	}
	return stories, total, nil
}

// GetCycleTasks 查询周期内所有任务（按时间正序），供故事详情页展示子任务时间线
func (s *GrowthStoryService) GetCycleTasks(cycleID, familyID uint) ([]model.Task, error) {
	var cycle model.GrowthCycle
	if err := database.DB.Where("id = ? AND family_id = ?", cycleID, familyID).First(&cycle).Error; err != nil {
		return nil, errors.New("周期不存在")
	}
	var tasks []model.Task
	database.DB.Where("family_id = ? AND child_id = ? AND status = ? AND created_at BETWEEN ? AND ?",
		familyID, cycle.ChildID, model.TaskStatusCompleted, cycle.StartDate, cycle.EndDate).
		Order("created_at ASC").Find(&tasks)
	return tasks, nil
}

// buildStoryPrompt 构造成长故事生成提示词（三区块结构：日常任务 / 习惯养成 / 主题任务）
// Prompt 清晰分为三区块，每个区块独立呈现；无数据的区块自动跳过，避免生成空内容。
// AI 调用使用现有封装（s.aiService.Chat），此处仅构造 prompt 文本。
func (s *GrowthStoryService) buildStoryPrompt(childName string, cycle model.GrowthCycle, tasks []model.Task, deltas []AbilityDelta, photos []string, photoTaskTitles []string, habitStats []habitStat, themeGroups []themeTaskGroup) string {
	var parts []string
	parts = append(parts, fmt.Sprintf("你是一位专业的儿童成长记录师。请基于以下信息为儿童 %s 在周期 [%s]（%s ~ %s）生成本周期的成长故事。",
		childName, cycle.Name,
		cycle.StartDate.Format("2006-01-02"), cycle.EndDate.Format("2006-01-02")))
	parts = append(parts, "故事应包含三区块的内容回顾：日常任务、习惯养成、主题任务。每个区块给出独立的评价和鼓励，整体语调温暖、积极，关注孩子的成长过程。若某区块无数据则跳过，不生成空内容。")

	// ===== 区块一：日常任务（完成任务列表 + 任务数量 + 能力变化 + 精选照片）=====
	parts = append(parts, "\n## 日常任务")
	if len(tasks) > 0 {
		parts = append(parts, fmt.Sprintf("完成任务数：%d 条", len(tasks)))
		parts = append(parts, "任务列表：")
		limit := len(tasks)
		if limit > 20 {
			limit = 20
		}
		for i := 0; i < limit; i++ {
			t := tasks[i]
			parts = append(parts, fmt.Sprintf("- %s（%s，%d 积分）", t.Title, t.Category, t.Points))
		}
		// 能力维度变化（日常任务带来的能力提升，作为本区块的补充信息）
		if len(deltas) > 0 {
			var deltaStrs []string
			for _, d := range deltas {
				if d.Delta > 0 {
					deltaStrs = append(deltaStrs, fmt.Sprintf("%s：%d→%d（+%d）", d.DimensionName, d.OldScore, d.NewScore, d.Delta))
				} else if d.Delta < 0 {
					deltaStrs = append(deltaStrs, fmt.Sprintf("%s：%d→%d（%d）", d.DimensionName, d.OldScore, d.NewScore, d.Delta))
				} else {
					deltaStrs = append(deltaStrs, fmt.Sprintf("%s：%d（持平）", d.DimensionName, d.NewScore))
				}
			}
			parts = append(parts, fmt.Sprintf("能力维度变化：%s。", strings.Join(deltaStrs, "，")))
		}
		// 精选照片
		if len(photos) > 0 {
			parts = append(parts, fmt.Sprintf("周期内共有 %d 张精选成果照片。", len(photos)))
		}
	} else {
		parts = append(parts, "周期内暂无完成的任务记录。")
	}

	// ===== 区块二：习惯养成（习惯名 + 本阶段打卡数 + 连续天数 + 累计天数 + 目标 + 家长批语 + AI 评估养成程度）=====
	// 无习惯目标时跳过该区块，不生成空内容
	if len(habitStats) > 0 {
		parts = append(parts, "\n## 习惯养成")
		parts = append(parts, "请根据以下数据评估每个习惯的养成程度（已养成/基本养成/待加强），并在故事中融入习惯养成的小结：")
		parts = append(parts, "养成程度判定标准（请严格执行）：累计完成率≥80% 为已养成，≥50% 为基本养成，其余为待加强。")
		for _, st := range habitStats {
			line := fmt.Sprintf("- %s：本阶段打卡 %d 天，连续坚持 %d 天，历史累计 %d 天（目标 %d 天）",
				st.HabitTitle, st.CycleCount, st.StreakCount, st.TotalCount, st.HabitGoal)
			if st.ParentComment != "" {
				line += fmt.Sprintf("，家长批语：「%s」", st.ParentComment)
			}
			parts = append(parts, line)
		}
		parts = append(parts, "输出格式：每个习惯一行，包含习惯名、养成程度、简短评价，融入故事正文。")
	}

	// ===== 区块三：主题任务（父任务标题 + 完成度 + 子任务 + 关键里程碑）=====
	// 无主题任务时跳过该区块，不生成空内容
	if len(themeGroups) > 0 {
		parts = append(parts, "\n## 主题任务")
		parts = append(parts, "请根据以下主题任务完成情况，在故事中融入主题任务的回顾与评价：")
		for _, g := range themeGroups {
			if g.AllCompleted {
				line := fmt.Sprintf("- %s：已完成全部 %d 个子任务", g.Parent.Title, g.TotalCount)
				if g.DurationDays > 0 {
					line += fmt.Sprintf("（用时约 %d 天）", g.DurationDays)
				}
				keyMilestones := 0
				for _, p := range g.Photos {
					if p.IsKeyMilestone {
						keyMilestones++
					}
				}
				if keyMilestones > 0 {
					line += fmt.Sprintf("，含 %d 个关键里程碑", keyMilestones)
				}
				parts = append(parts, line)
			} else {
				parts = append(parts, fmt.Sprintf("- %s：进行中（完成度 %d/%d）",
					g.Parent.Title, g.CompletedCount, g.TotalCount))
			}
		}
		parts = append(parts, "请在故事正文中评价孩子在主题任务中展现的能力与成长。")
	}

	// ===== 生成要求 =====
	parts = append(parts, "\n## 要求")
	parts = append(parts, "1. content 用 Markdown 分块，结构固定如下（无数据的区块整段省略）：")
	parts = append(parts, "   第一行：一句开场夸奖（称呼孩子名字，可加 **加粗** 关键词），不要标题")
	parts = append(parts, "   ### ☀️ 日常小成就：把完成的日常任务编织进一段连贯叙事，任务名用 **加粗**；可点出 1～2 项能力分变化")
	parts = append(parts, "   ### 🌱 习惯小进步：有习惯数据时单独成段，评价养成程度并鼓励；无习惯数据则整段省略")
	parts = append(parts, "   ### 🎨 主题探索：有主题任务时写一段探索感受与鼓励；无则省略")
	parts = append(parts, "   ### 🎯 主题任务回顾：有主题任务时用列表写完成度，如 `- **小小科学家**：进行中（0/1）`；无则省略")
	parts = append(parts, "   结尾可选一行简短 > 寄语")
	parts = append(parts, "2. 不要用【】方括号标题；口语温暖、具体，像在夸孩子；关键任务名/能力维度用 **加粗**。")
	parts = append(parts, "3. content 全文约 500～800 字（含标点与标题），写得充实有画面感，但不要超过 800 字。")
	parts = append(parts, "4. 额外生成 yearbook 字段：阶段回顾滑动卡片短旁白（每句 12～28 字，口语、具体、有温度；不要出现「年报」）。")
	parts = append(parts, "   - cover / period / first_task / stats / photos / close：各一句")
	parts = append(parts, "   - photo_captions：可省略（系统会按照片画面单独识图生成，不要根据任务标题编造照片旁白）")
	parts = append(parts, `返回纯 JSON（不要外层 markdown 代码块），格式：{"title":"...","content":"...","yearbook":{"cover":"...","period":"...","first_task":"...","stats":"...","photos":"...","close":"..."}}`)
	return strings.Join(parts, "\n")
}

// EnsureYearbookCopy 为已有故事补齐回顾短文案（缺旁白或相册配文时重新生成）
func (s *GrowthStoryService) EnsureYearbookCopy(storyID, familyID uint) (*model.GrowthStory, error) {
	var story model.GrowthStory
	if err := database.DB.Where("id = ? AND family_id = ?", storyID, familyID).First(&story).Error; err != nil {
		return nil, errors.New("成长故事不存在")
	}

	childName := ""
	var child model.User
	if err := database.DB.Where("id = ? AND role = ?", story.ChildID, model.RoleChild).First(&child).Error; err == nil {
		childName = child.Nickname
	}
	if childName == "" {
		childName = "宝贝"
	}

	var tasks []model.Task
	var photoTaskTitles []string
	var photoURLs []string
	cycleName := story.Title
	var deltas []AbilityDelta

	if (story.Type == "" || story.Type == "cycle") && story.CycleID > 0 {
		var cycle model.GrowthCycle
		if err := database.DB.First(&cycle, story.CycleID).Error; err == nil {
			if cycle.Name != "" {
				cycleName = cycle.Name
			}
			database.DB.Where("family_id = ? AND child_id = ? AND status = ? AND created_at BETWEEN ? AND ?",
				familyID, story.ChildID, model.TaskStatusCompleted, cycle.StartDate, cycle.EndDate).
				Order("created_at ASC").Find(&tasks)

			var albumTasks []model.Task
			database.DB.Where("family_id = ? AND child_id = ? AND photo IS NOT NULL AND photo != '' AND created_at BETWEEN ? AND ?",
				familyID, story.ChildID, cycle.StartDate, cycle.EndDate).
				Order("created_at ASC").Limit(16).Find(&albumTasks)
			for _, t := range albumTasks {
				for _, u := range taskPhotoURLs(t.Photo) {
					if len(photoURLs) >= 12 {
						break
					}
					photoURLs = append(photoURLs, u)
					photoTaskTitles = append(photoTaskTitles, t.Title)
				}
				if len(photoURLs) >= 12 {
					break
				}
			}
		}
	}
	if len(photoURLs) == 0 && story.PhotoUrls != "" {
		for _, u := range taskPhotoURLs(story.PhotoUrls) {
			if len(photoURLs) >= 12 {
				break
			}
			photoURLs = append(photoURLs, u)
			photoTaskTitles = append(photoTaskTitles, "精彩瞬间")
		}
	}
	if story.AbilitySummary != "" {
		_ = json.Unmarshal([]byte(story.AbilitySummary), &deltas)
	}

	photoCount := len(photoURLs)
	if !yearbookNeedsRefresh(story.YearbookCopy, photoCount) {
		sanitizeGrowthStory(&story)
		return &story, nil
	}

	totalPoints := 0
	for _, t := range tasks {
		totalPoints += t.Points
	}
	firstTitle := ""
	if len(tasks) > 0 {
		firstTitle = tasks[0].Title
	}

	prompt := buildYearbookOnlyPrompt(childName, cycleName, story.Type, tasks, firstTitle, totalPoints, photoCount, photoTaskTitles, deltas)
	reply, err := s.aiService.Chat(prompt, nil, "请只返回 yearbook JSON，旁白要短；photo_captions 可省略")
	if err != nil {
		log.Printf("[GrowthStory] 回顾文案 AI 失败 story=%d: %v", storyID, err)
	}

	yearbookJSON := ""
	if reply != "" {
		cleaned := cleanJSONResponse(reply)
		var wrapped struct {
			Yearbook *aiYearbookCopy `json:"yearbook"`
		}
		if json.Unmarshal([]byte(cleaned), &wrapped) == nil && wrapped.Yearbook != nil {
			yearbookJSON = marshalYearbookCopy(normalizeYearbookCopy(wrapped.Yearbook))
		} else {
			var direct aiYearbookCopy
			if json.Unmarshal([]byte(cleaned), &direct) == nil {
				yearbookJSON = marshalYearbookCopy(normalizeYearbookCopy(&direct))
			}
		}
	}
	if yearbookJSON == "" {
		yearbookJSON = marshalYearbookCopy(buildLocalYearbookCopy(childName, cycleName, tasks, photoTaskTitles, deltas))
	}
	if len(photoURLs) > 0 {
		visionCaps := s.generatePhotoCaptionsFromImages(photoURLs, photoTaskTitles)
		yearbookJSON = applyVisionCaptionsToYearbook(yearbookJSON, visionCaps)
	}

	if err := database.DB.Model(&story).Update("yearbook_copy", yearbookJSON).Error; err != nil {
		log.Printf("[GrowthStory] 保存回顾文案失败 story=%d: %v", storyID, err)
		return nil, errors.New("保存回顾文案失败")
	}
	story.YearbookCopy = yearbookJSON
	sanitizeGrowthStory(&story)
	return &story, nil
}

func yearbookCopyComplete(raw string) bool {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return false
	}
	var y aiYearbookCopy
	if json.Unmarshal([]byte(raw), &y) != nil {
		return false
	}
	return y.Cover != "" || y.Close != "" || y.Stats != ""
}

func yearbookNeedsRefresh(raw string, photoCount int) bool {
	if !yearbookCopyComplete(raw) {
		return true
	}
	if photoCount <= 0 {
		return false
	}
	var y aiYearbookCopy
	if json.Unmarshal([]byte(raw), &y) != nil {
		return true
	}
	return len(y.PhotoCaptions) == 0
}

func taskPhotoURLs(photo string) []string {
	s := strings.TrimSpace(photo)
	if s == "" {
		return nil
	}
	if strings.HasPrefix(s, "[") {
		var arr []string
		if json.Unmarshal([]byte(s), &arr) == nil {
			out := make([]string, 0, len(arr))
			for _, u := range arr {
				u = strings.TrimSpace(u)
				if u == "" {
					continue
				}
				// 嵌套 JSON 数组字符串时再展平
				if strings.HasPrefix(u, "[") {
					out = append(out, taskPhotoURLs(u)...)
					continue
				}
				out = append(out, u)
			}
			return out
		}
	}
	return []string{s}
}

func marshalYearbookCopy(y *aiYearbookCopy) string {
	if y == nil {
		return ""
	}
	data, err := json.Marshal(y)
	if err != nil {
		return ""
	}
	return string(data)
}

func truncateRunes(s string, max int) string {
	rs := []rune(strings.TrimSpace(s))
	if max <= 0 || len(rs) <= max {
		return string(rs)
	}
	return string(rs[:max])
}

// truncateStoryContent 截断过长的成长故事正文，尽量在句号处收束。
func truncateStoryContent(s string, maxRunes int) string {
	rs := []rune(strings.TrimSpace(s))
	if maxRunes <= 0 || len(rs) <= maxRunes {
		return string(rs)
	}
	cut := rs[:maxRunes]
	best := -1
	for i := len(cut) - 1; i >= maxRunes*2/5; i-- {
		if cut[i] == '。' || cut[i] == '！' || cut[i] == '\n' {
			best = i
			break
		}
	}
	if best > 0 {
		return string(cut[:best+1])
	}
	return string(cut) + "…"
}

func normalizeYearbookCopy(y *aiYearbookCopy) *aiYearbookCopy {
	if y == nil {
		return &aiYearbookCopy{}
	}
	caps := make([]string, 0, len(y.PhotoCaptions))
	for _, c := range y.PhotoCaptions {
		c = truncateRunes(c, 28)
		if c != "" {
			caps = append(caps, c)
		}
	}
	return &aiYearbookCopy{
		Cover:         truncateRunes(y.Cover, 28),
		Period:        truncateRunes(y.Period, 28),
		FirstTask:     truncateRunes(y.FirstTask, 32),
		Stats:         truncateRunes(y.Stats, 28),
		Photos:        truncateRunes(y.Photos, 28),
		Close:         truncateRunes(y.Close, 32),
		PhotoCaptions: caps,
	}
}

func buildLocalYearbookCopy(childName, stageName string, tasks []model.Task, photoTaskTitles []string, deltas []AbilityDelta) *aiYearbookCopy {
	_ = childName
	y := &aiYearbookCopy{
		Cover:  "把小小坚持，收进这一页回顾",
		Period: "目标定下，日子就慢慢发光",
		Close:  "这一阶段的每一步，都值得被看见",
	}
	if stageName != "" {
		y.Cover = truncateRunes("关于「"+stageName+"」的温暖小结", 28)
	}
	if len(tasks) == 0 {
		y.FirstTask = "下一阶段从第一个小任务开始就好"
		y.Stats = "空着也没关系，成长从陪伴开始"
	} else {
		y.FirstTask = truncateRunes("从「"+tasks[0].Title+"」迈出第一步", 32)
		y.Stats = "每一次完成，都在悄悄长本事"
	}
	if len(photoTaskTitles) > 0 {
		y.Photos = "这些画面，把成长留住了"
		// 占位；真正旁白由识图 generatePhotoCaptionsFromImages 覆盖
		y.PhotoCaptions = make([]string, len(photoTaskTitles))
		for i := range photoTaskTitles {
			y.PhotoCaptions[i] = "定格这一刻的小小闪光"
		}
	} else {
		y.Photos = "下次完成任务时，拍一张更有故事"
	}
	up := 0
	for _, d := range deltas {
		if d.Delta > 0 {
			up++
		}
	}
	if up > 0 {
		y.Close = truncateRunes(fmt.Sprintf("有 %d 项能力在向上，继续加油", up), 32)
	}
	return y
}

func buildYearbookOnlyPrompt(
	childName, cycleName, storyType string,
	tasks []model.Task,
	firstTitle string,
	totalPoints, photoCount int,
	photoTaskTitles []string,
	deltas []AbilityDelta,
) string {
	var parts []string
	parts = append(parts, fmt.Sprintf("你是儿童成长记录师。请为 %s 的阶段回顾写 6 句短旁白。", childName))
	parts = append(parts, "要求：每句 12～28 字；口语温暖；不要重复任务数/积分/日期数字；不要 markdown；文案中不要出现「年报」二字，统一用「回顾」或自然口语。")
	if cycleName != "" {
		parts = append(parts, fmt.Sprintf("阶段名称：%s", cycleName))
	}
	if storyType == "project" {
		parts = append(parts, "类型：大师挑战回顾")
	}
	parts = append(parts, fmt.Sprintf("完成任务数：%d，总积分：%d，照片数：%d", len(tasks), totalPoints, photoCount))
	if firstTitle != "" {
		parts = append(parts, fmt.Sprintf("首个任务：%s", firstTitle))
	}
	if len(tasks) > 0 {
		parts = append(parts, "任务摘录：")
		limit := len(tasks)
		if limit > 12 {
			limit = 12
		}
		for i := 0; i < limit; i++ {
			parts = append(parts, fmt.Sprintf("- %s（%d 积分）", tasks[i].Title, tasks[i].Points))
		}
	}
	if len(photoTaskTitles) > 0 {
		parts = append(parts, fmt.Sprintf("请为以下 %d 张相册照片各写一句短旁白（photo_captions，顺序对应，12～24 字）：", len(photoTaskTitles)))
		for i, title := range photoTaskTitles {
			if title == "" {
				title = "精彩瞬间"
			}
			parts = append(parts, fmt.Sprintf("%d. %s", i+1, title))
		}
	}
	if len(deltas) > 0 {
		var ds []string
		for _, d := range deltas {
			if d.Delta > 0 {
				ds = append(ds, fmt.Sprintf("%s+ %d", d.DimensionName, d.Delta))
			} else if d.Delta < 0 {
				ds = append(ds, fmt.Sprintf("%s%d", d.DimensionName, d.Delta))
			} else {
				ds = append(ds, d.DimensionName+"持平")
			}
		}
		parts = append(parts, "能力变化："+strings.Join(ds, "，"))
	}
	parts = append(parts, `只返回 JSON：{"yearbook":{"cover":"...","period":"...","first_task":"...","stats":"...","photos":"...","close":"...","photo_captions":["..."]}}`)
	return strings.Join(parts, "\n")
}
