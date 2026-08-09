package handler

import (
	"encoding/json"
	"growpocket/internal/config"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	cfg          *config.Config
	service      *service.TaskService
	habitService *service.HabitService
}

func NewTaskHandler(cfg *config.Config) *TaskHandler {
	return &TaskHandler{
		cfg:          cfg,
		service:      service.NewTaskService(),
		habitService: service.NewHabitService(nil), // 仅用于确保习惯任务就绪，AI鼓励语降级
	}
}

type createTaskReq struct {
	Title            string     `json:"title" binding:"required"`
	Description      string     `json:"description"`
	Points           int        `json:"points" binding:"required"`
	ChildID          uint       `json:"child_id" binding:"required"`
	Deadline         *string    `json:"deadline"`
	Status           *int       `json:"status"`            // 1=进行中,3=直接已完成（奖惩任务）
	Photo            *string    `json:"photo"`             // 可选：创建时直接上传照片URL（奖惩任务凭证）
	GuardianRequired *bool      `json:"guardian_required"` // 可选：家长陪伴标记（true 时强制开启）
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

	guardianRequired := false
	if req.GuardianRequired != nil {
		guardianRequired = *req.GuardianRequired
	}

	task, err := h.service.CreateTask(service.CreateTaskInput{
		FamilyID:         middleware.GetFamilyID(c),
		Title:            req.Title,
		Description:      req.Description,
		Points:           req.Points,
		ChildID:          req.ChildID,
		ChildName:        child.Nickname,
		CreatedBy:        middleware.GetUserID(c),
		Photo:            photo,
		Deadline:         deadline,
		Status:           status,
		GuardianRequired: guardianRequired,
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

	// task_kind 过滤：支持逗号分隔多选（如 daily,habit_daily,child）
	// 不传时默认只返回 daily/habit_daily/child（不返回 habit_master 和 parent）
	var kinds []string
	if s := c.Query("task_kind"); s != "" {
		for _, k := range strings.Split(s, ",") {
			if k = strings.TrimSpace(k); k != "" {
				kinds = append(kinds, k)
			}
		}
	}
	if len(kinds) == 0 {
		kinds = []string{"daily", "habit_daily", "child"}
	}

	// 兜底：当请求包含 habit_daily 且指定了 child_id 时，先确保习惯每日子任务就绪
	// 避免定时任务(08:00)未跑或用户刚设置完习惯目标时，列表页看不到今日习惯任务
	if childID > 0 && h.habitService != nil {
		needHabit := false
		for _, k := range kinds {
			if k == "habit_daily" || k == "habit_master" {
				needHabit = true
				break
			}
		}
		if needHabit {
			// 使用 Lite 版本跳过 AI 鼓励语，避免阻塞列表查询（AI鼓励语在创建时降级为固定文案）
			if err := h.habitService.EnsureHabitDailyReadyLite(childID); err != nil {
				// 仅记录日志，不影响主流程返回
				log.Printf("[TaskHandler][ListTasks] 习惯任务就绪检查失败 child=%d: %v", childID, err)
			}
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

	tasks, total, err := h.service.ListTasks(middleware.GetFamilyID(c), childID, status, kinds, page, pageSize)
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

// SubmitTask 提交验收：支持 multipart/form-data 文件上传或 JSON 传 photo URL / photo_urls 数组
func (h *TaskHandler) SubmitTask(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	photo := ""

	// 1) 优先尝试 multipart：处理多个 photo[] 文件上传
	if mp, formErr := c.MultipartForm(); formErr == nil && mp != nil && len(mp.File["photo[]"]) > 0 {
		fhs := mp.File["photo[]"]
		urls := make([]string, 0, len(fhs))
		for _, fh := range fhs {
			f, openErr := fh.Open()
			if openErr != nil {
				util.FailBadRequest(c, "文件读取失败："+openErr.Error())
				return
			}
			_ = f.Close()
			url, saveErr := util.SaveUploadedMedia(fh, h.cfg.UploadDir)
			if saveErr != nil {
				util.FailBadRequest(c, saveErr.Error())
				return
			}
			urls = append(urls, url)
		}
		if len(urls) == 1 {
			photo = urls[0]
		} else if len(urls) > 1 {
			if data, encErr := json.Marshal(urls); encErr == nil {
				photo = string(data)
			} else {
				photo = strings.Join(urls, ",")
			}
		}
	} else {
		// 2) 退化为单文件 photo（兼容旧版本）
		file, header, fErr := c.Request.FormFile("photo")
		if fErr == nil && file != nil && header != nil {
			defer file.Close()
			url, saveErr := util.SaveUploadedMedia(header, h.cfg.UploadDir)
			if saveErr != nil {
				util.FailBadRequest(c, saveErr.Error())
				return
			}
			photo = url
		} else {
			// 3) JSON body：兼容旧单图 photo + 新 photo_urls 数组
			var body struct {
				Photo     string   `json:"photo"`
				PhotoURLs []string `json:"photo_urls"`
			}
			if bindErr := c.ShouldBindJSON(&body); bindErr == nil {
				if len(body.PhotoURLs) > 0 {
					// 过滤空值
					urls := make([]string, 0, len(body.PhotoURLs))
					for _, u := range body.PhotoURLs {
						if u != "" {
							urls = append(urls, u)
						}
					}
					if len(urls) == 1 {
						photo = urls[0]
					} else if len(urls) > 1 {
						if data, encErr := json.Marshal(urls); encErr == nil {
							photo = string(data)
						}
					}
				} else if body.Photo != "" {
					photo = body.Photo
				}
			}
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
