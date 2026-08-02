package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// AcademicHandler 学业双层结构 Handler（V3.1 模块 D）
type AcademicHandler struct {
	service      *service.AcademicService
	childService *service.ChildService
}

// NewAcademicHandler 创建学业 handler
func NewAcademicHandler() *AcademicHandler {
	return &AcademicHandler{
		service:      service.NewAcademicService(),
		childService: service.NewChildService(),
	}
}

// createMilestoneReq 录入里程碑请求
type createMilestoneReq struct {
	ChildID     uint   `json:"child_id" binding:"required"`
	Type        string `json:"type" binding:"required"`         // homework_habit / homework_perfect / progress / error_book / honor / milestone
	SubType     string `json:"sub_type"`                        // 具体子类型
	Title       string `json:"title" binding:"required"`        // 事件标题
	Description string `json:"description"`                     // 描述
	OccurredAt  string `json:"occurred_at" binding:"required"`  // RFC3339 日期
	Points      int    `json:"points"`                          // 申请积分（受 200 上限 clamp）
	ParentNote  string `json:"parent_note"`                     // 家长备注
	Attachments string `json:"attachments"`                     // 附件图片URL JSON数组
	StarLevel   int    `json:"star_level"`                      // 星级 1-4
}

// RecordMilestone POST /api/academic/milestones — 录入里程碑并发放积分
func (h *AcademicHandler) RecordMilestone(c *gin.Context) {
	if middleware.GetRole(c) != model.RoleParent {
		util.FailForbidden(c, "仅家长可录入学业里程碑")
		return
	}
	var req createMilestoneReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	occurredAt, err := time.Parse(time.RFC3339, req.OccurredAt)
	if err != nil {
		util.FailBadRequest(c, "occurred_at 格式错误，应为 RFC3339")
		return
	}
	familyID := middleware.GetFamilyID(c)
	milestone, err := h.service.RecordMilestone(
		req.ChildID,
		familyID,
		req.Type,
		req.SubType,
		req.Title,
		req.Description,
		occurredAt,
		req.Points,
		req.ParentNote,
		req.Attachments,
		req.StarLevel,
	)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, milestone)
}

// GetMilestones GET /api/academic/milestones/:child_id — 查询里程碑历史
func (h *AcademicHandler) GetMilestones(c *gin.Context) {
	childID, err := strconv.ParseUint(c.Param("child_id"), 10, 32)
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供有效的 child_id")
		return
	}
	limit := util.ParseInt(c.Query("limit"), 50)
	familyID := middleware.GetFamilyID(c)
	milestones, err := h.service.GetMilestones(uint(childID), familyID, limit)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if milestones == nil {
		milestones = make([]model.AcademicMilestone, 0)
	}
	util.OK(c, milestones)
}

// createTrendReq 录入学业趋势档位请求
type createTrendReq struct {
	ChildID      uint   `json:"child_id" binding:"required"`
	Subject      string `json:"subject" binding:"required"`      // chinese / math / english / other
	MetricType   string `json:"metric_type" binding:"required"`  // homework / quiz / midterm_final / self_study_duration
	ValueABC     string `json:"value_abc" binding:"required"`    // A+ / A / B / C
	OccurredWeek string `json:"occurred_week"`                   // 如 "2026-W31"
	Note         string `json:"note"`
}

// RecordTrend POST /api/academic/trends — 录入学业趋势档位（不发分）
func (h *AcademicHandler) RecordTrend(c *gin.Context) {
	if middleware.GetRole(c) != model.RoleParent {
		util.FailForbidden(c, "仅家长可录入学业趋势档位")
		return
	}
	var req createTrendReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	familyID := middleware.GetFamilyID(c)
	entry, err := h.service.RecordTrend(
		req.ChildID,
		familyID,
		req.Subject,
		req.MetricType,
		req.ValueABC,
		req.OccurredWeek,
		req.Note,
	)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, entry)
}

// GetTrends GET /api/academic/trends/:child_id — 查询学业趋势
func (h *AcademicHandler) GetTrends(c *gin.Context) {
	childID, err := strconv.ParseUint(c.Param("child_id"), 10, 32)
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供有效的 child_id")
		return
	}
	metricType := c.Query("metric_type")
	limit := util.ParseInt(c.Query("limit"), 30)
	familyID := middleware.GetFamilyID(c)
	trends, err := h.service.GetTrends(uint(childID), familyID, metricType, limit)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, trends)
}

// GetAllowedTypes GET /api/academic/allowed-types/:child_id — 查询当前年级允许的里程碑类型
func (h *AcademicHandler) GetAllowedTypes(c *gin.Context) {
	childID, err := strconv.ParseUint(c.Param("child_id"), 10, 32)
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供有效的 child_id")
		return
	}
	familyID := middleware.GetFamilyID(c)
	child, err := h.childService.GetChild(uint(childID), familyID)
	if err != nil {
		util.FailBadRequest(c, "孩子档案不存在或不属于当前家庭")
		return
	}
	grade, _ := service.ResolveGrade(child)
	if grade < 1 {
		grade = 1
	}
	options := h.service.GetAllowedMilestoneTypes(grade)
	util.OK(c, gin.H{"grade": grade, "options": options})
}
