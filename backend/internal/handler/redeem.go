package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"

	"github.com/gin-gonic/gin"
)

type RedeemHandler struct {
	service *service.RedeemService
}

func NewRedeemHandler() *RedeemHandler {
	return &RedeemHandler{service: service.NewRedeemService()}
}

type createItemReq struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Points      int    `json:"points" binding:"required"`
	Image       string `json:"image"`
	Category    int    `json:"category"`
	Stock       int    `json:"stock"` // -1 表示无限
}

func (h *RedeemHandler) CreateItem(c *gin.Context) {
	var req createItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	item, err := h.service.CreateItem(service.CreateItemInput{
		FamilyID:    middleware.GetFamilyID(c),
		Name:        req.Name,
		Description: req.Description,
		Points:      req.Points,
		Image:       req.Image,
		Category:    req.Category,
		Stock:       req.Stock,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, item)
}

func (h *RedeemHandler) ListItems(c *gin.Context) {
	category := util.ParseInt(c.Query("category"), 0)
	page := util.ParseInt(c.Query("page"), 1)
	pageSize := util.ParseInt(c.Query("page_size"), 20)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	items, total, err := h.service.ListItems(middleware.GetFamilyID(c), category, page, pageSize)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if items == nil {
		items = make([]model.RedeemItem, 0)
	}
	util.OK(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *RedeemHandler) GetItem(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	item, err := h.service.GetItem(id, middleware.GetFamilyID(c))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, item)
}

type updateItemReq struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Points      *int    `json:"points"`
	Image       *string `json:"image"`
	Category    *int    `json:"category"`
	Stock       *int    `json:"stock"`
}

func (h *RedeemHandler) UpdateItem(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req updateItemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	item, err := h.service.UpdateItem(id, middleware.GetFamilyID(c), service.UpdateItemInput{
		Name:        req.Name,
		Description: req.Description,
		Points:      req.Points,
		Image:       req.Image,
		Category:    req.Category,
		Stock:       req.Stock,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, item)
}

func (h *RedeemHandler) DeleteItem(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	if err := h.service.DeleteItem(id, middleware.GetFamilyID(c)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, nil)
}

type redeemReq struct {
	ItemID  uint `json:"item_id" binding:"required"`
	ChildID uint `json:"child_id" binding:"required"`
}

func (h *RedeemHandler) Redeem(c *gin.Context) {
	var req redeemReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	redeem, newBalance, err := h.service.Redeem(req.ItemID, req.ChildID, middleware.GetFamilyID(c))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{
		"redeem":      redeem,
		"new_balance": newBalance,
	})
}

func (h *RedeemHandler) GetRedeems(c *gin.Context) {
	childID, _ := parseUintFromQuery(c, "child_id")
	if childID == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}

	page := util.ParseInt(c.Query("page"), 1)
	pageSize := util.ParseInt(c.Query("page_size"), 20)

	records, total, err := h.service.GetRedeems(childID, middleware.GetFamilyID(c), page, pageSize)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if records == nil {
		records = make([]model.Redeem, 0)
	}
	util.OK(c, gin.H{
		"items":     records,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}
