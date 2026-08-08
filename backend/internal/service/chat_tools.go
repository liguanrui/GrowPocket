package service

import (
	"context"
	"encoding/json"
	"fmt"
	"growpocket/internal/database"
	"growpocket/internal/model"
	"time"
)

// ===================== 参数提取辅助函数 =====================

// getStringArg 从 args 中取字符串参数，缺失或类型不匹配时返回默认值
func getStringArg(args map[string]any, key, defaultVal string) string {
	if args == nil {
		return defaultVal
	}
	v, ok := args[key]
	if !ok {
		return defaultVal
	}
	s, ok := v.(string)
	if !ok {
		return defaultVal
	}
	return s
}

// getIntArg 从 args 中取整数参数（JSON 数字默认类型为 float64），缺失或类型不匹配时返回默认值
func getIntArg(args map[string]any, key string, defaultVal int) int {
	if args == nil {
		return defaultVal
	}
	v, ok := args[key]
	if !ok {
		return defaultVal
	}
	f, ok := v.(float64)
	if !ok {
		return defaultVal
	}
	return int(f)
}

// taskStatusFromString 将状态字符串转为 Task status 枚举值
// pending=进行中(1), submitted=待验收(2), completed=已完成(3), rejected=已拒绝(4), all=全部(0)
func taskStatusFromString(status string) int {
	switch status {
	case "pending":
		return model.TaskStatusInProgress
	case "submitted":
		return model.TaskStatusSubmitted
	case "completed":
		return model.TaskStatusCompleted
	case "rejected":
		return model.TaskStatusRejected
	case "all":
		return 0
	default:
		return model.TaskStatusInProgress
	}
}

// marshalResult 将任意值序列化为 JSON 字符串
func marshalResult(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", fmt.Errorf("序列化结果失败: %w", err)
	}
	return string(b), nil
}

// ===================== 13 个只读工具的 ExecuteFunc =====================

// 1. query_child_balance 查询儿童当前积分余额
func (s *ChatService) toolQueryChildBalance(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	balance, nickname, err := s.score.GetBalance(childID, familyID)
	if err != nil {
		return "", fmt.Errorf("查询积分余额失败: %w", err)
	}
	return marshalResult(map[string]any{
		"balance":  balance,
		"nickname": nickname,
	})
}

// 2. query_child_scores 查询儿童能力维度得分与成长指数
func (s *ChatService) toolQueryChildScores(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	scores, err := s.ability.GetChildScores(childID, familyID)
	if err != nil {
		return "", fmt.Errorf("查询能力得分失败: %w", err)
	}
	growthIndex, err := s.ability.GetGrowthIndex(childID, familyID)
	if err != nil {
		return "", fmt.Errorf("查询成长指数失败: %w", err)
	}
	// 查询所有维度用于 ID → 名称映射
	dimensions, _ := s.ability.ListDimensions()
	dimNameMap := make(map[uint]string, len(dimensions))
	for _, d := range dimensions {
		dimNameMap[d.ID] = d.Name
	}

	dims := make([]map[string]any, 0, len(scores))
	for _, sc := range scores {
		dims = append(dims, map[string]any{
			"id":            sc.DimensionID,
			"name":          dimNameMap[sc.DimensionID],
			"score":         sc.Score,
			"mastery_stars": sc.MasteryStars,
		})
	}
	return marshalResult(map[string]any{
		"dimensions":   dims,
		"growth_index": growthIndex,
	})
}

// 3. list_tasks 查询任务列表
func (s *ChatService) toolListTasks(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	statusStr := getStringArg(args, "status", "pending")
	page := getIntArg(args, "page", 1)
	pageSize := getIntArg(args, "page_size", 10)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}
	statusInt := taskStatusFromString(statusStr)

	tasks, total, err := s.task.ListTasks(familyID, childID, statusInt, nil, page, pageSize)
	if err != nil {
		return "", fmt.Errorf("查询任务列表失败: %w", err)
	}

	// 查询维度名称映射
	dimensions, _ := s.ability.ListDimensions()
	dimNameMap := make(map[uint]string, len(dimensions))
	for _, d := range dimensions {
		dimNameMap[d.ID] = d.Name
	}

	taskList := make([]map[string]any, 0, len(tasks))
	for _, t := range tasks {
		taskList = append(taskList, map[string]any{
			"id":                     t.ID,
			"title":                  t.Title,
			"points":                 t.Points,
			"status":                 t.Status,
			"difficulty":             t.Difficulty,
			"ability_dimension_name": dimNameMap[t.AbilityDimensionID],
		})
	}
	return marshalResult(map[string]any{
		"tasks": taskList,
		"total": total,
	})
}

