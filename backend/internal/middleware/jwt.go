package middleware

import (
	"growpocket/pkg/util"
	"strings"

	"github.com/gin-gonic/gin"
)

type contextKey string

const (
	UserIDKey   contextKey = "user_id"
	FamilyIDKey contextKey = "family_id"
	NicknameKey contextKey = "nickname"
	RoleKey     contextKey = "role"
)

func JWTAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		auth := c.GetHeader("Authorization")
		if auth == "" {
			util.FailUnauthorized(c, "未提供认证令牌")
			c.Abort()
			return
		}

		parts := strings.Split(auth, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			util.FailUnauthorized(c, "认证令牌格式错误")
			c.Abort()
			return
		}

		claims, err := util.ParseJWT(parts[1], jwtSecret)
		if err != nil {
			util.FailUnauthorized(c, "认证令牌无效或已过期")
			c.Abort()
			return
		}

		c.Set(string(UserIDKey), claims.UserID)
		c.Set(string(FamilyIDKey), claims.FamilyID)
		c.Set(string(NicknameKey), claims.Nickname)
		c.Set(string(RoleKey), claims.Role)

		c.Next()
	}
}

func GetUserID(c *gin.Context) uint {
	v, _ := c.Get(string(UserIDKey))
	if id, ok := v.(uint); ok {
		return id
	}
	return 0
}

func GetFamilyID(c *gin.Context) uint {
	v, _ := c.Get(string(FamilyIDKey))
	if id, ok := v.(uint); ok {
		return id
	}
	return 0
}

func GetNickname(c *gin.Context) string {
	v, _ := c.Get(string(NicknameKey))
	if n, ok := v.(string); ok {
		return n
	}
	return ""
}

func GetRole(c *gin.Context) string {
	v, _ := c.Get(string(RoleKey))
	if r, ok := v.(string); ok {
		return r
	}
	return ""
}
