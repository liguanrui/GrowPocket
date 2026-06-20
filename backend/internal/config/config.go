package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port        string
	DBPath      string
	UploadDir   string
	JWTSecret   string
	JWTDuration int // 单位：小时
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DBPath:      getEnv("DB_PATH", "./data/growpocket.db"),
		UploadDir:   getEnv("UPLOAD_DIR", "./uploads"),
		JWTSecret:   getEnv("JWT_SECRET", "growpocket-secret-key-change-in-production"),
		JWTDuration: getEnvInt("JWT_DURATION_HOUR", 2),
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
