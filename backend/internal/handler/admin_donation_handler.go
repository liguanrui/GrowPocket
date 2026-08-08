package handler

import (
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AdminDonationHandler struct {
	svc *service.CommunityService
}

func NewAdminDonationHandler() *AdminDonationHandler {
	return &AdminDonationHandler{svc: service.NewCommunityService()}
}

// List GET /api/admin/donations?status=&page=&page_size=&keyword=
func (h *AdminDonationHandler) List(c *gin.Context) {
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	keyword := c.Query("keyword")

	items, total, err := h.svc.ListDonations(service.ListDonationsParams{
		Status:   status,
		Page:     page,
		PageSize: pageSize,
		Keyword:  keyword,
	})
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	util.OK(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// ConfirmReceived POST /api/admin/donations/:id/confirm-received
func (h *AdminDonationHandler) ConfirmReceived(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的捐赠 ID")
		return
	}
	if err := h.svc.ConfirmDonationReceived(uint(id)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"success": true})
}

// Complete POST /api/admin/donations/:id/complete
func (h *AdminDonationHandler) Complete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		util.FailBadRequest(c, "无效的捐赠 ID")
		return
	}
	if err := h.svc.CompleteDonation(uint(id)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}
	util.OK(c, gin.H{"success": true})
}
