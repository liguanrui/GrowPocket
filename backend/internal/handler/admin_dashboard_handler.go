package handler

import (
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AdminDashboardHandler struct {
	service        *service.AdminDashboardService
	adminLogService *service.AdminAuthService
}

func NewAdminDashboardHandler(service *service.AdminDashboardService, adminLogService *service.AdminAuthService) *AdminDashboardHandler {
	return &AdminDashboardHandler{
		service:        service,
		adminLogService: adminLogService,
	}
}

func (h *AdminDashboardHandler) GetOverview(c *gin.Context) {
	stats, err := h.service.GetOverviewStats()
	if err != nil {
		util.FailInternal(c, "获取概览统计失败: "+err.Error())
		return
	}
	util.OK(c, stats)
}

func (h *AdminDashboardHandler) GetTrends(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil || days <= 0 {
		days = 30
	}
	if days > 365 {
		days = 365
	}
	stats, err := h.service.GetTrendStats(days)
	if err != nil {
		util.FailInternal(c, "获取趋势统计失败: "+err.Error())
		return
	}
	util.OK(c, stats)
}

func (h *AdminDashboardHandler) GetAbilityRadar(c *gin.Context) {
	stats, err := h.service.GetAbilityRadar()
	if err != nil {
		util.FailInternal(c, "获取能力雷达数据失败: "+err.Error())
		return
	}
	util.OK(c, stats)
}
