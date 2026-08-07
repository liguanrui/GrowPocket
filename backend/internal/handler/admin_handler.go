package handler

import (
	"encoding/json"
	"growpocket/internal/config"
	"growpocket/internal/database"
	"growpocket/internal/middleware"
	"growpocket/internal/model"
	"growpocket/internal/service"
	"growpocket/pkg/util"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	cfg     *config.Config
	service *service.AdminAuthService
}

func NewAdminHandler(cfg *config.Config) *AdminHandler {
	return &AdminHandler{
		cfg:     cfg,
		service: service.NewAdminAuthService(cfg),
	}
}

func (h *AdminHandler) WithService(s *service.AdminAuthService) *AdminHandler {
	h.service = s
	return h
}

type adminLoginReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func (h *AdminHandler) Login(c *gin.Context) {
	var req adminLoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	admin, token, err := h.service.Login(req.Username, req.Password, c.ClientIP())
	if err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	go h.service.RecordOperationLog(admin.ID, admin.Username, "admin.auth.login", "", 0, "", c.ClientIP(), c.Request.UserAgent())

	util.OK(c, gin.H{
		"token": token,
		"admin": gin.H{
			"id":         admin.ID,
			"username":   admin.Username,
			"nickname":   admin.Nickname,
			"role":       admin.Role,
			"is_active":  admin.IsActive,
			"created_at": admin.CreatedAt,
		},
	})
}

func (h *AdminHandler) Refresh(c *gin.Context) {
	adminID := middleware.GetAdminUserID(c)
	username := middleware.GetAdminUsername(c)
	role := middleware.GetAdminRole(c)
	if adminID == 0 {
		util.FailUnauthorized(c, "未提供管理员认证")
		return
	}

	newToken, err := util.GenerateAdminJWT(adminID, username, role, h.cfg.AdminJWTSecret, h.cfg.AdminJWTExpireHour)
	if err != nil {
		util.FailInternal(c, "刷新令牌失败")
		return
	}
	util.OK(c, gin.H{"token": newToken})
}

func (h *AdminHandler) Me(c *gin.Context) {
	adminID := middleware.GetAdminUserID(c)
	if adminID == 0 {
		util.FailUnauthorized(c, "未提供管理员认证")
		return
	}

	var admin model.AdminUser
	if err := database.DB.First(&admin, adminID).Error; err != nil {
		util.FailNotFound(c, "管理员不存在")
		return
	}

	util.OK(c, gin.H{
		"id":              admin.ID,
		"username":        admin.Username,
		"nickname":        admin.Nickname,
		"role":            admin.Role,
		"is_active":       admin.IsActive,
		"last_login_at":   admin.LastLoginAt,
		"last_login_ip":   admin.LastLoginIP,
		"created_at":      admin.CreatedAt,
	})
}

type adminChangePasswordReq struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

func (h *AdminHandler) ChangePassword(c *gin.Context) {
	var req adminChangePasswordReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	adminID := middleware.GetAdminUserID(c)
	adminName := middleware.GetAdminUsername(c)

	if err := h.service.ChangePassword(adminID, req.OldPassword, req.NewPassword); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	go h.service.RecordOperationLog(adminID, adminName, "admin.auth.change_password", "", 0, "", c.ClientIP(), c.Request.UserAgent())
	util.OK(c, gin.H{"message": "密码修改成功"})
}

func (h *AdminHandler) ListAdmins(c *gin.Context) {
	admins, err := h.service.ListAdmins()
	if err != nil {
		util.FailInternal(c, "查询管理员列表失败")
		return
	}

	result := make([]gin.H, 0, len(admins))
	for _, a := range admins {
		result = append(result, gin.H{
			"id":            a.ID,
			"username":      a.Username,
			"nickname":      a.Nickname,
			"role":          a.Role,
			"is_active":     a.IsActive,
			"last_login_at": a.LastLoginAt,
			"last_login_ip": a.LastLoginIP,
			"created_at":    a.CreatedAt,
		})
	}
	util.OK(c, result)
}

