package handler

import (
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
	Title       string `json:"title"`
	Description string `json:"description"`
	Photo       string `json:"photo"`
	TaskID      uint   `json:"task_id"`
	TaskTitle   string `json:"task_title"`
	TaskPoints  int    `json:"task_points"`
	Tag         string `json:"tag"`
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

	share, err := h.service.CreateShare(service.CreateShareInput{
		FamilyID:    familyID,
		UserID:      userID,
		Nickname:    nickname,
		Title:       req.Title,
		Description: req.Description,
		Photo:       req.Photo,
		TaskID:      req.TaskID,
		TaskTitle:   req.TaskTitle,
		TaskPoints:  req.TaskPoints,
		Tag:         req.Tag,
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

func (h *CommunityHandler) AddLike(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	familyID := middleware.GetFamilyID(c)
	userID := middleware.GetUserID(c)

	liked, count, err := h.service.AddLike(uint(id), familyID, userID)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{"liked": liked, "like_count": count})
}

func (h *CommunityHandler) RemoveLike(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	familyID := middleware.GetFamilyID(c)

	liked, count, err := h.service.RemoveLike(uint(id), familyID)
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

type joinProjectReq struct {
	ChildID uint   `json:"child_id"`
	Details string `json:"details"`
	Photo   string `json:"photo"`
}

func (h *CommunityHandler) JoinProject(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的 ID")
		return
	}

	var req joinProjectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误")
		return
	}

	if req.ChildID == 0 {
		util.FailBadRequest(c, "请选择孩子")
		return
	}

	familyID := middleware.GetFamilyID(c)
	childName := "孩子"

	donation, err := h.service.JoinProject(uint(id), familyID, req.ChildID, childName, req.Details, req.Photo)
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
