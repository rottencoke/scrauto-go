package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"scrauto/server/internal/config"
	"scrauto/server/internal/handler"
	"scrauto/server/internal/middleware"
	"scrauto/server/internal/model"
	"scrauto/server/internal/repository"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()

	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatalf("upload dir: %v", err)
	}

	db, err := connectDB(cfg.DBDSN)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Score{}); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	store := &repository.Store{DB: db}
	authHandler := &handler.AuthHandler{Store: store, JWTSecret: cfg.JWTSecret}
	scoreHandler := &handler.ScoreHandler{Store: store, UploadDir: cfg.UploadDir}

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.CORSOrigin},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	{
		api.POST("/auth/signup", authHandler.Signup)
		api.POST("/auth/login", authHandler.Login)
		api.POST("/auth/logout", authHandler.Logout)

		auth := api.Group("")
		auth.Use(middleware.Auth(cfg.JWTSecret))
		{
			auth.GET("/auth/me", authHandler.Me)
			auth.GET("/scores", scoreHandler.List)
			auth.POST("/scores", scoreHandler.Create)
			auth.GET("/scores/:id", scoreHandler.Get)
			auth.PATCH("/scores/:id", scoreHandler.Update)
			auth.DELETE("/scores/:id", scoreHandler.Delete)
			auth.GET("/scores/:id/file", scoreHandler.File)
		}
	}

	addr := fmt.Sprintf(":%s", cfg.ServerPort)
	log.Printf("listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}

func connectDB(dsn string) (*gorm.DB, error) {
	var db *gorm.DB
	var err error
	for i := 0; i < 30; i++ {
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
		if err == nil {
			sqlDB, pingErr := db.DB()
			if pingErr == nil && sqlDB.Ping() == nil {
				return db, nil
			}
			err = pingErr
		}
		log.Printf("waiting for mysql... (%d/30): %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	return nil, err
}
