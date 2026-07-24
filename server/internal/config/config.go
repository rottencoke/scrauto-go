package config

import (
	"os"
)

type Config struct {
	ServerPort string
	DBDSN      string
	JWTSecret  string
	CORSOrigin string
	UploadDir  string
}

func Load() Config {
	return Config{
		ServerPort: getEnv("SERVER_PORT", "8080"),
		DBDSN:      getEnv("DB_DSN", "scrauto:scrautopass@tcp(127.0.0.1:3306)/scrauto?charset=utf8mb4&parseTime=True&loc=Local"),
		JWTSecret:  getEnv("JWT_SECRET", "dev-secret"),
		CORSOrigin: getEnv("CORS_ORIGIN", "http://localhost:5173"),
		UploadDir:  getEnv("UPLOAD_DIR", "./uploads"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
