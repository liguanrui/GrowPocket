package config

import (
	"log"
	"os"
	"strconv"
)

type Config struct {
	Port               string
	DBPath             string
	UploadDir          string
	JWTSecret          string
	JWTDuration        int // 单位：小时
	AIAPIKey           string
	AIModel            string
	AIBaseURL          string
	// 识图（多模态）专用；为空时回退到 AI_*。DeepSeek 文本模型不支持识图，需配置 qwen-vl / glm-4v / gpt-4o 等。
	VisionAPIKey       string
	VisionModel        string
	VisionBaseURL      string
	AdminJWTSecret     string
	AdminJWTExpireHour int
	AdminInitPassword  string
}

func Load() *Config {
	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		DBPath:             getEnv("DB_PATH", "./data/growpocket.db"),
		UploadDir:          getEnv("UPLOAD_DIR", "./uploads"),
		JWTSecret:          getEnv("JWT_SECRET", "growpocket-secret-key-change-in-production"),
		JWTDuration:        getEnvInt("JWT_DURATION_HOUR", 2),
		AIAPIKey:           getEnv("AI_API_KEY", ""),
		AIModel:            getEnv("AI_MODEL", "deepseek-chat"),
		AIBaseURL:          getEnv("AI_BASE_URL", "https://api.deepseek.com/v1"),
		VisionAPIKey:       getEnv("VISION_API_KEY", ""),
		VisionModel:        getEnv("VISION_MODEL", ""),
		VisionBaseURL:      getEnv("VISION_BASE_URL", ""),
		AdminJWTSecret:     getEnv("ADMIN_JWT_SECRET", "growpocket-admin-secret-change-in-production"),
		AdminJWTExpireHour: getEnvInt("ADMIN_JWT_EXPIRE_HOUR", 8),
		AdminInitPassword:  getEnv("ADMIN_INIT_PASSWORD", ""),
	}

	if cfg.AdminJWTSecret == "growpocket-admin-secret-change-in-production" {
		log.Printf("警告: ADMIN_JWT_SECRET 使用默认值，生产环境不安全，请设置环境变量")
	}

	return cfg
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
