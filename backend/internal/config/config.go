package config

import (
	"os"
	"time"
)

type Config struct {
	// Server
	Port string

	// PostgreSQL
	DatabaseURL string

	// TigerBeetle
	TigerBeetleAddr string

	// JWT
	JWTSecret     string
	JWTExpiration time.Duration

	// OpenRouter AI
	OpenRouterAPIKey string
	OpenRouterModel  string
}

func Load() *Config {
	return &Config{
		Port:             getEnv("PORT", "8080"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://postgres:postgres@postgres:5432/banca?sslmode=disable"),
		TigerBeetleAddr:  getEnv("TIGERBEETLE_ADDR", "tigerbeetle:3000"),
		JWTSecret:        getEnv("JWT_SECRET", "super-secret-key-change-in-production"),
		JWTExpiration:    24 * time.Hour,
		OpenRouterAPIKey: getEnv("OPENROUTER_API_KEY", ""),
		OpenRouterModel:  getEnv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
