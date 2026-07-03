package handler

import (
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AchievementHandler struct {
	service *service.AchievementService
}

func NewAchievementHandler() *AchievementHandler {
	return &AchievementHandler{
		service: &service.AchievementService{},
	}
}

func (h *AchievementHandler) GetAchievements(c *gin.Context) {
	childIDStr := c.Query("child_id")
	childID64, err := strconv.ParseUint(childIDStr, 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "child_id is required")
		return
	}
	childID := uint(childID64)

	achievements, err := h.service.GetAchievements(childID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	util.OK(c, achievements)
}

func (h *AchievementHandler) CheckAndUnlock(c *gin.Context) {
	childIDStr := c.Query("child_id")
	childID64, err := strconv.ParseUint(childIDStr, 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "child_id is required")
		return
	}
	childID := uint(childID64)

	if err := h.service.CheckAndUnlock(childID); err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	achievements, err := h.service.GetAchievements(childID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	util.OK(c, achievements)
}
