package handler

import (
	"encoding/json"
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type CommunityHandler struct {
	service *service.CommunityService
}

func NewCommunityHandler() *CommunityHandler {
	return &CommunityHandler{
		service: service.NewCommunityService(),
	}
}

// ===== 分享 =====

type createShareReq struct {
	ShareType      string   `json:"share_type"`
	Content        string   `json:"content"`
	Photos         []string `json:"photos"`
	TaskID         uint     `json:"task_id"`
	TaskTitle      string   `json:"task_title"`
	TaskPoints     int      `json:"task_points"`
	ChildName      string   `json:"child_name"`
	Tag            string   `json:"tag"`
	GrowthStoryID  uint     `json:"growth_story_id"`   // 成长故事ID（share_type=growth_story 时关联）
	AbilitySummary string   `json:"ability_summary"`  // 能力提升摘要（成长故事分享时）
}

func (h *CommunityHandler) CreateShare(c *gin.Context) {
	var req createShareReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误")
		return
	}

	familyID := middleware.GetFamilyID(c)
	userID := middleware.GetUserID(c)
	nickname := middleware.GetNickname(c)

	var photosJSON string
	if len(req.Photos) > 0 {
		data, err := json.Marshal(req.Photos)
		if err != nil {
			util.FailBadRequest(c, "图片数据错误")
			return
		}
		photosJSON = string(data)
	}

	if req.ShareType == "" {
		req.ShareType = "text"
	}

	share, err := h.service.CreateShare(service.CreateShareInput{
		FamilyID:       familyID,
		UserID:         userID,
		Nickname:       nickname,
		ShareType:      req.ShareType,
		Content:        req.Content,
		Photos:         photosJSON,
		TaskID:         req.TaskID,
		TaskTitle:      req.TaskTitle,
		TaskPoints:     req.TaskPoints,
		ChildName:      req.ChildName,
		Tag:            req.Tag,
		GrowthStoryID:  req.GrowthStoryID,
		AbilitySummary: req.AbilitySummary,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, share)
}

func (h *CommunityHandler) ListShares(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	sort := c.DefaultQuery("sort", "latest")

	shares, total, err := h.service.ListShares(service.ListSharesParams{
		Page:     page,
		PageSize: pageSize,
		Sort:     sort,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{
		"items":     shares,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *CommunityHandler) GetShare(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	share, err := h.service.GetShare(uint(id))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}
	util.OK(c, share)
}

func (h *CommunityHandler) DeleteShare(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	familyID := middleware.GetFamilyID(c)
	if err := h.service.DeleteShare(uint(id), familyID); err != nil {
		util.FailForbidden(c, err.Error())
		return
	}
	util.OK(c, gin.H{"success": true})
}

// ===== 点赞 =====

func (h *CommunityHandler) ToggleLike(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	familyID := middleware.GetFamilyID(c)
	userID := middleware.GetUserID(c)

	liked, count, err := h.service.ToggleLike(uint(id), familyID, userID)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{"liked": liked, "like_count": count})
}

// ===== 评论 =====

type addCommentReq struct {
	Content string `json:"content"`
}

func (h *CommunityHandler) AddComment(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	var req addCommentReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误")
		return
	}

	familyID := middleware.GetFamilyID(c)
	userID := middleware.GetUserID(c)
	nickname := middleware.GetNickname(c)

	comment, err := h.service.AddComment(uint(id), familyID, userID, nickname, req.Content)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, comment)
}

func (h *CommunityHandler) ListComments(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	comments, err := h.service.ListComments(uint(id))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{"items": comments, "total": len(comments)})
}

// ===== 公益项目 =====

func (h *CommunityHandler) ListProjects(c *gin.Context) {
	projects, err := h.service.ListProjects()
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"items": projects, "total": len(projects)})
}

type createDonationReq struct {
	ChildID      uint    `json:"child_id"`
	Weight       float64 `json:"weight"`
	Details      string  `json:"details"`
	ContactName  string  `json:"contact_name"`
	ContactPhone string  `json:"contact_phone"`
	Address      string  `json:"address"`
	Photo        string  `json:"photo"`
}

func (h *CommunityHandler) CreateDonation(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的项目 ID")
		return
	}

	var req createDonationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误")
		return
	}

	if req.ChildID == 0 {
		util.FailBadRequest(c, "请选择捐赠人（孩子）")
		return
	}

	familyID := middleware.GetFamilyID(c)

	child, err := h.service.GetChildByID(req.ChildID)
	if err != nil {
		util.FailBadRequest(c, "孩子信息不存在")
		return
	}

	donation, err := h.service.CreateDonation(service.CreateDonationInput{
		ProjectID:    uint(id),
		FamilyID:     familyID,
		ChildID:      req.ChildID,
		ChildName:    child.Nickname,
		Weight:       req.Weight,
		Details:      req.Details,
		ContactName:  req.ContactName,
		ContactPhone: req.ContactPhone,
		Address:      req.Address,
		Photo:        req.Photo,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, donation)
}

func (h *CommunityHandler) ListMyDonations(c *gin.Context) {
	familyID := middleware.GetFamilyID(c)
	donations, err := h.service.ListMyDonations(familyID)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"items": donations, "total": len(donations)})
}
