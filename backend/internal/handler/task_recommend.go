package handler

import (
	"growpocket/internal/middleware"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type TaskRecommendHandler struct {
	service *service.TaskRecommendService
}

func NewTaskRecommendHandler() *TaskRecommendHandler {
	return &TaskRecommendHandler{
		service: service.NewTaskRecommendService(),
	}
}

func (h *TaskRecommendHandler) GetRecommendations(c *gin.Context) {
	childID := uint(0)
	if s := c.Query("child_id"); s != "" {
		if v, err := strconv.ParseUint(s, 10, 64); err == nil {
			childID = uint(v)
		}
	}
	if childID == 0 {
		util.FailBadRequest(c, "请提供 child_id")
		return
	}

	count := util.ParseInt(c.Query("count"), 5)

	childService := service.NewChildService()
	child, err := childService.GetChild(childID, middleware.GetFamilyID(c))
	if err != nil {
		util.FailForbidden(c, "孩子档案不存在或不属于当前家庭")
		return
	}

	birthday := child.Birthday

	recommendations, err := h.service.GetRecommendedTasks(childID, middleware.GetFamilyID(c), birthday, count)
	if err != nil {
		util.FailInternal(c, err.Error())
		return
	}

	util.OK(c, recommendations)
}