// 4. get_task_detail 查询任务详情
func (s *ChatService) toolGetTaskDetail(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	taskID := getIntArg(args, "task_id", 0)
	if taskID <= 0 {
		return "", fmt.Errorf("task_id 参数必填且必须为正整数")
	}
	task, err := s.task.GetTask(uint(taskID), familyID)
	if err != nil {
		return "", fmt.Errorf("查询任务详情失败: %w", err)
	}

	// 查询维度名称
	var dimName string
	if task.AbilityDimensionID > 0 {
		if dim, err := s.ability.GetDimensionByID(task.AbilityDimensionID); err == nil {
			dimName = dim.Name
		}
	}

	return marshalResult(map[string]any{
		"id":                     task.ID,
		"title":                  task.Title,
		"description":            task.Description,
		"points":                 task.Points,
		"status":                 task.Status,
		"difficulty":             task.Difficulty,
		"category":               task.Category,
		"ability_dimension_id":   task.AbilityDimensionID,
		"ability_dimension_name": dimName,
		"photo":                  task.Photo,
		"deadline":               task.Deadline,
		"created_at":             task.CreatedAt,
	})
}

// 5. list_redeem_items 查询兑换商品列表
func (s *ChatService) toolListRedeemItems(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	category := getIntArg(args, "category", 0)
	page := getIntArg(args, "page", 1)
	pageSize := getIntArg(args, "page_size", 10)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	items, total, err := s.redeem.ListItems(familyID, category, page, pageSize)
	if err != nil {
		return "", fmt.Errorf("查询兑换商品失败: %w", err)
	}

	itemList := make([]map[string]any, 0, len(items))
	for _, item := range items {
		itemList = append(itemList, map[string]any{
			"id":              item.ID,
			"name":            item.Name,
			"points_required": item.Points,
			"stock":           item.Stock,
			"category":        item.Category,
			"image_url":       item.Image,
		})
	}
	return marshalResult(map[string]any{
		"items": itemList,
		"total": total,
	})
}

// 6. list_redeem_records 查询兑换记录
func (s *ChatService) toolListRedeemRecords(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	page := getIntArg(args, "page", 1)
	pageSize := getIntArg(args, "page_size", 10)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	records, total, err := s.redeem.GetRedeems(childID, familyID, page, pageSize)
	if err != nil {
		return "", fmt.Errorf("查询兑换记录失败: %w", err)
	}

	recordList := make([]map[string]any, 0, len(records))
	for _, r := range records {
		recordList = append(recordList, map[string]any{
			"id":          r.ID,
			"item_name":   r.ItemName,
			"points_cost": r.Points,
			"redeemed_at": r.CreatedAt,
		})
	}
	return marshalResult(map[string]any{
		"records": recordList,
		"total":   total,
	})
}

// 7. get_growth_timeline 查询成长时间线
func (s *ChatService) toolGetGrowthTimeline(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	days := getIntArg(args, "days", 30)
	if days <= 0 {
		days = 30
	}

	timeline, err := s.growth.Timeline(childID, familyID, days)
	if err != nil {
		return "", fmt.Errorf("查询成长时间线失败: %w", err)
	}
	// 原方法返回 []map[string]interface{}，直接 marshal
	return marshalResult(map[string]any{
		"timeline": timeline,
	})
}

// 8. get_growth_album 查询成果相册
func (s *ChatService) toolGetGrowthAlbum(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	page := getIntArg(args, "page", 1)
	pageSize := getIntArg(args, "page_size", 10)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}

	tasks, total, err := s.growth.Album(childID, familyID, page, pageSize)
	if err != nil {
		return "", fmt.Errorf("查询成果相册失败: %w", err)
	}

	photos := make([]map[string]any, 0, len(tasks))
	for _, t := range tasks {
		photos = append(photos, map[string]any{
			"task_id":    t.ID,
			"title":      t.Title,
			"photo_url":  t.Photo,
			"created_at": t.CreatedAt,
		})
	}
	return marshalResult(map[string]any{
		"photos": photos,
		"total":  total,
	})
}

// 9. get_current_cycle 查询当前成长周期
func (s *ChatService) toolGetCurrentCycle(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	cycle, goals, err := s.growthCycle.GetCurrentCycle(childID, familyID)
	if err != nil {
		return "", fmt.Errorf("查询当前周期失败: %w", err)
	}
	if cycle == nil {
		return marshalResult(map[string]any{
			"cycle": nil,
			"goals": []any{},
		})
	}

	// 查询维度名称映射
	dimensions, _ := s.ability.ListDimensions()
	dimNameMap := make(map[uint]string, len(dimensions))
	for _, d := range dimensions {
		dimNameMap[d.ID] = d.Name
	}

	goalList := make([]map[string]any, 0, len(goals))
	for _, g := range goals {
		goalList = append(goalList, map[string]any{
			"dimension_id":   g.DimensionID,
			"dimension_name": dimNameMap[g.DimensionID],
			"target_score":   g.TargetScore,
		})
	}

	return marshalResult(map[string]any{
		"cycle": map[string]any{
			"id":         cycle.ID,
			"name":       cycle.Name,
			"start_date": cycle.StartDate,
			"end_date":   cycle.EndDate,
			"status":     cycle.Status,
		},
		"goals": goalList,
	})
}

