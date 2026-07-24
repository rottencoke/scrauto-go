package handler

import (
	"net/http"
	"strings"

	"scrauto/server/internal/auth"
	"scrauto/server/internal/middleware"
	"scrauto/server/internal/model"
	"scrauto/server/internal/repository"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	Store     *repository.Store
	JWTSecret string
}

type credentialsRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

func (h *AuthHandler) Signup(c *gin.Context) {
	var req credentialsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if _, err := h.Store.FindUserByEmail(email); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}
	user := &model.User{Email: email, PasswordHash: hash}
	if err := h.Store.CreateUser(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
		return
	}
	h.respondWithToken(c, user)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req credentialsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	user, err := h.Store.FindUserByEmail(email)
	if err != nil || !auth.CheckPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	h.respondWithToken(c, user)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.GetUserID(c)
	user, err := h.Store.FindUserByID(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":    user.ID,
		"email": user.Email,
	})
}

func (h *AuthHandler) respondWithToken(c *gin.Context, user *model.User) {
	token, err := auth.IssueToken(h.JWTSecret, user.ID, user.Email, auth.TokenTTL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue token"})
		return
	}
	c.SetCookie("token", token, int(auth.TokenTTL.Seconds()), "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
		},
	})
}
