package handler

import (
	"growpocket/internal/database"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ParentTaskHandler 主题任务（父任务）handler，依赖 ParentTaskService
type ParentTaskHandler struct {
	service *service.ParentTaskService
}

// NewParentTaskHandler 创建主题任务 handler
func NewParentTaskHandler(svc *service.ParentTaskService) *ParentTaskHandler {
	return &ParentTaskHandler{service: svc}
}

// GetPresetParentTaskTemplates GET /api/parent-task-templates/preset?age=8
// 按年龄过滤预设主题模板（age >= AgeMin AND age <= AgeMax AND is_custom=false）
func GetPresetParentTaskTemplates(c *gin.Context) {
	ageStr := c.Query("age")
	age, err := strconv.Atoi(ageStr)
	if err != nil || age <= 0 {
		util.FailBadRequest(c, "age 参数错误")
		return
	}

	var templates []model.ParentTaskTemplate
	if err := database.DB.
		Where("age_min <= ? AND age_max >= ? AND is_custom = ?", age, age, false).
		Find(&templates).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if templates == nil {
		templates = []model.ParentTaskTemplate{}
	}
	util.OK(c, templates)
}

type createCustomParentTaskTemplateReq struct {
	ChildID       uint   `json:"child_id" binding:"required"`
	Title         string `json:"title" binding:"required"`
	Description   string `json:"description"`
	Category      string `json:"category"`
	EstimatedDays int    `json:"estimated_days"`
}

// CreateCustomParentTaskTemplate POST /api/parent-task-templates/custom
// 创建自定义主题模板（IsCustom=true, FamilyID=从JWT获取）
func CreateCustomParentTaskTemplate(c *gin.Context) {
	var req createCustomParentTaskTemplateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	template := model.ParentTaskTemplate{
		FamilyID:      middleware.GetFamilyID(c),
		ChildID:       req.ChildID,
		Title:         req.Title,
		Description:   req.Description,
		Category:      req.Category,
		EstimatedDays: req.EstimatedDays,
		IsCustom:      true,
	}
	if err := database.DB.Create(&template).Error; err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, template)
}

// ============ 主题任务（父任务）接口 ============

type createParentTaskReq struct {
	ChildID       uint   `json:"child_id" binding:"required"`
	TemplateID    uint   `json:"template_id"`    // 从模板创建时传入（与 Title 二选一）
	Title         string `json:"title"`          // 自定义创建时传入
	Description   string `json:"description"`    // 自定义创建时传入
	EstimatedDays int    `json:"estimated_days"` // 自定义创建时传入
	Category      string `json:"category"`       // 自定义创建时传入
}

// CreateParentTask POST /api/tasks/parent
// 创建主题任务（父任务）：支持从模板创建或自定义创建，创建后自动生成子任务大纲并实例化第 1 个
func (h *ParentTaskHandler) CreateParentTask(c *gin.Context) {
	var req createParentTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	familyID := middleware.GetFamilyID(c)
	childService := service.NewChildService()
	child, err := childService.GetChild(req.ChildID, familyID)
	if err != nil {
		util.FailForbidden(c, "孩子档案不存在或不属于当前家庭")
		return
	}

	if req.TemplateID == 0 && req.Title == "" {
		util.FailBadRequest(c, "template_id 与 title 至少需要一个")
		return
	}

	parent, err := h.service.CreateParentTask(service.CreateParentTaskInput{
		FamilyID:      familyID,
		ChildID:       req.ChildID,
		ChildName:     child.Nickname,
		CreatedBy:     middleware.GetUserID(c),
		TemplateID:    req.TemplateID,
		Title:         req.Title,
		Description:   req.Description,
		EstimatedDays: req.EstimatedDays,
		Category:      req.Category,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, parent)
}

// GenerateChildren POST /api/tasks/parent/:id/generate-children
// 触发子任务大纲生成（如已存在则覆盖重新生成）
func (h *ParentTaskHandler) GenerateChildren(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil || id == 0 {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	// 校验归属
	var parent model.Task
	if err := database.DB.Where("id = ? AND family_id = ?", id, middleware.GetFamilyID(c)).First(&parent).Error; err != nil {
		util.FailNotFound(c, "主题任务不存在")
		return
	}
	if parent.TaskKind != "parent" {
		util.FailBadRequest(c, "该任务不是主题任务")
		return
	}

	// 若来自模板，附带模板的 KeyMilestones 作为参考
	keyMilestonesSeed := ""
	if parent.TemplateID != 0 {
		var tpl model.ParentTaskTemplate
		if err := database.DB.First(&tpl, parent.TemplateID).Error; err == nil {
			keyMilestonesSeed = tpl.KeyMilestones
		}
	}

	if err := h.service.GenerateSubTaskOutline(id, keyMilestonesSeed); err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	// 重新加载返回最新 parent
	var updated model.Task
	database.DB.First(&updated, id)
	util.OK(c, updated)
}

// AdvanceBatch POST /api/tasks/parent/:id/advance-batch
// 手动触发下一批实例化（实例化下一个未实例化的大纲项）
func (h *ParentTaskHandler) AdvanceBatch(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil || id == 0 {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	// 校验归属
	var parent model.Task
	if err := database.DB.Where("id = ? AND family_id = ?", id, middleware.GetFamilyID(c)).First(&parent).Error; err != nil {
		util.FailNotFound(c, "主题任务不存在")
		return
	}
	if parent.TaskKind != "parent" {
		util.FailBadRequest(c, "该任务不是主题任务")
		return
	}

	child, err := h.service.AdvanceBatch(id)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, child)
}

// GetChildren GET /api/tasks/:id/children
// 返回子任务列表：已实例化的（来自 DB）+ 大纲中未实例化的（虚拟 Task，ID=0）
func (h *ParentTaskHandler) GetChildren(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil || id == 0 {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	// 校验归属
	var parent model.Task
	if err := database.DB.Where("id = ? AND family_id = ?", id, middleware.GetFamilyID(c)).First(&parent).Error; err != nil {
		util.FailNotFound(c, "主题任务不存在")
		return
	}
	if parent.TaskKind != "parent" {
		util.FailBadRequest(c, "该任务不是主题任务")
		return
	}

	children, err := h.service.GetChildren(id)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if children == nil {
		children = []model.Task{}
	}
	util.OK(c, children)
}

// GetParentByChildTask GET /api/tasks/:id/parent
// 通过 child task id 查询其父任务
func (h *ParentTaskHandler) GetParentByChildTask(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil || id == 0 {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	parent, err := h.service.GetParentByChildTaskID(id, middleware.GetFamilyID(c))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, parent)
}
