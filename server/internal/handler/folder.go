package handler

import (
	"net/http"
	"strings"
	"time"

	"scrauto/server/internal/middleware"
	"scrauto/server/internal/model"
	"scrauto/server/internal/repository"

	"github.com/gin-gonic/gin"
)

type FolderHandler struct {
	Store *repository.Store
}

func (h *FolderHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	folders, err := h.Store.ListFolders(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list folders"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"folders": folders})
}

func (h *FolderHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	folder := &model.Folder{
		UserID: userID,
		Name:   name,
	}
	if err := h.Store.CreateFolder(folder); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create folder"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"folder": folder})
}

func (h *FolderHandler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	folder, err := h.Store.FindFolder(userID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	folder.Name = name
	folder.UpdatedAt = time.Now()
	if err := h.Store.UpdateFolder(folder); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"folder": folder})
}

func (h *FolderHandler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	folder, err := h.Store.FindFolder(userID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if err := h.Store.DeleteFolder(folder); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