// 10. get_cycle_progress 查询周期进度（含 familyID 鉴权）
func (s *ChatService) toolGetCycleProgress(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	cycleID := getIntArg(args, "cycle_id", 0)
	if cycleID <= 0 {
		return "", fmt.Errorf("cycle_id 参数必填且必须为正整数")
	}

	// familyID 鉴权：查询 cycle 是否属于当前 family
	var cycle model.GrowthCycle
	if err := database.DB.Where("id = ? AND family_id = ?", cycleID, familyID).First(&cycle).Error; err != nil {
		return "", fmt.Errorf("周期不存在或无权访问")
	}

	progress, err := s.growthCycle.GetCycleProgress(uint(cycleID))
	if err != nil {
		return "", fmt.Errorf("查询周期进度失败: %w", err)
	}

	// 将 progress 字段映射为 progress_percent
	resultList := make([]map[string]any, 0, len(progress))
	for _, p := range progress {
		resultList = append(resultList, map[string]any{
			"dimension_name":   p["dimension_name"],
			"target_score":     p["target_score"],
			"current_score":    p["current_score"],
			"progress_percent": p["progress"],
		})
	}
	return marshalResult(map[string]any{
		"progress": resultList,
	})
}

// 11. list_growth_stories 查询成长故事列表
func (s *ChatService) toolListGrowthStories(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	page := getIntArg(args, "page", 1)
	pageSize := getIntArg(args, "page_size", 5)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 5
	}

	stories, total, err := s.growthStory.ListStories(childID, familyID, page, pageSize)
	if err != nil {
		return "", fmt.Errorf("查询成长故事失败: %w", err)
	}

	storyList := make([]map[string]any, 0, len(stories))
	for _, st := range stories {
		// 截取正文前 100 字作为预览
		preview := ""
		if runes := []rune(st.Content); len(runes) > 100 {
			preview = string(runes[:100]) + "..."
		} else {
			preview = st.Content
		}
		storyList = append(storyList, map[string]any{
			"id":          st.ID,
			"cycle_id":    st.CycleID,
			"title":       st.Title,
			"generated_at": st.CreatedAt,
			"preview":     preview,
		})
	}
	return marshalResult(map[string]any{
		"stories": storyList,
		"total":   total,
	})
}

// 12. list_master_challenges 查询大师挑战实例列表
func (s *ChatService) toolListMasterChallenges(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	instances, err := s.masterChallenge.GetInstances(childID, familyID)
	if err != nil {
		return "", fmt.Errorf("查询大师挑战失败: %w", err)
	}

	// 批量查询所有实例的阶段，用于计算 current_stage / total_stages
	instanceIDs := make([]uint, 0, len(instances))
	for _, inst := range instances {
		instanceIDs = append(instanceIDs, inst.ID)
	}
	stageMap := make(map[uint][]model.MasterChallengeStage)
	if len(instanceIDs) > 0 {
		var stages []model.MasterChallengeStage
		database.DB.Where("instance_id IN ?", instanceIDs).Order("instance_id, stage_index ASC").Find(&stages)
		for _, st := range stages {
			stageMap[st.InstanceID] = append(stageMap[st.InstanceID], st)
		}
	}

	instanceList := make([]map[string]any, 0, len(instances))
	for _, inst := range instances {
		stages := stageMap[inst.ID]
		totalStages := len(stages)
		currentStage := totalStages // 默认全部完成
		for i, st := range stages {
			if st.Status != "completed" {
				currentStage = i + 1 // 1-based
				break
			}
		}
		instanceList = append(instanceList, map[string]any{
			"id":             inst.ID,
			"template_title": inst.Title,
			"status":         inst.Status,
			"current_stage":  currentStage,
			"total_stages":   totalStages,
			"started_at":     inst.StartedAt,
		})
	}
	return marshalResult(map[string]any{
		"instances": instanceList,
	})
}

