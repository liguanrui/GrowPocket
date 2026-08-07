package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AdminFamilyHandler struct {
	svc *service.AdminFamilyService
}

func NewAdminFamilyHandler(svc *service.AdminFamilyService) *AdminFamilyHandler {
	return &AdminFamilyHandler{svc: svc}
}

func (h *AdminFamilyHandler) ListFamilies(c *gin.Context) {
	pag := util.GetPagination(c)
	search := c.Query("search")
	status := c.Query("status")
	sort := c.Query("sort")
	order := c.Query("order")

	result, err := h.svc.ListFamilies(pag, search, status, sort, order)
	if err != nil {
		util.FailInternal(c, "查询家庭列表失败: "+err.Error())
		return
	}
	util.OK(c, result)
}

func (h *AdminFamilyHandler) GetFamilyDetail(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "家庭 ID 参数错误")
		return
	}
	detail, err := h.svc.GetFamilyDetail(uint(id))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, detail)
}

type toggleFamilyStatusReq struct {
	Reason string `json:"reason"`
}

func (h *AdminFamilyHandler) ToggleFamilyStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "家庭 ID 参数错误")
		return
	}
	var req toggleFamilyStatusReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	adminID := middleware.GetAdminUserID(c)
	adminName := middleware.GetAdminUsername(c)
	isActive, err := h.svc.ToggleFamilyStatus(uint(id), adminID, adminName, req.Reason, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{
		"is_active": isActive,
		"message":   "状态切换成功",
	})
}

func (h *AdminFamilyHandler) ListChildren(c *gin.Context) {
	pag := util.GetPagination(c)
	search := c.Query("search")

	grade := 0
	if g := c.Query("grade"); g != "" {
		if n, err := strconv.Atoi(g); err == nil {
			grade = n
		}
	}

	var familyID uint
	if fid := c.Query("family_id"); fid != "" {
		if n, err := strconv.ParseUint(fid, 10, 32); err == nil {
			familyID = uint(n)
		}
	}

	result, err := h.svc.ListChildren(pag, search, grade, familyID)
	if err != nil {
		util.FailInternal(c, "查询孩子列表失败: "+err.Error())
		return
	}
	util.OK(c, result)
}

func (h *AdminFamilyHandler) GetChildDetail(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "孩子 ID 参数错误")
		return
	}
	detail, err := h.svc.GetChildDetail(uint(id))
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, detail)
}

func (h *AdminFamilyHandler) ListParents(c *gin.Context) {
	pag := util.GetPagination(c)
	search := c.Query("search")

	var familyID uint
	if fid := c.Query("family_id"); fid != "" {
		if n, err := strconv.ParseUint(fid, 10, 32); err == nil {
			familyID = uint(n)
		}
	}

	result, err := h.svc.ListParents(pag, search, familyID)
	if err != nil {
		util.FailInternal(c, "查询家长列表失败: "+err.Error())
		return
	}
	util.OK(c, result)
}
