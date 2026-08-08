package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"growpocket/internal/util/timeutil"
	"log"
	"sort"
	"strings"
)

// ParentTaskService 负责主题任务（父任务）创建、子任务大纲生成与分批实例化
type ParentTaskService struct {
	aiService *AIService
}

// NewParentTaskService 创建主题任务服务（aiService 用于生成子任务大纲，可为 nil 时走降级文案）
func NewParentTaskService(aiService *AIService) *ParentTaskService {
	return &ParentTaskService{aiService: aiService}
}

// subTaskOutlineItem 子任务大纲项（JSON 序列化后存入 parent.SubTaskOutline）
type subTaskOutlineItem struct {
	Title          string `json:"title"`
	Description    string `json:"description"`
	EstimatedDays  int    `json:"estimated_days"`
	Sequence       int    `json:"sequence"`
	IsKeyMilestone bool   `json:"is_key_milestone"`
	Points         int    `json:"points"`
}

// CreateParentTaskInput 创建父任务入参
type CreateParentTaskInput struct {
	FamilyID      uint
	ChildID       uint
	ChildName     string
	CreatedBy     uint
	TemplateID    uint   // 从模板创建时传入（与 Title 二选一）
	Title         string // 自定义创建时传入
	Description   string
	EstimatedDays int
	Category      string
}

// CreateParentTask 创建主题任务（父任务）
// 支持两种方式：
//  1. template_id 不为 0：从 TaskTemplate(template_type='parent') 创建
//  2. 自定义创建：使用 title + description + estimated_days + category
//
// 创建后自动调用 GenerateSubTaskOutline 生成大纲并实例化第 1 个子任务
func (s *ParentTaskService) CreateParentTask(input CreateParentTaskInput) (*model.Task, error) {
	if input.FamilyID == 0 || input.ChildID == 0 {
		return nil, errors.New("family_id 和 child_id 不能为空")
	}

	var (
		title         string
		description   string
		estimatedDays int
		category      string
		templateID    uint
		keyMilestones string
	)

	if input.TemplateID != 0 {
		// 从模板创建（统一查 TaskTemplate WHERE template_type='parent'）
		var tpl model.TaskTemplate
		if err := database.DB.Where("id = ? AND template_type = ?", input.TemplateID, "parent").First(&tpl).Error; err != nil {
			return nil, errors.New("主题任务模板不存在")
		}
		title = tpl.Title
		description = tpl.Description
		estimatedDays = tpl.EstimatedDays
		category = tpl.Category
		templateID = tpl.ID
		keyMilestones = tpl.KeyMilestones
	} else {
		// 自定义创建
		if strings.TrimSpace(input.Title) == "" {
			return nil, errors.New("title 不能为空")
		}
		title = input.Title
		description = input.Description
		estimatedDays = input.EstimatedDays
		category = input.Category
		if estimatedDays <= 0 {
			estimatedDays = 14
		}
	}

	parent := &model.Task{
		FamilyID:    input.FamilyID,
		Title:       title,
		Description: description,
		Points:      0,
		Status:      model.TaskStatusInProgress,
		ChildID:     input.ChildID,
		ChildName:   input.ChildName,
		CreatedBy:   input.CreatedBy,
		TaskKind:    "parent",
		ParentID:    0,
		Category:    category,
		TemplateID:  templateID,
	}
	if err := database.DB.Create(parent).Error; err != nil {
		return nil, errors.New("创建主题任务失败")
	}

	// 生成子任务大纲并实例化第 1 个
	if err := s.generateSubTaskOutlineWithDays(parent.ID, keyMilestones, estimatedDays); err != nil {
		log.Printf("[ParentTask] 生成子任务大纲失败 parent=%d: %v", parent.ID, err)
		// 大纲生成失败不阻断父任务创建，返回父任务本身
	}

	// 重新加载父任务（SubTaskOutline 已在 GenerateSubTaskOutline 中更新）
	if err := database.DB.First(parent, parent.ID).Error; err != nil {
		return nil, errors.New("加载主题任务失败")
	}
	return parent, nil
}

// GenerateSubTaskOutline 为父任务生成子任务大纲（3-8 个），并实例化第 1 个子任务
// keyMilestonesSeed：从模板继承的 KeyMilestones JSON（可空，作为 AI prompt 参考）
// 若已存在大纲，覆盖重新生成；同时清理已实例化的旧 child 任务
// 重新生成时 estimatedDays 未知，传 0 让 AI 自行推断
func (s *ParentTaskService) GenerateSubTaskOutline(parentTaskID uint, keyMilestonesSeed string) error {
	return s.generateSubTaskOutlineWithDays(parentTaskID, keyMilestonesSeed, 0)
}