// 13. list_activities 查询公益活动列表（过滤敏感字段）
func (s *ChatService) toolListActivities(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	page := getIntArg(args, "page", 1)
	pageSize := getIntArg(args, "page_size", 10)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	activities, total, err := s.activity.ListActivities(ListActivitiesParams{
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		return "", fmt.Errorf("查询公益活动失败: %w", err)
	}

	// 过滤敏感字段：只保留公开字段，移除 organizer_id/family_id 等家庭私有字段
	activityList := make([]map[string]any, 0, len(activities))
	for _, a := range activities {
		activityList = append(activityList, map[string]any{
			"id":                 a.ID,
			"title":              a.Title,
			"location":           a.Location,
			"start_time":         a.EventTime,
			"participants_count": a.ParticipantsCount,
			"max_participants":   a.MaxParticipants,
			"points":             a.Points,
		})
	}
	return marshalResult(map[string]any{
		"activities": activityList,
		"total":      total,
	})
}

// ===================== 注册函数 =====================

// registerReadonlyTools 注册 13 个只读工具到 toolRegistry
func (s *ChatService) registerReadonlyTools() {
	// 无参数的工具 schema
	noParamsSchema := map[string]any{
		"type":       "object",
		"properties": map[string]any{},
		"required":   []string{},
	}

	tools := []ToolEntry{
		// 1. query_child_balance
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "query_child_balance",
					Description: "查询儿童当前积分余额",
					Parameters:  noParamsSchema,
				},
			},
			Execute: s.toolQueryChildBalance,
		},
		// 2. query_child_scores
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "query_child_scores",
					Description: "查询儿童各能力维度得分与成长指数",
					Parameters:  noParamsSchema,
				},
			},
			Execute: s.toolQueryChildScores,
		},
		// 3. list_tasks
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "list_tasks",
					Description: "查询儿童任务列表，可按状态过滤",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"status": map[string]any{
								"type":        "string",
								"enum":        []string{"pending", "submitted", "completed", "rejected", "all"},
								"description": "任务状态过滤，默认 pending",
							},
							"page": map[string]any{
								"type":        "integer",
								"description": "页码，默认 1",
							},
							"page_size": map[string]any{
								"type":        "integer",
								"description": "每页条数，默认 10",
							},
						},
						"required": []string{},
					},
				},
			},
			Execute: s.toolListTasks,
		},
		// 4. get_task_detail
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "get_task_detail",
					Description: "查询单个任务的详细信息",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"task_id": map[string]any{
								"type":        "integer",
								"description": "任务 ID（必填）",
							},
						},
						"required": []string{"task_id"},
					},
				},
			},
			Execute: s.toolGetTaskDetail,
		},
		// 5. list_redeem_items
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "list_redeem_items",
					Description: "查询家庭积分商城的兑换商品列表",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"category": map[string]any{
								"type":        "integer",
								"description": "商品类别过滤：0=物质奖励 1=体验特权 2=其他，默认全部",
							},
							"page": map[string]any{
								"type":        "integer",
								"description": "页码，默认 1",
							},
							"page_size": map[string]any{
								"type":        "integer",
								"description": "每页条数，默认 10",
							},
						},
						"required": []string{},
					},
				},
			},
			Execute: s.toolListRedeemItems,
		},
		// 6. list_redeem_records
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "list_redeem_records",
					Description: "查询儿童的积分兑换记录",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"page": map[string]any{
								"type":        "integer",
								"description": "页码，默认 1",
							},
							"page_size": map[string]any{
								"type":        "integer",
								"description": "每页条数，默认 10",
							},
						},
						"required": []string{},
					},
				},
			},
			Execute: s.toolListRedeemRecords,
		},
		// 7. get_growth_timeline
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "get_growth_timeline",
					Description: "查询儿童成长时间线，包含任务完成、积分兑换等事件",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"days": map[string]any{
								"type":        "integer",
								"description": "查询最近多少天的记录，默认 30",
							},
						},
						"required": []string{},
					},
				},
			},
			Execute: s.toolGetGrowthTimeline,
		},
		// 8. get_growth_album
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "get_growth_album",
					Description: "查询儿童成果相册，包含任务完成时上传的照片",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"page": map[string]any{
								"type":        "integer",
								"description": "页码，默认 1",
							},
							"page_size": map[string]any{
								"type":        "integer",
								"description": "每页条数，默认 10",
							},
						},
						"required": []string{},
					},
				},
			},
			Execute: s.toolGetGrowthAlbum,
		},
		// 9. get_current_cycle
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "get_current_cycle",
					Description: "查询儿童当前成长周期及其阶段目标",
					Parameters:  noParamsSchema,
				},
			},
			Execute: s.toolGetCurrentCycle,
		},
		// 10. get_cycle_progress
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "get_cycle_progress",
					Description: "查询指定成长周期的各维度目标达成进度",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"cycle_id": map[string]any{
								"type":        "integer",
								"description": "成长周期 ID（必填）",
							},
						},
						"required": []string{"cycle_id"},
					},
				},
			},
			Execute: s.toolGetCycleProgress,
		},
		// 11. list_growth_stories
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "list_growth_stories",
					Description: "查询儿童的成长故事列表，包含阶段回顾与项目式故事",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"page": map[string]any{
								"type":        "integer",
								"description": "页码，默认 1",
							},
							"page_size": map[string]any{
								"type":        "integer",
								"description": "每页条数，默认 5",
							},
						},
						"required": []string{},
					},
				},
			},
			Execute: s.toolListGrowthStories,
		},
		// 12. list_master_challenges
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "list_master_challenges",
					Description: "查询儿童的大师挑战实例列表及各阶段进度",
					Parameters:  noParamsSchema,
				},
			},
			Execute: s.toolListMasterChallenges,
		},
		// 13. list_activities
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "list_activities",
					Description: "查询公益活动列表，包含活动标题、地点、时间及参与情况",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"page": map[string]any{
								"type":        "integer",
								"description": "页码，默认 1",
							},
							"page_size": map[string]any{
								"type":        "integer",
								"description": "每页条数，默认 10",
							},
						},
						"required": []string{},
					},
				},
			},
			Execute: s.toolListActivities,
		},
	}

	for _, t := range tools {
		s.toolRegistry[t.Definition.Function.Name] = t
	}
}

