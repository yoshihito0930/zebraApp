package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config はアプリケーション設定を保持する構造体
type Config struct {
	// サーバー設定
	ServerPort string

	// データベース設定
	DBHost      string
	DBPort      int
	DBUser      string
	DBPassword  string
	DBName      string
	DatabaseURL string

	// Redis設定
	RedisHost string
	RedisPort int

	// JWT設定
	JWTSecret string
}

// LoadConfig は環境変数から設定を読み込む
func LoadConfig() (*Config, error) {
	cfg := &Config{}

	// サーバー設定
	cfg.ServerPort = getEnv("SERVER_PORT", "8080")

	// データベース設定
	cfg.DBHost = getEnv("DB_HOST", "postgres")
	dbPort, _ := strconv.Atoi(getEnv("DB_PORT", "5432"))
	cfg.DBPort = dbPort
	cfg.DBUser = getEnv("DB_USER", "postgres")
	cfg.DBPassword = getEnv("DB_PASSWORD", "postgres")
	cfg.DBName = getEnv("DB_NAME", "zebradb")

	// Redis設定
	cfg.RedisHost = getEnv("REDIS_HOST", "redis")
	redisPort, _ := strconv.Atoi(getEnv("REDIS_PORT", "6379"))
	cfg.RedisPort = redisPort

	// JWT設定
	cfg.JWTSecret = getEnv("JWT_SECRET", "devjwtsecretkey")

	// データベースURL組み立て
	cfg.DatabaseURL = getEnv("DATABASE_URL",
		fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
			cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName))

	return cfg, nil
}

// getEnv は環境変数を取得し、設定されていない場合はデフォルト値を返す
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
