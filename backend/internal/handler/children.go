package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"time"

	"github.com/gin-gonic/gin"
)

type ChildrenHandler struct {
	service *service.ChildService
}

func NewChildrenHandler() *ChildrenHandler {
	return &ChildrenHandler{service: service.NewChildService()}
}

type addChildReq struct {
	Nickname string  `json:"nickname" binding:"required"`
	Gender   *int    `json:"gender"`
	Birthday *string `json:"birthday"` // RFC3339 字符串
	Grade    *int    `json:"grade"`
	Age      *int    `json:"age"`
	Hobbies  string  `json:"hobbies"`
}

func (h *ChildrenHandler) AddChild(c *gin.Context) {
	var req addChildReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	var birthday *time.Time
	if req.Birthday != nil && *req.Birthday != "" {
		if t, err := time.Parse(time.RFC3339, *req.Birthday); err == nil {
			birthday = &t
		}
	}

	child, err := h.service.AddChild(service.AddChildInput{
		FamilyID: middleware.GetFamilyID(c),
		Nickname: req.Nickname,
		Gender:   req.Gender,
		Birthday: birthday,
		Grade:    req.Grade,
		Age:      req.Age,
		Hobbies:  req.Hobbies,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, child)
}

func (h *ChildrenHandler) ListChildren(c *gin.Context) {
	children, err := h.service.ListChildren(middleware.GetFamilyID(c))
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if children == nil {
		children = make([]model.User, 0)
	}
	util.OK(c, children)
}

func (h *ChildrenHandler) GetChild(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	child, err := h.service.GetChild(id, middleware.GetFamilyID(c))
	if err != nil {
		util.FailNotFound(c, err.Error())
		return
	}

	util.OK(c, child)
}

type updateChildReq struct {
	Nickname *string `json:"nickname"`
	Gender   *int    `json:"gender"`
	Birthday *string `json:"birthday"`
	Avatar   *string `json:"avatar"`
	Grade    *int    `json:"grade"`
	Age      *int    `json:"age"`
	Hobbies  *string `json:"hobbies"`
}

func (h *ChildrenHandler) UpdateChild(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}

	var req updateChildReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	var birthday *time.Time
	if req.Birthday != nil && *req.Birthday != "" {
		if t, err := time.Parse(time.RFC3339, *req.Birthday); err == nil {
			birthday = &t
		}
	}

	child, err := h.service.UpdateChild(id, middleware.GetFamilyID(c), service.UpdateChildInput{
		Nickname: req.Nickname,
		Gender:   req.Gender,
		Birthday: birthday,
		Avatar:   req.Avatar,
		Grade:    req.Grade,
		Age:      req.Age,
		Hobbies:  req.Hobbies,
	})
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, child)
}

func (h *ChildrenHandler) DeleteChild(c *gin.Context) {
	id, err := parseUintID(c.Param("id"))
	if err != nil {
		util.FailBadRequest(c, "ID 格式错误")
		return
	}
	if err := h.service.DeleteChild(id, middleware.GetFamilyID(c)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, nil)
}

type updateFamilyNameReq struct {
	Name string `json:"name" binding:"required"`
}

func (h *ChildrenHandler) UpdateFamilyName(c *gin.Context) {
	var req updateFamilyNameReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	family, err := h.service.UpdateFamilyName(middleware.GetFamilyID(c), req.Name)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"id": family.ID, "name": family.Name})
}

// 辅助函数：解析 uint ID
func parseUintID(s string) (uint, error) {
	if s == "" {
		return 0, nil
	}
	var id uint
	for _, ch := range s {
		if ch < '0' || ch > '9' {
			return 0, nil
		}
		id = id*10 + uint(ch-'0')
	}
	return id, nil
}