// ===================== 5 个写工具的 ExecuteFunc =====================
//
// 写工具的 ExecuteFunc 不执行真正写操作，仅查询必要信息构造 ActionSuggestion，
// marshal 为 JSON 字符串返回。SendMessage 识别 IsWrite 标记后收集为 suggested_actions
// 下发给前端，用户在前端确认卡片上点确认后由前端直接调 REST API 完成写操作。

// W1. submit_task 提议提交任务（儿童可执行，无需家长权限）
func (s *ChatService) toolSubmitTask(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	taskID := getIntArg(args, "task_id", 0)
	if taskID <= 0 {
		return "", fmt.Errorf("task_id 参数必填且必须为正整数")
	}
	task, err := s.task.GetTask(uint(taskID), familyID)
	if err != nil {
		return "", fmt.Errorf("查询任务失败: %w", err)
	}

	sug := ActionSuggestion{
		Action:      "submit_task",
		Params:      map[string]any{"task_id": taskID},
		Summary:     fmt.Sprintf("任务：%s，提交后将进入家长审核状态", task.Title),
		ConfirmText: "确认提交",
		CancelText:  "取消",
		// 实际路由: PUT /api/tasks/:id/submit (main.go L84)；前端 baseURL 已含 /api，故 endpoint 去掉 /api 前缀
		APIEndpoint: fmt.Sprintf("/tasks/%d/submit", taskID),
		APIMethod:   "PUT",
		APIBody:     map[string]any{},
	}
	return marshalResult(sug)
}

// W2. redeem_item 提议兑换商品（儿童可执行，无需家长权限）
func (s *ChatService) toolRedeemItem(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	itemID := getIntArg(args, "item_id", 0)
	if itemID <= 0 {
		return "", fmt.Errorf("item_id 参数必填且必须为正整数")
	}
	item, err := s.redeem.GetItem(uint(itemID), familyID)
	if err != nil {
		return "", fmt.Errorf("查询商品失败: %w", err)
	}
	balance, _, err := s.score.GetBalance(childID, familyID)
	if err != nil {
		return "", fmt.Errorf("查询余额失败: %w", err)
	}

	sug := ActionSuggestion{
		Action:      "redeem_item",
		Params:      map[string]any{"item_id": itemID},
		Summary:     fmt.Sprintf("商品：%s，需要 %d 积分，当前余额 %d", item.Name, item.Points, balance),
		ConfirmText: "确认兑换",
		CancelText:  "取消",
		// 实际路由: POST /api/redeems (main.go L112)；handler redeemReq 需要 item_id 与 child_id（均从 body 取）
		APIEndpoint: "/redeems",
		APIMethod:   "POST",
		APIBody: map[string]any{
			"item_id":  itemID,
			"child_id": childID,
		},
	}
	return marshalResult(sug)
}

// W3. set_stage_goal 提议设置阶段目标（需家长权限）
func (s *ChatService) toolSetStageGoal(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	if userRole != "parent" {
		return "", fmt.Errorf("此操作仅家长可执行")
	}
	cycleID := getIntArg(args, "cycle_id", 0)
	dimensionID := getIntArg(args, "dimension_id", 0)
	targetScore := getIntArg(args, "target_score", 0)
	if cycleID <= 0 || dimensionID <= 0 || targetScore <= 0 {
		return "", fmt.Errorf("cycle_id / dimension_id / target_score 参数均必填且必须为正整数")
	}

	// 查周期名（含 familyID 鉴权）
	var cycle model.GrowthCycle
	if err := database.DB.Where("id = ? AND family_id = ?", cycleID, familyID).First(&cycle).Error; err != nil {
		return "", fmt.Errorf("周期不存在或无权访问")
	}
	// 查维度名
	dimName := ""
	if dim, err := s.ability.GetDimensionByID(uint(dimensionID)); err == nil {
		dimName = dim.Name
	}

	sug := ActionSuggestion{
		Action:      "set_stage_goal",
		Params:      map[string]any{"cycle_id": cycleID, "dimension_id": dimensionID, "target_score": targetScore},
		Summary:     fmt.Sprintf("为周期「%s」的「%s」维度设置目标 %d 分", cycle.Name, dimName, targetScore),
		ConfirmText: "确认设置",
		CancelText:  "取消",
		// 实际路由: POST /api/growth-cycles/:id/goals (main.go L130)；cycle_id 走 path，handler 需要 child_id/dimension_id/target_score（从 body 取）
		APIEndpoint: fmt.Sprintf("/growth-cycles/%d/goals", cycleID),
		APIMethod:   "POST",
		APIBody: map[string]any{
			"child_id":      childID,
			"dimension_id":  dimensionID,
			"target_score":  targetScore,
		},
		RequiresParent: true,
	}
	return marshalResult(sug)
}

