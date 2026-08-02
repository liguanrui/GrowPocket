package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

// MasterChallengeHandler 大师挑战 handler（V3.1 模块 B）
type MasterChallengeHandler struct {
	service *service.MasterChallengeService
}

// NewMasterChallengeHandler 创建大师挑战 handler
func NewMasterChallengeHandler(svc *service.MasterChallengeService) *MasterChallengeHandler {
	return &MasterChallengeHandler{service: svc}
}

// GetTemplates GET /api/master-challenges/templates?child_id=xxx
// 获取该孩子可用的大师挑战模板列表
func (h *MasterChallengeHandler) GetTemplates(c *gin.Context) {
	childID64, err := strconv.ParseUint(c.Query("child_id"), 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "请提供有效的 child_id")
		return
	}
	childID := uint(childID64)
	familyID := middleware.GetFamilyID(c)

	// 校验孩子归属
	childService := service.NewChildService()
	if _, err := childService.GetChild(childID, familyID); err != nil {
		util.FailForbidden(c, "孩子档案不存在或不属于当前家庭")
		return
	}

	templates, err := h.service.GetAvailableTemplates(childID, familyID)
	if err != nil {
		util.FailInternal(c, "查询大师挑战模板失败")
		return
	}
	util.OK(c, gin.H{"items": templates, "total": len(templates)})
}

// StartInstance POST /api/master-challenges/start
// 立项：从模板创建实例 + AI 拆阶段
func (h *MasterChallengeHandler) StartInstance(c *gin.Context) {
	var req struct {
		ChildID    uint `json:"child_id" binding:"required"`
		TemplateID uint `json:"template_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 child_id 和 template_id")
		return
	}
	familyID := middleware.GetFamilyID(c)

	// 校验孩子归属
	childService := service.NewChildService()
	if _, err := childService.GetChild(req.ChildID, familyID); err != nil {
		util.FailForbidden(c, "孩子档案不存在或不属于当前家庭")
		return
	}

	instance, stages, err := h.service.StartInstance(req.ChildID, familyID, req.TemplateID)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"instance": instance, "stages": stages})
}

// ListInstances GET /api/master-challenges/instances/:child_id
// 查询孩子的大师挑战实例列表
func (h *MasterChallengeHandler) ListInstances(c *gin.Context) {
	childID64, err := strconv.ParseUint(c.Param("child_id"), 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "无效的 child_id")
		return
	}
	childID := uint(childID64)
	familyID := middleware.GetFamilyID(c)

	// 校验孩子归属
	childService := service.NewChildService()
	if _, err := childService.GetChild(childID, familyID); err != nil {
		util.FailForbidden(c, "孩子档案不存在或不属于当前家庭")
		return
	}

	instances, err := h.service.GetInstances(childID, familyID)
	if err != nil {
		util.FailInternal(c, "查询实例列表失败")
		return
	}
	util.OK(c, gin.H{"items": instances, "total": len(instances)})
}

// GetInstanceDetail GET /api/master-challenges/instances/detail/:instance_id
// 查询实例详情（含阶段和提交）
func (h *MasterChallengeHandler) GetInstanceDetail(c *gin.Context) {
	instanceID64, err := strconv.ParseUint(c.Param("instance_id"), 10, 32)
	if err != nil || instanceID64 == 0 {
		util.FailBadRequest(c, "无效的 instance_id")
		return
	}
	instanceID := uint(instanceID64)
	familyID := middleware.GetFamilyID(c)

	detail, err := h.service.GetInstanceDetail(instanceID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	// 权限校验：实例必须属于当前家庭
	if detail.Instance.FamilyID != familyID {
		util.FailForbidden(c, "无权访问该实例")
		return
	}
	util.OK(c, detail)
}

// UpdateStage PUT /api/master-challenges/stages/:stage_id
// 阶段打卡
func (h *MasterChallengeHandler) UpdateStage(c *gin.Context) {
	stageID64, err := strconv.ParseUint(c.Param("stage_id"), 10, 32)
	if err != nil || stageID64 == 0 {
		util.FailBadRequest(c, "无效的 stage_id")
		return
	}
	stageID := uint(stageID64)

	var req struct {
		Notes       string `json:"notes"`
		Attachments string `json:"attachments"` // JSON 数组字符串
		SelfRating  int    `json:"self_rating"` // 1-5
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请求体格式错误")
		return
	}

	// 权限校验：先查阶段 → 查实例 → 比对 family_id
	familyID := middleware.GetFamilyID(c)
	stage, err := h.service.GetStageByID(stageID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	detail, err := h.service.GetInstanceDetail(stage.InstanceID)
	if err != nil || detail.Instance.FamilyID != familyID {
		util.FailForbidden(c, "无权操作该阶段")
		return
	}

	updatedStage, err := h.service.UpdateStage(stageID, req.Notes, req.Attachments, req.SelfRating)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, updatedStage)
}

// SubmitForReview POST /api/master-challenges/submit/:instance_id
// 提交验收
func (h *MasterChallengeHandler) SubmitForReview(c *gin.Context) {
	instanceID64, err := strconv.ParseUint(c.Param("instance_id"), 10, 32)
	if err != nil || instanceID64 == 0 {
		util.FailBadRequest(c, "无效的 instance_id")
		return
	}
	instanceID := uint(instanceID64)

	var req struct {
		ChildSummary string `json:"child_summary"`
		Attachments  string `json:"attachments"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请求体格式错误")
		return
	}

	// 权限校验
	familyID := middleware.GetFamilyID(c)
	detail, err := h.service.GetInstanceDetail(instanceID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	if detail.Instance.FamilyID != familyID {
		util.FailForbidden(c, "无权操作该实例")
		return
	}

	submission, err := h.service.SubmitForReview(instanceID, req.ChildSummary, req.Attachments)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, submission)
}

// Review POST /api/master-challenges/review/:submission_id
// 家长验收打分（3 维，≥2 维达到 4 星即通过）
func (h *MasterChallengeHandler) Review(c *gin.Context) {
	submissionID64, err := strconv.ParseUint(c.Param("submission_id"), 10, 32)
	if err != nil || submissionID64 == 0 {
		util.FailBadRequest(c, "无效的 submission_id")
		return
	}
	submissionID := uint(submissionID64)

	if middleware.GetRole(c) != "parent" {
		util.FailForbidden(c, "仅家长可验收大师挑战")
		return
	}

	var req struct {
		ParticipationScore int `json:"participation_score" binding:"required"`
		ApplicationScore   int `json:"application_score" binding:"required"`
		QualityScore       int `json:"quality_score" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 participation_score, application_score, quality_score")
		return
	}

	// 权限校验：先查提交 → 查实例 → 比对 family_id
	familyID := middleware.GetFamilyID(c)
	submission, err := h.service.GetSubmissionByID(submissionID)
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	detail, err := h.service.GetInstanceDetail(submission.InstanceID)
	if err != nil || detail.Instance.FamilyID != familyID {
		util.FailForbidden(c, "无权操作该提交")
		return
	}

	result, err := h.service.Review(submissionID, req.ParticipationScore, req.ApplicationScore, req.QualityScore)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, result)
}
