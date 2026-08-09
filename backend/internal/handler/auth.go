package handler

import (
	"growpocket/internal/config"
	"growpocket/internal/service"
	"growpocket/pkg/util"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	cfg     *config.Config
	service *service.AuthService
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		cfg:     cfg,
		service: service.NewAuthService(),
	}
}

type registerReq struct {
	Nickname  string `json:"nickname" binding:"required"`
	Password  string `json:"password" binding:"required"`
	ShareCode string `json:"share_code"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	out, err := h.service.Register(service.RegisterInput{
		Nickname:  req.Nickname,
		Password:  req.Password,
		ShareCode: req.ShareCode,
	}, h.cfg.JWTSecret, h.cfg.JWTDuration)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{
		"token": out.Token,
		"user": gin.H{
			"id":       out.User.ID,
			"nickname": out.User.Nickname,
			"role":     out.User.Role,
		},
		"family": gin.H{
			"id":         out.Family.ID,
			"name":       out.Family.Name,
			"share_code": out.Family.ShareCode,
		},
		"has_children": out.HasChildren,
		"joined":       out.Joined,
	})
}

type loginReq struct {
	Nickname string `json:"nickname" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	out, err := h.service.Login(service.LoginInput{
		Nickname: req.Nickname,
		Password: req.Password,
	}, h.cfg.JWTSecret, h.cfg.JWTDuration)
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	util.OK(c, gin.H{
		"token": out.Token,
		"user": gin.H{
			"id":       out.User.ID,
			"nickname": out.User.Nickname,
			"role":     out.User.Role,
		},
		"family": gin.H{
			"id":         out.Family.ID,
			"name":       out.Family.Name,
			"share_code": out.Family.ShareCode,
		},
	})
}
