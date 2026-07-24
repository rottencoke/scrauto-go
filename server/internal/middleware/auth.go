package middleware

import (
	"net/http"
	"strings"

	"scrauto/server/internal/auth"

	"github.com/gin-gonic/gin"
)

const UserIDKey = "userID"
const UserEmailKey = "userEmail"

func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := extractToken(c)
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		claims, err := auth.ParseToken(jwtSecret, tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set(UserIDKey, claims.UserID)
		c.Set(UserEmailKey, claims.Email)
		c.Next()
	}
}

func extractToken(c *gin.Context) string {
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}
	if cookie, err := c.Cookie("token"); err == nil && cookie != "" {
		return cookie
	}
	return ""
}

func GetUserID(c *gin.Context) uint {
	v, _ := c.Get(UserIDKey)
	id, _ := v.(uint)
	return id
}