// W4. create_cycle 提议创建成长周期（需家长权限）
func (s *ChatService) toolCreateCycle(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	if userRole != "parent" {
		return "", fmt.Errorf("此操作仅家长可执行")
	}
	name := getStringArg(args, "name", "")
	startDateStr := getStringArg(args, "start_date", "")
	endDateStr := getStringArg(args, "end_date", "")
	if name == "" || startDateStr == "" || endDateStr == "" {
		return "", fmt.Errorf("name / start_date / end_date 参数均必填")
	}
	// 校验日期格式（YYYY-MM-DD），并解析为 time.Time 以便转换为后端 CreateCycle handler 要求的 RFC3339 格式
	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		return "", fmt.Errorf("start_date 格式应为 YYYY-MM-DD")
	}
	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		return "", fmt.Errorf("end_date 格式应为 YYYY-MM-DD")
	}

	sug := ActionSuggestion{
		Action:      "create_cycle",
		Params:      map[string]any{"name": name, "start_date": startDateStr, "end_date": endDateStr},
		Summary:     fmt.Sprintf("创建成长周期「%s」，从 %s 到 %s", name, startDateStr, endDateStr),
		ConfirmText: "确认创建",
		CancelText:  "取消",
		// 实际路由: POST /api/growth-cycles (main.go L128)；handler 需要 child_id（从 body 取）及 RFC3339 格式的 start_date/end_date
		APIEndpoint: "/growth-cycles",
		APIMethod:   "POST",
		APIBody: map[string]any{
			"child_id":   childID,
			"name":       name,
			"start_date": startDate.Format(time.RFC3339),
			"end_date":   endDate.Format(time.RFC3339),
		},
		RequiresParent: true,
	}
	return marshalResult(sug)
}

// W5. adjust_score 提议调整积分（需家长权限；delta>0 奖励，delta<0 扣除）
func (s *ChatService) toolAdjustScore(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	if userRole != "parent" {
		return "", fmt.Errorf("此操作仅家长可执行")
	}
	delta := getIntArg(args, "delta", 0)
	title := getStringArg(args, "title", "")
	description := getStringArg(args, "description", "")
	if delta == 0 {
		return "", fmt.Errorf("delta 参数必填且不能为 0")
	}
	if title == "" {
		return "", fmt.Errorf("title 参数必填")
	}

	balance, _, err := s.score.GetBalance(childID, familyID)
	if err != nil {
		return "", fmt.Errorf("查询余额失败: %w", err)
	}

	// delta>0 奖励，delta<0 扣除
	confirmText := "确认奖励"
	verb := "奖励"
	absDelta := delta
	if delta < 0 {
		confirmText = "确认扣除"
		verb = "扣除"
		absDelta = -delta
	}

	// 实际路由按正负分流: POST /api/score/add (delta>0, main.go L101) 与 POST /api/score/deduct (delta<0, L102)；
	// handler adjustReq 要求 points 为正数（DeductPoints 内部会取反），故 body 传 absDelta
	apiEndpoint := "/score/add"
	if delta < 0 {
		apiEndpoint = "/score/deduct"
	}

	sug := ActionSuggestion{
		Action:      "adjust_score",
		Params:      map[string]any{"delta": delta, "title": title, "description": description},
		Summary:     fmt.Sprintf("「%s」%s %d 积分，当前余额 %d", title, verb, absDelta, balance),
		ConfirmText: confirmText,
		CancelText:  "取消",
		APIEndpoint: apiEndpoint,
		APIMethod:   "POST",
		APIBody: map[string]any{
			"child_id":    childID,
			"points":      absDelta,
			"title":       title,
			"description": description,
		},
		RequiresParent: true,
	}
	return marshalResult(sug)
}

