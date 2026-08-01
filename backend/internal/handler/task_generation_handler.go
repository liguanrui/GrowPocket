package handler

import (
	"growpocket/internal/database"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// TaskGenerationHandler 处理 AI 任务的家长审核与生成（v3）
type TaskGenerationHandler struct {
	service *service.TaskGenerationService
}

// NewTaskGenerationHandler 创建 handler
func NewTaskGenerationHandler() *TaskGenerationHandler {
	return &TaskGenerationHandler{service: nil}
}

// WithService 注入任务生成服务（用于手动触发生成）
func (h *TaskGenerationHandler) WithService(svc *service.TaskGenerationService) *TaskGenerationHandler {
	h.service = svc
	return h
}

// ReviewAITask PUT /api/tasks/:id/ai-review
// 家长审核 AI 任务：确认 / 调整 / 拒绝
func (h *TaskGenerationHandler) ReviewAITask(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || taskID == 0 {
		util.FailBadRequest(c, "无效的任务 ID")
		return
	}
	familyID := middleware.GetFamilyID(c)

	var req struct {
		Action     string `json:"action" binding:"required"` // confirm/adjust/reject
		Title      string `json:"title"`
		Points     int    `json:"points"`
		Difficulty string `json:"difficulty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 action")
		return
	}

	var task model.Task
	if err := database.DB.Where("id = ? AND family_id = ?", taskID, familyID).First(&task).Error; err != nil {
		util.FailBadRequest(c, "任务不存在")
		return
	}
	if !task.AIGenerated {
		util.FailBadRequest(c, "仅 AI 任务可审核")
		return
	}

	switch req.Action {
	case "confirm":
		task.Status = model.TaskStatusInProgress
	case "adjust":
		if req.Title != "" {
			task.Title = req.Title
		}
		if req.Points > 0 {
			task.Points = req.Points
		}
		if req.Difficulty != "" {
			task.Difficulty = req.Difficulty
		}
		task.Status = model.TaskStatusInProgress
	case "reject":
		if err := database.DB.Delete(&task).Error; err != nil {
			util.FailInternal(c, "删除失败")
			return
		}
		util.OK(c, gin.H{"deleted": true})
		return
	default:
		util.FailBadRequest(c, "action 必须是 confirm/adjust/reject")
		return
	}

	if err := database.DB.Save(&task).Error; err != nil {
		util.FailInternal(c, "更新失败")
		return
	}
	util.OK(c, task)
}

// GenerateToday POST /api/tasks/ai-generate
// 家长手动触发：为指定儿童立即生成今日 AI 任务
func (h *TaskGenerationHandler) GenerateToday(c *gin.Context) {
	if middleware.GetRole(c) != "parent" {
		util.FailForbidden(c, "仅家长可生成 AI 任务")
		return
	}
	if h.service == nil {
		util.FailInternal(c, "任务生成服务未初始化")
		return
	}
	var req struct {
		ChildID uint `json:"child_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}
	familyID := middleware.GetFamilyID(c)
	userID := middleware.GetUserID(c)

	// 查儿童姓名
	var child model.User
	if err := database.DB.Where("id = ? AND family_id = ? AND role = ?", req.ChildID, familyID, model.RoleChild).First(&child).Error; err != nil {
		util.FailBadRequest(c, "孩子档案不存在")
		return
	}

	if err := h.service.GenerateTasksForChild(req.ChildID, familyID, userID, child.Nickname); err != nil {
		util.FailInternal(c, "生成失败: "+err.Error())
		return
	}

	// 返回今日 AI 任务列表
	var tasks []model.Task
	today := time.Date(time.Now().Year(), time.Now().Month(), time.Now().Day(), 0, 0, 0, 0, time.Now().Location())
	tomorrow := today.Add(24 * time.Hour)
	database.DB.Where("child_id = ? AND family_id = ? AND ai_generated = ? AND created_at >= ? AND created_at < ?",
		req.ChildID, familyID, true, today, tomorrow).Find(&tasks)
	util.OK(c, gin.H{"tasks": tasks, "count": len(tasks)})
}