// generateSubTaskOutlineWithDays 内部实现，可携带父任务预计总天数用于 AI prompt
func (s *ParentTaskService) generateSubTaskOutlineWithDays(parentTaskID uint, keyMilestonesSeed string, estimatedDays int) error {
	var parent model.Task
	if err := database.DB.First(&parent, parentTaskID).Error; err != nil {
		return errors.New("父任务不存在")
	}
	if parent.TaskKind != "parent" {
		return errors.New("该任务不是主题任务")
	}

	// 查孩子档案（用于年龄适配）
	var child model.User
	if err := database.DB.Where("id = ? AND family_id = ?", parent.ChildID, parent.FamilyID).First(&child).Error; err != nil {
		return errors.New("孩子档案不存在")
	}
	age := ResolveAge(&child)

	// 已有大纲覆盖：清理已实例化的 child 任务
	if parent.SubTaskOutline != "" {
		if err := database.DB.Where("parent_id = ? AND task_kind = ?", parent.ID, "child").
			Delete(&model.Task{}).Error; err != nil {
			log.Printf("[ParentTask] 清理旧 child 任务失败 parent=%d: %v", parent.ID, err)
		}
	}

	outline, err := s.callAIGenerateOutline(parent, age, keyMilestonesSeed, estimatedDays)
	if err != nil {
		log.Printf("[ParentTask] AI 生成大纲失败 parent=%d: %v，使用 fallback", parent.ID, err)
		outline = s.fallbackOutline(parent.Title, parent.Description, estimatedDays)
	}

	// 序列化存入 SubTaskOutline
	outlineJSON, err := json.Marshal(outline)
	if err != nil {
		return fmt.Errorf("大纲序列化失败: %w", err)
	}
	if err := database.DB.Model(&parent).Update("sub_task_outline", string(outlineJSON)).Error; err != nil {
		return errors.New("保存子任务大纲失败")
	}

	// 立即实例化第 1 个子任务
	if len(outline) > 0 {
		if _, err := s.instantiateChild(parent, outline[0]); err != nil {
			log.Printf("[ParentTask] 首批实例化失败 parent=%d: %v", parent.ID, err)
		}
	}
	return nil
}

// callAIGenerateOutline 调用 AI 生成子任务大纲
func (s *ParentTaskService) callAIGenerateOutline(parent model.Task, age int, keyMilestonesSeed string, estimatedDays int) ([]subTaskOutlineItem, error) {
	if s.aiService == nil {
		return nil, errors.New("AI 服务未配置")
	}

	ageText := "未知"
	if age > 0 {
		ageText = fmt.Sprintf("%d 岁", age)
	}

	totalDaysLine := ""
	if estimatedDays > 0 {
		totalDaysLine = fmt.Sprintf("预计总天数：%d 天\n", estimatedDays)
	}

	seedHint := ""
	if strings.TrimSpace(keyMilestonesSeed) != "" {
		seedHint = "\n参考的关键里程碑种子（可借鉴结构但需重新设计）：\n" + keyMilestonesSeed
	}

	prompt := fmt.Sprintf(
		"你是儿童项目式学习设计师。请为主题任务设计 3-8 个分阶段推进的子任务大纲。\n"+
			"主题任务标题：%s\n"+
			"主题任务描述：%s\n"+
			"任务类别：%s\n"+
			"孩子年龄：%s\n"+
			totalDaysLine+
			"%s\n\n"+
			"要求：\n"+
			"- 子任务数量 3-8 个，按推进顺序排列\n"+
			"- 每个子任务含 title（≤20字）、description（≤80字）、estimated_days（该阶段预计天数）、is_key_milestone（是否关键里程碑）、points（该阶段积分，10-100）\n"+
			"- 关键里程碑阶段建议给予更高积分\n"+
			"- 建议包含 1-2 个关键里程碑（is_key_milestone=true）\n"+
			"- 如已给定总天数，各阶段 estimated_days 之和应大致等于总天数\n"+
			"- 顺序应体现「准备→执行→总结」的递进逻辑\n"+
			"- 适龄、可执行、有趣\n"+
			"返回纯 JSON 数组（不要 markdown 代码块），格式：\n"+
			`[{"title":"阶段1","description":"描述","estimated_days":2,"is_key_milestone":true,"points":30}]`,
		parent.Title, parent.Description, parent.Category, ageText, seedHint,
	)

	reply, err := s.aiService.Chat(prompt, nil, "请生成子任务大纲")
	if err != nil {
		return nil, fmt.Errorf("AI 调用失败: %w", err)
	}

	cleaned := cleanJSONResponse(reply)
	if !strings.HasPrefix(cleaned, "[") {
		return nil, errors.New("AI 返回格式不是 JSON 数组")
	}

	var items []subTaskOutlineItem
	if err := json.Unmarshal([]byte(cleaned), &items); err != nil {
		return nil, fmt.Errorf("AI 返回 JSON 解析失败: %w", err)
	}
	if len(items) < 3 || len(items) > 8 {
		return nil, fmt.Errorf("AI 返回大纲数量 %d 不在 3-8 范围", len(items))
	}

	// 规范化：补全 sequence、积分默认值、过滤异常项
	out := make([]subTaskOutlineItem, 0, len(items))
	for i := range items {
		t := strings.TrimSpace(items[i].Title)
		if t == "" {
			continue
		}
		if items[i].EstimatedDays <= 0 {
			items[i].EstimatedDays = 1
		}
		if items[i].Points <= 0 {
			items[i].Points = 20
		}
		items[i].Sequence = len(out) + 1
		out = append(out, items[i])
	}
	if len(out) < 3 {
		return nil, fmt.Errorf("AI 返回有效大纲数量 %d 不足 3", len(out))
	}
	return out, nil
}

