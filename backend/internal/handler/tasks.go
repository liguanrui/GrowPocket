package handler

import (
	"growpocket/internal/config"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	cfg     *config.Config
	service *service.TaskService
}

func NewTaskHandler(cfg *config.Config) *TaskHandler {
	return &TaskHandler{
		cfg:     cfg,
		service: service.NewTaskService(),
	}
}

type createTaskReq struct {
	Title       string     `json:"title" binding:"required"`
	Description string     `json:"description"`
	Points      int        `json:"points" binding:"required"`
	ChildID     uint       `json:"child_id" binding:"required"`
	Deadline    *string    `json:"deadline"`
	Status      *int       `json:"status"` // 1=进行中,3=直接已完成（奖惩任务）
	Photo       *string    `json:"photo"` // 可选：创建时直接上传照片URL（奖惩任务凭证）
}

func (h *TaskHandler) CreateTask(c *gin.Context) {
	var req createTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	// 验证 child 属于当前家庭
	childService := service.NewChildService()
	child, err := childService.GetChild(req.ChildID, middleware.GetFamilyID(c))
	if err != nil {
		util.FailForbidden(c, "孩子档案不存在或不属于当前家庭")
		return
	}

	var deadline *time.Time
	if req.Deadline != nil && *req.Deadline != "" {
		if t, err := time.Parse(time.RFC3339, *req.Deadline); err == nil {
			deadline = &t
		}
	}

	status := model.TaskStatusInProgress
	if req.Status != nil && *req.Status == model.TaskStatusCompleted {
		status = model.TaskStatusCompleted
	}

	photo := ""
	if req.Photo != nil {
		photo = *req.Photo
	}

	task, err := h.service.CreateTask(service.CreateTaskInput{
		FamilyID:    middleware.GetFamilyID(c),
		Title:       req.Title,
		Description: req.Description,
		Points:      req.Points,
		ChildID:     req.ChildID,
		ChildName:   child.Nickname,
		CreatedBy:   middleware.GetUserID(c),
		Photo:       photo,
		Deadline:    deadline,
		Status:      status,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, task)
}

func (h *TaskHandler) ListTasks(c *gin.Context) {
	childID := uint(0)
	if s := c.Query("child_id"); s != "" {
		if v, err := strconv.ParseUint(s, 10, 64); err == nil {
			childID = uint(v)
		}
	}
	status := 0
	if s := c.Query("status"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			status = v
		}
	}

	page := util.ParseInt(c.Query("page"), 1)
	pageSize := util.ParseInt(c.Query("page_size"), 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	tasks, total, err := h.service.ListTasks(middleware.GetFamilyID(c), childID, status, page, pageSize)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if tasks == nil {
		tasks = make([]model.Task, 0)
	}

	util.OK(c, gin.H{
		"items":     tasks,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *TaskHandler) GetTask(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	task, err := h.service.GetTask(id, middleware.GetFamilyID(c))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, task)
}

type updateTaskReq struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Points      *int    `json:"points"`
	Deadline    *string `json:"deadline"`
}

func (h *TaskHandler) UpdateTask(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req updateTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	var deadline *time.Time
	if req.Deadline != nil && *req.Deadline != "" {
		if t, err := time.Parse(time.RFC3339, *req.Deadline); err == nil {
			deadline = &t
		}
	}

	task, err := h.service.UpdateTask(id, middleware.GetFamilyID(c), service.UpdateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Points:      req.Points,
		Deadline:    deadline,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, task)
}

func (h *TaskHandler) DeleteTask(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	if err := h.service.DeleteTask(id, middleware.GetFamilyID(c)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, nil)
}

// SubmitTask 提交验收：支持 multipart/form-data 文件上传或 JSON 传 photo URL
func (h *TaskHandler) SubmitTask(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	photo := ""

	// 尝试 multipart 文件上传（图片或视频，可选）
	file, header, err := c.Request.FormFile("photo")
	if err == nil && file != nil && header != nil {
		defer file.Close()
		url, saveErr := util.SaveUploadedMedia(header, h.cfg.UploadDir)
		if saveErr != nil {
			util.FailBadRequest(c, saveErr.Error())
			return
		}
		photo = url
	} else {
		// 尝试 JSON body（photo 可选；空字符串表示无附件提交）
		var body struct {
			Photo string `json:"photo"`
		}
		if err := c.ShouldBindJSON(&body); err == nil {
			photo = body.Photo
		}
	}

	task, err := h.service.SubmitTask(id, middleware.GetFamilyID(c), photo)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, task)
}

type reviewTaskReq struct {
	Approved bool `json:"approved"`
	Points   int  `json:"points"` // 可选：实际评分（0 表示使用任务积分）
}

func (h *TaskHandler) ReviewTask(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req reviewTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	task, err := h.service.ReviewTask(id, middleware.GetFamilyID(c), service.ReviewTaskInput{
		Approved: req.Approved,
		Points:   req.Points,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, task)
}
