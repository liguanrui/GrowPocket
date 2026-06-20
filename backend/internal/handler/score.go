package handler

import (
	"growpocket/internal/config"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ScoreHandler struct {
	cfg     *config.Config
	service *service.ScoreService
}

func NewScoreHandler(cfg *config.Config) *ScoreHandler {
	return &ScoreHandler{cfg: cfg, service: service.NewScoreService()}
}

func (h *ScoreHandler) GetBalance(c *gin.Context) {
	childID, err := parseUintFromQuery(c, "child_id")
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}

	balance, name, err := h.service.GetBalance(childID, middleware.GetFamilyID(c))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{"child_id": childID, "child_name": name, "balance": balance})
}

func (h *ScoreHandler) GetHistory(c *gin.Context) {
	childID, err := parseUintFromQuery(c, "child_id")
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}

	page := util.ParseInt(c.Query("page"), 1)
	pageSize := util.ParseInt(c.Query("page_size"), 20)

	records, total, err := h.service.GetHistory(childID, middleware.GetFamilyID(c), page, pageSize)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if records == nil {
		records = make([]model.Transaction, 0)
	}
	util.OK(c, gin.H{
		"items":     records,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

type adjustReq struct {
	ChildID     uint   `json:"child_id" binding:"required"`
	Points      int    `json:"points" binding:"required"` // 正数
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
	Photo       string `json:"photo"` // 可选：照片 URL
}

func (h *ScoreHandler) AddPoints(c *gin.Context) {
	var req adjustReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	if req.Points <= 0 {
		util.FailBadRequest(c, "积分必须为正数")
		return
	}

	newBalance, err := h.service.Adjust(
		req.ChildID,
		middleware.GetFamilyID(c),
		middleware.GetUserID(c),
		req.Points,
		req.Title,
		req.Description,
		req.Photo,
	)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"balance": newBalance, "child_id": req.ChildID})
}

func (h *ScoreHandler) DeductPoints(c *gin.Context) {
	var req adjustReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	if req.Points <= 0 {
		util.FailBadRequest(c, "积分必须为正数")
		return
	}

	newBalance, err := h.service.Adjust(
		req.ChildID,
		middleware.GetFamilyID(c),
		middleware.GetUserID(c),
		-req.Points,
		req.Title,
		req.Description,
		req.Photo,
	)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"balance": newBalance, "child_id": req.ChildID})
}

func (h *ScoreHandler) GetTrend(c *gin.Context) {
	childID, err := parseUintFromQuery(c, "child_id")
	if err != nil || childID == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}

	days := util.ParseInt(c.Query("days"), 7)
	data, err := h.service.GetTrend(childID, middleware.GetFamilyID(c), days)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, data)
}

func parseUintFromQuery(c *gin.Context, key string) (uint, error) {
	s := c.Query(key)
	if s == "" {
		return 0, nil
	}
	v, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(v), nil
}