// fallbackOutline AI 不可用时的降级大纲生成
func (s *ParentTaskService) fallbackOutline(title, description string, totalDays int) []subTaskOutlineItem {
	if totalDays <= 0 {
		totalDays = 14
	}
	// 简单 5 阶段：准备 → 启动 → 推进 → 关键节点 → 总结
	stageDays := []int{1, totalDays / 5, totalDays / 2, totalDays / 5, 1}
	// 修正总数
	sum := 0
	for _, d := range stageDays {
		sum += d
	}
	if sum < totalDays {
		stageDays[2] += totalDays - sum
	}
	titles := []string{"任务准备", "正式启动", "持续推进", "关键节点", "总结复盘"}
	descs := []string{
		fmt.Sprintf("为「%s」准备所需材料与计划", title),
		fmt.Sprintf("正式启动「%s」", title),
		fmt.Sprintf("按计划推进「%s」", title),
		fmt.Sprintf("达成「%s」关键里程碑", title),
		fmt.Sprintf("回顾并总结「%s」", title),
	}
	keyFlags := []bool{true, false, false, true, false}
	stagePoints := []int{10, 20, 20, 30, 20}

	out := make([]subTaskOutlineItem, 0, 5)
	for i := 0; i < 5; i++ {
		out = append(out, subTaskOutlineItem{
			Title:          titles[i],
			Description:    descs[i],
			EstimatedDays:  stageDays[i],
			Sequence:       i + 1,
			IsKeyMilestone: keyFlags[i],
			Points:         stagePoints[i],
		})
	}
	_ = description
	return out
}

