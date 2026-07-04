package handler

import (
	"growpocket/internal/service"
	"growpocket/internal/middleware"
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
	familyID := middleware.GetFamilyID(c)

	achievements, err := h.service.GetUserAchievements(childID, familyID)
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
	familyID := middleware.GetFamilyID(c)

	if err := h.service.CheckAndUnlock(childID, familyID); err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	achievements, err := h.service.GetUserAchievements(childID, familyID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	util.OK(c, achievements)
}

func (h *AchievementHandler) GetAchievementAwards(c *gin.Context) {
	childIDStr := c.Query("child_id")
	childID64, err := strconv.ParseUint(childIDStr, 10, 32)
	if err != nil || childID64 == 0 {
		util.FailBadRequest(c, "child_id is required")
		return
	}
	childID := uint(childID64)

	achievementIDStr := c.Query("achievement_id")
	var achievementID uint
	if achievementIDStr != "" {
		aid64, err := strconv.ParseUint(achievementIDStr, 10, 32)
		if err != nil {
			util.FailBadRequest(c, "invalid achievement_id")
			return
		}
		achievementID = uint(aid64)
	}

	awards, err := h.service.GetAchievementAwards(childID, achievementID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	util.OK(c, awards)
}
