package middleware

import (
	"growpocket/pkg/util"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	AdminUserIDKey   contextKey = "admin_user_id"
	AdminUsernameKey contextKey = "admin_username"
	AdminRoleKey     contextKey = "admin_role"
)

func AdminJWTAuth(adminSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			util.FailUnauthorized(c, "未提供管理员认证令牌")
			c.Abort()
			return
		}

		parts := strings.Split(auth, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			util.FailUnauthorized(c, "管理员认证令牌格式错误")
			c.Abort()
			return
		}

		claims, err := util.ParseAdminJWT(parts[1], adminSecret)
		if err != nil {
			util.FailUnauthorized(c, "管理员认证令牌无效或已过期")
			c.Abort()
			return
		}

		c.Set(string(AdminUserIDKey), claims.AdminID)
		c.Set(string(AdminUsernameKey), claims.Username)
		c.Set(string(AdminRoleKey), claims.Role)

		c.Next()
	}
}

func RequireAdminRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := GetAdminRole(c)
		if role == "" {
			util.FailUnauthorized(c, "未提供管理员认证")
			c.Abort()
			return
		}
		for _, allowed := range roles {
			if role == allowed {
				c.Next()
				return
			}
		}
		util.FailForbidden(c, "无权限执行此操作")
		c.Abort()
	}
}

func GetAdminUserID(c *gin.Context) uint {
	v, _ := c.Get(string(AdminUserIDKey))
	if id, ok := v.(uint); ok {
		return id
	}
	return 0
}

func GetAdminUsername(c *gin.Context) string {
	v, _ := c.Get(string(AdminUsernameKey))
	if n, ok := v.(string); ok {
		return n
	}
	return ""
}

func GetAdminRole(c *gin.Context) string {
	v, _ := c.Get(string(AdminRoleKey))
	if r, ok := v.(string); ok {
		return r
	}
	return ""
}