// instantiateChild 根据大纲项实例化一个 child 任务
func (s *ParentTaskService) instantiateChild(parent model.Task, item subTaskOutlineItem) (*model.Task, error) {
	points := item.Points
	if points <= 0 {
		points = 20
	}
	now := timeutil.Now()
	child := &model.Task{
		FamilyID:       parent.FamilyID,
		Title:          item.Title,
		Description:    item.Description,
		Points:         points,
		Status:         model.TaskStatusInProgress,
		ChildID:        parent.ChildID,
		ChildName:      parent.ChildName,
		CreatedBy:      parent.CreatedBy,
		TaskKind:       "child",
		ParentID:       parent.ID,
		Category:       parent.Category,
		Sequence:       item.Sequence,
		IsKeyMilestone: item.IsKeyMilestone,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := database.DB.Create(child).Error; err != nil {
		return nil, errors.New("实例化子任务失败")
	}
	return child, nil
}

// AdvanceBatch 推进下一批：找到下一个未实例化的大纲项并实例化
// 若所有大纲都已实例化，返回错误
func (s *ParentTaskService) AdvanceBatch(parentTaskID uint) (*model.Task, error) {
	var parent model.Task
	if err := database.DB.First(&parent, parentTaskID).Error; err != nil {
		return nil, errors.New("父任务不存在")
	}
	if parent.TaskKind != "parent" {
		return nil, errors.New("该任务不是主题任务")
	}
	if strings.TrimSpace(parent.SubTaskOutline) == "" {
		return nil, errors.New("子任务大纲尚未生成")
	}

	var outline []subTaskOutlineItem
	if err := json.Unmarshal([]byte(parent.SubTaskOutline), &outline); err != nil {
		return nil, errors.New("子任务大纲解析失败")
	}
	if len(outline) == 0 {
		return nil, errors.New("子任务大纲为空")
	}

	// 查询已实例化的 child 任务，按 sequence 收集
	var existing []model.Task
	if err := database.DB.Where("parent_id = ? AND task_kind = ?", parent.ID, "child").
		Find(&existing).Error; err != nil {
		return nil, errors.New("查询已实例化子任务失败")
	}
	instantiatedSeq := make(map[int]bool, len(existing))
	for _, t := range existing {
		instantiatedSeq[t.Sequence] = true
	}

	// 按 sequence 排序大纲，找下一个未实例化的
	sort.SliceStable(outline, func(i, j int) bool {
		return outline[i].Sequence < outline[j].Sequence
	})
	for _, item := range outline {
		if !instantiatedSeq[item.Sequence] {
			return s.instantiateChild(parent, item)
		}
	}

	return nil, errors.New("所有子任务已生成完毕")
}

// GetChildren 返回子任务列表：已实例化的（来自 DB）+ 大纲中未实例化的（合成为虚拟 Task）
// 已实例化的在前（按 sequence 升序），未实例化的在后（按 sequence 升序，仅 ID=0 表示尚未实例化）
func (s *ParentTaskService) GetChildren(parentTaskID uint) ([]model.Task, error) {
	var parent model.Task
	if err := database.DB.First(&parent, parentTaskID).Error; err != nil {
		return nil, errors.New("父任务不存在")
	}
	if parent.TaskKind != "parent" {
		return nil, errors.New("该任务不是主题任务")
	}

	// 已实例化
	var existing []model.Task
	if err := database.DB.Where("parent_id = ? AND task_kind = ?", parent.ID, "child").
		Order("sequence ASC").Find(&existing).Error; err != nil {
		return nil, errors.New("查询子任务失败")
	}
	instantiatedSeq := make(map[int]bool, len(existing))

	// 从大纲补全积分为 0 的已实例化子任务
	outlineMap := make(map[int]subTaskOutlineItem)
	if strings.TrimSpace(parent.SubTaskOutline) != "" {
		var outline []subTaskOutlineItem
		if err := json.Unmarshal([]byte(parent.SubTaskOutline), &outline); err == nil {
			for _, item := range outline {
				outlineMap[item.Sequence] = item
			}
		}
	}
	for i := range existing {
		instantiatedSeq[existing[i].Sequence] = true
		if existing[i].Points == 0 {
			if item, ok := outlineMap[existing[i].Sequence]; ok && item.Points > 0 {
				existing[i].Points = item.Points
				database.DB.Model(&model.Task{}).Where("id = ?", existing[i].ID).Update("points", item.Points)
			} else {
				existing[i].Points = 20
				database.DB.Model(&model.Task{}).Where("id = ?", existing[i].ID).Update("points", 20)
			}
		}
	}

	out := make([]model.Task, 0, 8)
	out = append(out, existing...)

	// 大纲中未实例化的合成为虚拟 Task
	if strings.TrimSpace(parent.SubTaskOutline) != "" {
		var outline []subTaskOutlineItem
		if err := json.Unmarshal([]byte(parent.SubTaskOutline), &outline); err == nil {
			sort.SliceStable(outline, func(i, j int) bool {
				return outline[i].Sequence < outline[j].Sequence
			})
			for _, item := range outline {
				if instantiatedSeq[item.Sequence] {
					continue
				}
				points := item.Points
				if points <= 0 {
					points = 20
				}
				out = append(out, model.Task{
					ID:              0,
					FamilyID:        parent.FamilyID,
					Title:           item.Title,
					Description:     item.Description,
					Points:          points,
					Status:          0, // 0 表示未实例化
					ChildID:         parent.ChildID,
					ChildName:       parent.ChildName,
					CreatedBy:       parent.CreatedBy,
					TaskKind:        "child",
					ParentID:        parent.ID,
					Category:        parent.Category,
					Sequence:        item.Sequence,
					IsKeyMilestone:  item.IsKeyMilestone,
				})
			}
		}
	}
	return out, nil
}

// GetParentByChildTaskID 通过 child task id 查询其父任务
func (s *ParentTaskService) GetParentByChildTaskID(childTaskID, familyID uint) (*model.Task, error) {
	var child model.Task
	if err := database.DB.Where("id = ? AND family_id = ?", childTaskID, familyID).First(&child).Error; err != nil {
		return nil, errors.New("子任务不存在")
	}
	if child.TaskKind != "child" || child.ParentID == 0 {
		return nil, errors.New("该任务不是子任务")
	}
	var parent model.Task
	if err := database.DB.Where("id = ? AND family_id = ?", child.ParentID, familyID).First(&parent).Error; err != nil {
		return nil, errors.New("父任务不存在")
	}
	return &parent, nil
}