// W6. create_task_template 提议创建家庭自定义任务模板（需家长权限）
// 家长可与 AI 助理探讨任务设计，由 AI 提议模板字段，家长确认后写入家庭模板库
func (s *ChatService) toolCreateTaskTemplate(ctx context.Context, args map[string]any, familyID, childID uint, userRole string) (string, error) {
	if userRole != "parent" {
		return "", fmt.Errorf("此操作仅家长可执行")
	}
	title := getStringArg(args, "title", "")
	description := getStringArg(args, "description", "")
	icon := getStringArg(args, "icon", "")
	category := getStringArg(args, "category", "")
	difficulty := getStringArg(args, "difficulty", "")
	frequency := getStringArg(args, "frequency", "")
	tags := getStringArg(args, "tags", "")
	templateType := getStringArg(args, "template_type", "daily")
	points := getIntArg(args, "points", 10)
	minAge := getIntArg(args, "min_age", 6)
	maxAge := getIntArg(args, "max_age", 12)
	estimatedTime := getIntArg(args, "estimated_time", 15)
	abilityDimensionID := uint(getIntArg(args, "ability_dimension_id", 0))
	estimatedDays := getIntArg(args, "estimated_days", 0)
	keyMilestones := getStringArg(args, "key_milestones", "")

	if title == "" {
		return "", fmt.Errorf("title 参数必填")
	}
	// 校验 template_type
	switch templateType {
	case "", "daily", "habit", "parent":
		if templateType == "" {
			templateType = "daily"
		}
	default:
		return "", fmt.Errorf("template_type 必须是 daily/habit/parent 之一")
	}
	// 校验 difficulty
	switch difficulty {
	case "", "easy", "medium", "hard":
		if difficulty == "" {
			difficulty = "medium"
		}
	default:
		return "", fmt.Errorf("difficulty 必须是 easy/medium/hard 之一")
	}

	// 查维度名（用于 summary 展示）
	dimName := "未指定"
	if abilityDimensionID > 0 {
		if dim, err := s.ability.GetDimensionByID(abilityDimensionID); err == nil {
			dimName = dim.Name
		}
	}

	// 构造 summary：清晰展示模板关键信息，数字会被前端高亮
	typeLabel := map[string]string{"daily": "日常任务", "habit": "习惯养成", "parent": "主题任务"}[templateType]
	summary := fmt.Sprintf("创建%s模板「%s」｜%s｜%d-%d岁｜%s维度｜%d积分",
		typeLabel, title, category, minAge, maxAge, dimName, points)
	if description != "" {
		// 描述截断避免卡片过长
		desc := description
		if len([]rune(desc)) > 40 {
			desc = string([]rune(desc)[:40]) + "..."
		}
		summary += "｜" + desc
	}

	// 构造 api_body（与 POST /api/task-templates 的 createTaskTemplateReq 字段对齐）
	apiBody := map[string]any{
		"title":                title,
		"description":          description,
		"points":               points,
		"icon":                 icon,
		"category":             category,
		"min_age":              minAge,
		"max_age":              maxAge,
		"estimated_time":       estimatedTime,
		"difficulty":           difficulty,
		"frequency":            frequency,
		"tags":                 tags,
		"ability_dimension_id": abilityDimensionID,
		"template_type":        templateType,
	}
	// parent 类型额外字段
	if templateType == "parent" {
		apiBody["estimated_days"] = estimatedDays
		apiBody["key_milestones"] = keyMilestones
	}

	sug := ActionSuggestion{
		Action:      "create_task_template",
		Params:      map[string]any{"title": title, "template_type": templateType},
		Summary:     summary,
		ConfirmText: "确认创建",
		CancelText:  "取消",
		// 实际路由: POST /api/task-templates (main.go L174)；handler createTaskTemplateReq 从 body 取全部字段
		APIEndpoint:    "/task-templates",
		APIMethod:      "POST",
		APIBody:        apiBody,
		RequiresParent: true,
	}
	return marshalResult(sug)
}

