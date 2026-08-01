package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AbilityHandler struct {
	service *service.AbilityService
}

func NewAbilityHandler() *AbilityHandler {
	return &AbilityHandler{service: service.NewAbilityService()}
}

// ListDimensions GET /api/abilities
func (h *AbilityHandler) ListDimensions(c *gin.Context) {
	dims, err := h.service.ListDimensions()
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, dims)
}

// GetChildScores GET /api/abilities/scores/:child_id
func (h *AbilityHandler) GetChildScores(c *gin.Context) {
	childID, err := strconv.ParseUint(c.Param("child_id"), 10, 32)
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供有效的 child_id")
		return
	}
	familyID := middleware.GetFamilyID(c)
	scores, err := h.service.GetChildScores(uint(childID), familyID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	// 关联维度信息返回
	dims, _ := h.service.ListDimensions()
	type scoreWithDim struct {
		DimensionID    uint   `json:"dimension_id"`
		Score          int    `json:"score"`
		DimensionCode  string `json:"dimension_code"`
		DimensionName  string `json:"dimension_name"`
		DimensionColor string `json:"dimension_color"`
	}
	result := make([]scoreWithDim, 0, len(dims))
	scoreMap := make(map[uint]int, len(scores))
	for _, s := range scores {
		scoreMap[s.DimensionID] = s.Score
	}
	for _, d := range dims {
		result = append(result, scoreWithDim{
			DimensionID:    d.ID,
			Score:          scoreMap[d.ID],
			DimensionCode:  d.Code,
			DimensionName:  d.Name,
			DimensionColor: d.Color,
		})
	}
	util.OK(c, result)
}

// GetGrowthIndex GET /api/abilities/growth-index/:child_id
func (h *AbilityHandler) GetGrowthIndex(c *gin.Context) {
	childID, err := strconv.ParseUint(c.Param("child_id"), 10, 32)
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供有效的 child_id")
		return
	}
	familyID := middleware.GetFamilyID(c)
	index, err := h.service.GetGrowthIndex(uint(childID), familyID)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{"growth_index": index})
}
