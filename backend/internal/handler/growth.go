package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"

	"github.com/gin-gonic/gin"
)

type GrowthHandler struct {
	service *service.GrowthService
}

func NewGrowthHandler() *GrowthHandler {
	return &GrowthHandler{service: service.NewGrowthService()}
}

func (h *GrowthHandler) Album(c *gin.Context) {
	childID, _ := parseUintFromQuery(c, "child_id")
	if childID == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}

	page := util.ParseInt(c.Query("page"), 1)
	pageSize := util.ParseInt(c.Query("page_size"), 20)

	tasks, total, err := h.service.Album(childID, middleware.GetFamilyID(c), page, pageSize)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	// 构造相册输出：只保留照片相关字段
	type photoItem struct {
		TaskID    uint      `json:"task_id"`
		TaskTitle string    `json:"task_title"`
		Photo     string    `json:"photo"`
		Points    int       `json:"points"`
		CreatedAt string    `json:"created_at"`
	}
	items := make([]photoItem, 0, len(tasks))
	for _, t := range tasks {
		items = append(items, photoItem{
			TaskID:    t.ID,
			TaskTitle: t.Title,
			Photo:     t.Photo,
			Points:    t.Points,
			CreatedAt: t.CreatedAt.Format("2006-01-02 15:04"),
		})
	}

	util.OK(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

func (h *GrowthHandler) Timeline(c *gin.Context) {
	childID, _ := parseUintFromQuery(c, "child_id")
	if childID == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}

	days := util.ParseInt(c.Query("days"), 30)
	data, err := h.service.Timeline(childID, middleware.GetFamilyID(c), days)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}
	if data == nil {
		data = make([]map[string]interface{}, 0)
	}
	util.OK(c, data)
}
