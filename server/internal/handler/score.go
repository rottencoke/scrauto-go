package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"scrauto/server/internal/middleware"
	"scrauto/server/internal/model"
	"scrauto/server/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ScoreHandler struct {
	Store     *repository.Store
	UploadDir string
}

var allowedMimes = map[string]bool{
	"application/pdf": true,
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"image/gif":       true,
}

func (h *ScoreHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	scores, err := h.Store.ListScores(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list scores"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"scores": scores})
}

func (h *ScoreHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	title := strings.TrimSpace(c.PostForm("title"))
	if title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
		return
	}
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to open file"})
		return
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	mime := http.DetectContentType(buf[:n])
	if !allowedMimes[mime] {
		// some browsers send application/octet-stream for pdf; check extension
		ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
		switch ext {
		case ".pdf":
			mime = "application/pdf"
		case ".jpg", ".jpeg":
			mime = "image/jpeg"
		case ".png":
			mime = "image/png"
		case ".webp":
			mime = "image/webp"
		case ".gif":
			mime = "image/gif"
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported file type"})
			return
		}
	}
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read file"})
		return
	}

	if err := os.MkdirAll(h.UploadDir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare upload dir"})
		return
	}

	ext := filepath.Ext(fileHeader.Filename)
	storedName := fmt.Sprintf("%d_%s%s", userID, uuid.NewString(), ext)
	destPath := filepath.Join(h.UploadDir, storedName)
	dst, err := os.Create(destPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, src); err != nil {
		_ = os.Remove(destPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	speed := 40.0
	if v := c.PostForm("scroll_speed"); v != "" {
		if parsed, err := strconv.ParseFloat(v, 64); err == nil && parsed > 0 {
			speed = parsed
		}
	}

	var folderID *uint
	if v := strings.TrimSpace(c.PostForm("folder_id")); v != "" {
		id, err := parseID(v)
		if err != nil {
			_ = os.Remove(destPath)
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid folder_id"})
			return
		}
		if _, err := h.Store.FindFolder(userID, id); err != nil {
			_ = os.Remove(destPath)
			c.JSON(http.StatusBadRequest, gin.H{"error": "folder not found"})
			return
		}
		folderID = &id
	}

	score := &model.Score{
		UserID:       userID,
		FolderID:     folderID,
		Title:        title,
		FilePath:     storedName,
		MimeType:     mime,
		OriginalName: fileHeader.Filename,
		ScrollSpeed:  speed,
	}
	if err := h.Store.CreateScore(score); err != nil {
		_ = os.Remove(destPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create score"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"score": score})
}

func (h *ScoreHandler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	score, err := h.Store.FindScore(userID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"score": score})
}

func (h *ScoreHandler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	score, err := h.Store.FindScore(userID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	var body struct {
		Title       *string  `json:"title"`
		ScrollSpeed *float64 `json:"scroll_speed"`
		FolderID    *uint    `json:"folder_id"`
		ClearFolder bool     `json:"clear_folder"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if body.Title != nil {
		title := strings.TrimSpace(*body.Title)
		if title == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "title is required"})
			return
		}
		score.Title = title
	}
	if body.ScrollSpeed != nil {
		if *body.ScrollSpeed <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "scroll_speed must be positive"})
			return
		}
		score.ScrollSpeed = *body.ScrollSpeed
	}
	folderChanged := false
	if body.ClearFolder {
		score.FolderID = nil
		folderChanged = true
	} else if body.FolderID != nil {
		if _, err := h.Store.FindFolder(userID, *body.FolderID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "folder not found"})
			return
		}
		score.FolderID = body.FolderID
		folderChanged = true
	}
	score.UpdatedAt = time.Now()
	if err := h.Store.UpdateScore(score); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
		return
	}
	if folderChanged {
		if err := h.Store.SetScoreFolder(score, score.FolderID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"score": score})
}

func (h *ScoreHandler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	score, err := h.Store.FindScore(userID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	_ = os.Remove(filepath.Join(h.UploadDir, score.FilePath))
	if err := h.Store.DeleteScore(score); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *ScoreHandler) File(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := parseID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	score, err := h.Store.FindScore(userID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	path := filepath.Join(h.UploadDir, score.FilePath)
	c.Header("Content-Type", score.MimeType)
	c.File(path)
}

func parseID(raw string) (uint, error) {
	n, err := strconv.ParseUint(raw, 10, 64)
	return uint(n), err
}
