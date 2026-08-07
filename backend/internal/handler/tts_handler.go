package handler

import (
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

type TTSHandler struct {
	tts *service.TTSService
}

func NewTTSHandler(tts *service.TTSService) *TTSHandler {
	return &TTSHandler{tts: tts}
}

type ttsRequest struct {
	Text string `json:"text"`
}

// Synthesize POST /api/tts
// 返回 audio/mpeg
func (h *TTSHandler) Synthesize(c *gin.Context) {
	var req ttsRequest
	if err := c.ShouldBindJSON(&req); err != nil || utf8.RuneCountInString(req.Text) == 0 {
		util.FailBadRequest(c, "text 不能为空")
		return
	}
	audio, err := h.tts.Synthesize(req.Text)
	if err != nil {
		util.Fail(c, 500, "语音合成失败: "+err.Error())
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Data(200, "audio/mpeg", audio)
}