// registerWriteTools 注册 6 个写工具到 toolRegistry（IsWrite=true）
func (s *ChatService) registerWriteTools() {
	tools := []ToolEntry{
		// W1. submit_task
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "submit_task",
					Description: "提议提交一个任务进入家长审核（不直接执行，向用户展示确认卡片）",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"task_id": map[string]any{
								"type":        "integer",
								"description": "任务 ID（必填）",
							},
						},
						"required": []string{"task_id"},
					},
				},
			},
			Execute: s.toolSubmitTask,
			IsWrite: true,
		},
		// W2. redeem_item
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "redeem_item",
					Description: "提议用积分兑换一个商品（不直接执行，向用户展示确认卡片）",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"item_id": map[string]any{
								"type":        "integer",
								"description": "商品 ID（必填）",
							},
						},
						"required": []string{"item_id"},
					},
				},
			},
			Execute: s.toolRedeemItem,
			IsWrite: true,
		},
		// W3. set_stage_goal
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "set_stage_goal",
					Description: "提议为指定成长周期的某个能力维度设置阶段目标（家长权限，向用户展示确认卡片）",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"cycle_id": map[string]any{
								"type":        "integer",
								"description": "成长周期 ID（必填）",
							},
							"dimension_id": map[string]any{
								"type":        "integer",
								"description": "能力维度 ID（必填）",
							},
							"target_score": map[string]any{
								"type":        "integer",
								"description": "目标分值（必填，正整数）",
							},
						},
						"required": []string{"cycle_id", "dimension_id", "target_score"},
					},
				},
			},
			Execute: s.toolSetStageGoal,
			IsWrite: true,
		},
		// W4. create_cycle
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "create_cycle",
					Description: "提议创建一个新的成长周期（家长权限，向用户展示确认卡片）",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"name": map[string]any{
								"type":        "string",
								"description": "周期名称（必填）",
							},
							"start_date": map[string]any{
								"type":        "string",
								"description": "开始日期，格式 YYYY-MM-DD（必填）",
							},
							"end_date": map[string]any{
								"type":        "string",
								"description": "结束日期，格式 YYYY-MM-DD（必填）",
							},
						},
						"required": []string{"name", "start_date", "end_date"},
					},
				},
			},
			Execute: s.toolCreateCycle,
			IsWrite: true,
		},
		// W5. adjust_score
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "adjust_score",
					Description: "提议调整儿童积分（家长权限，delta 正数奖励、负数扣除，向用户展示确认卡片）",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"delta": map[string]any{
								"type":        "integer",
								"description": "积分变化值，正数奖励、负数扣除（必填，不能为 0）",
							},
							"title": map[string]any{
								"type":        "string",
								"description": "调整标题（必填）",
							},
							"description": map[string]any{
								"type":        "string",
								"description": "调整说明（可选）",
							},
						},
						"required": []string{"delta", "title"},
					},
				},
			},
			Execute: s.toolAdjustScore,
		IsWrite: true,
		},
		// W6. create_task_template
		{
			Definition: ToolDefinition{
				Type: "function",
				Function: ToolFunctionDef{
					Name:        "create_task_template",
					Description: "提议为家庭创建一个自定义任务模板（家长权限，向用户展示确认卡片）。家长想添加自定义任务/习惯/主题任务时调用。模板类型 template_type: daily=日常任务, habit=习惯养成, parent=主题任务。能力维度 ability_dimension_id: 1=生活自理, 2=独立自主, 3=动手实践, 4=学习认知, 5=社交协作, 6=身心健康。",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"title": map[string]any{
								"type":        "string",
								"description": "模板标题（必填，4-30字）",
							},
							"description": map[string]any{
								"type":        "string",
								"description": "任务描述/完成要求",
							},
							"template_type": map[string]any{
								"type":        "string",
								"description": "模板类型：daily=日常任务, habit=习惯养成, parent=主题任务（默认 daily）",
							},
							"ability_dimension_id": map[string]any{
								"type":        "integer",
								"description": "主能力维度 ID：1=生活自理, 2=独立自主, 3=动手实践, 4=学习认知, 5=社交协作, 6=身心健康",
							},
							"points": map[string]any{
								"type":        "integer",
								"description": "完成奖励积分（默认 10）",
							},
							"min_age": map[string]any{
								"type":        "integer",
								"description": "适用最小年龄（默认 6）",
							},
							"max_age": map[string]any{
								"type":        "integer",
								"description": "适用最大年龄（默认 12）",
							},
							"difficulty": map[string]any{
								"type":        "string",
								"description": "难度：easy/medium/hard（默认 medium）",
							},
							"category": map[string]any{
								"type":        "string",
								"description": "分类，如 学习/家务/行为习惯/运动/其他",
							},
							"frequency": map[string]any{
								"type":        "string",
								"description": "频率：daily/weekly/monthly/once",
							},
							"estimated_time": map[string]any{
								"type":        "integer",
								"description": "预计完成时间（分钟）",
							},
							"tags": map[string]any{
								"type":        "string",
								"description": "标签，逗号分隔",
							},
							"icon": map[string]any{
								"type":        "string",
								"description": "emoji 图标",
							},
							"estimated_days": map[string]any{
								"type":        "integer",
								"description": "主题任务预计天数（仅 parent 类型）",
							},
							"key_milestones": map[string]any{
								"type":        "string",
								"description": "主题任务关键里程碑 JSON（仅 parent 类型）",
							},
						},
						"required": []string{"title"},
					},
				},
			},
			Execute: s.toolCreateTaskTemplate,
			IsWrite: true,
		},
	}

	for _, t := range tools {
		s.toolRegistry[t.Definition.Function.Name] = t
	}
}
