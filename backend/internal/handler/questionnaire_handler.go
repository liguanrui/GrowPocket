package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"

	"github.com/gin-gonic/gin"
)

// QuestionnaireHandler 问卷处理器
type QuestionnaireHandler struct {
	service *service.QuestionnaireService
}

// NewQuestionnaireHandler 创建问卷处理器实例
func NewQuestionnaireHandler() *QuestionnaireHandler {
	return &QuestionnaireHandler{service: service.NewQuestionnaireService()}
}

// GetByStage GET /api/questionnaires/:stage?level=Lx
func (h *QuestionnaireHandler) GetByStage(c *gin.Context) {
	stage := c.Param("stage")
	if stage == "" {
		util.FailBadRequest(c, "请提供 stage")
		return
	}
	level := c.Query("level")
	q, err := h.service.GetByStage(stage, level)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, q)
}

// Submit POST /api/questionnaires/submit
func (h *QuestionnaireHandler) Submit(c *gin.Context) {
	var req struct {
		QuestionnaireID uint                  `json:"questionnaire_id" binding:"required"`
		Stage           string                `json:"stage" binding:"required"`
		ChildID         uint                  `json:"child_id" binding:"required"`
		Answers         []service.AnswerInput `json:"answers" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "请提供 questionnaire_id, stage, child_id, answers")
		return
	}
	familyID := middleware.GetFamilyID(c)
	reward, err := h.service.SubmitAnswers(familyID, req.ChildID, req.QuestionnaireID, req.Stage, req.Answers)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"reward": reward})
}