type adminCreateReq struct {
	Username string `json:"username" binding:"required"`
	Nickname string `json:"nickname"`
	Role     string `json:"role"`
	Password string `json:"password" binding:"required"`
	IsActive bool   `json:"is_active"`
}

func (h *AdminHandler) CreateAdmin(c *gin.Context) {
	var req adminCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}
	if len(req.Password) < 8 {
		util.FailBadRequest(c, "密码长度至少 8 位")
		return
	}
	if len(req.Username) < 2 || len(req.Username) > 50 {
		util.FailBadRequest(c, "用户名长度需在 2-50 字符之间")
		return
	}

	u := &model.AdminUser{
		Username: req.Username,
		Nickname: req.Nickname,
		Role:     req.Role,
		IsActive: req.IsActive,
	}
	if req.Role == "" {
		u.Role = model.AdminRoleAdmin
	}

	if err := h.service.CreateAdmin(u, req.Password); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	detail, _ := json.Marshal(gin.H{"username": u.Username, "nickname": u.Nickname, "role": u.Role})
	go h.service.RecordOperationLog(
		middleware.GetAdminUserID(c), middleware.GetAdminUsername(c),
		"admin.user.create", "admin_user", u.ID, string(detail),
		c.ClientIP(), c.Request.UserAgent(),
	)

	util.OK(c, gin.H{
		"id":         u.ID,
		"username":   u.Username,
		"nickname":   u.Nickname,
		"role":       u.Role,
		"is_active":  u.IsActive,
		"created_at": u.CreatedAt,
	})
}

type adminUpdateReq struct {
	Nickname string `json:"nickname"`
	Role     string `json:"role"`
	IsActive bool   `json:"is_active"`
}

func (h *AdminHandler) UpdateAdmin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "ID 参数错误")
		return
	}

	var req adminUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		util.FailBadRequest(c, "参数错误: "+err.Error())
		return
	}

	u := &model.AdminUser{
		Nickname: req.Nickname,
		Role:     req.Role,
		IsActive: req.IsActive,
	}

	if err := h.service.UpdateAdmin(uint(id), u); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	detail, _ := json.Marshal(req)
	go h.service.RecordOperationLog(
		middleware.GetAdminUserID(c), middleware.GetAdminUsername(c),
		"admin.user.update", "admin_user", uint(id), string(detail),
		c.ClientIP(), c.Request.UserAgent(),
	)

	util.OK(c, gin.H{"message": "更新成功"})
}

func (h *AdminHandler) DeleteAdmin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil || id == 0 {
		util.FailBadRequest(c, "ID 参数错误")
		return
	}

	if uint(id) == middleware.GetAdminUserID(c) {
		util.FailBadRequest(c, "不能删除自己的账号")
		return
	}

	if err := h.service.DeleteAdmin(uint(id)); err != nil {
		util.FailBadRequest(c, err.Error())
		return
	}

	go h.service.RecordOperationLog(
		middleware.GetAdminUserID(c), middleware.GetAdminUsername(c),
		"admin.user.delete", "admin_user", uint(id), "",
		c.ClientIP(), c.Request.UserAgent(),
	)

	util.OK(c, gin.H{"message": "删除成功"})
}

func (h *AdminHandler) ListOperationLogs(c *gin.Context) {
	pag := util.GetPagination(c)

	q := service.OperationLogQuery{
		Action:   c.Query("action"),
		DateFrom: c.Query("date_from"),
		DateTo:   c.Query("date_to"),
	}
	if s := c.Query("admin_id"); s != "" {
		if n, err := strconv.ParseUint(s, 10, 32); err == nil {
			q.AdminID = uint(n)
		}
	}

	logs, total, err := h.service.ListOperationLogs(pag, q)
	if err != nil {
		util.FailInternal(c, "查询操作日志失败")
		return
	}

	util.OK(c, util.PaginatedResponse{
		Items:    logs,
		Total:    total,
		Page:     pag.Page,
		PageSize: pag.PageSize,
	})
}
