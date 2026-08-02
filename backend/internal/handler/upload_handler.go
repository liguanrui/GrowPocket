package handler

import (
	"growpocket/internal/config"
	"growpocket/pkg/util"

	"github.com/gin-gonic/gin"
)

type UploadHandler struct {
	cfg *config.Config
}

func NewUploadHandler(cfg *config.Config) *UploadHandler {
	return &UploadHandler{cfg: cfg}
}

// Upload POST /api/upload
// form-data 字段名：file
func (h *UploadHandler) Upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil || file == nil || header == nil {
		util.FailBadRequest(c, "请选择要上传的文件")
		return
	}
	defer file.Close()

	url, saveErr := util.SaveUploadedMedia(header, h.cfg.UploadDir)
	if saveErr != nil {
		util.FailBadRequest(c, saveErr.Error())
		return
	}

	util.OK(c, gin.H{
		"url":  url,
		"type": map[bool]string{true: "video", false: "image"}[util.IsVideoURL(url)],
	})
}
