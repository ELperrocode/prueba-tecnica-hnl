package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/henry/banca-online/internal/config"
	"github.com/henry/banca-online/internal/handlers"
	"github.com/henry/banca-online/internal/mcp"
	"github.com/henry/banca-online/internal/middleware"
	"github.com/henry/banca-online/internal/models"
	"github.com/henry/banca-online/internal/services"
	tbclient "github.com/henry/banca-online/internal/tigerbeetle"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to PostgreSQL with retry
	log.Println("Connecting to PostgreSQL...")
	var db *gorm.DB
	var err error
	for i := 0; i < 30; i++ {
		db, err = gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Warn),
		})
		if err == nil {
			break
		}
		log.Printf("Waiting for PostgreSQL... attempt %d/30: %v", i+1, err)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	log.Println("Connected to PostgreSQL")

	// Auto-migrate tables
	if err := db.AutoMigrate(&models.User{}, &models.UserAccount{}); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database migrated")

	// Connect to TigerBeetle
	log.Println("Connecting to TigerBeetle...")
	tb, err := tbclient.NewClient(cfg.TigerBeetleAddr)
	if err != nil {
		log.Fatalf("Failed to connect to TigerBeetle: %v", err)
	}
	defer tb.Close()
	log.Println("Connected to TigerBeetle")

	// Seed database (must run before creating operator account normally,
	// because seeding uses imported accounts/transfers with user-provided timestamps).
	if err := seedDatabase(db, tb); err != nil {
		log.Printf("Seed error (non-fatal): %v", err)
	}

	// Create operator account (no-op if seed already created and closed it)
	if err := tb.CreateOperatorAccount(); err != nil {
		log.Printf("Operator account note: %v", err)
	}

	// Initialize services
	// Note: accountSvc must be created before authSvc because Register creates an account.
	accountSvc := services.NewAccountService(db, tb)
	authSvc := services.NewAuthService(db, cfg, accountSvc)
	txnSvc := services.NewTransactionService(db, tb, accountSvc)

	// Initialize MCP tool registry
	toolRegistry := mcp.NewToolRegistry(accountSvc, txnSvc)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authSvc)
	accountHandler := handlers.NewAccountHandler(accountSvc)
	txnHandler := handlers.NewTransactionHandler(txnSvc)
	chatHandler := handlers.NewChatHandler(toolRegistry, accountSvc, cfg)

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(chimw.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3001", "http://frontend:5173", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Public routes
	r.Route("/api/auth", func(r chi.Router) {
		r.With(middleware.RateLimit(5, time.Minute)).Post("/register", authHandler.Register)
		r.With(middleware.RateLimit(10, time.Minute)).Post("/login", authHandler.Login)
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(authSvc))

		r.Post("/api/auth/logout", authHandler.Logout)
		r.Get("/api/auth/me", authHandler.Me)

		r.Get("/api/accounts", accountHandler.ListAccounts)
		r.Get("/api/accounts/{accountNumber}", accountHandler.GetAccount)

		r.With(middleware.RateLimit(30, time.Minute)).Post("/api/transactions/deposit", txnHandler.Deposit)
		r.With(middleware.RateLimit(30, time.Minute)).Post("/api/transactions/withdraw", txnHandler.Withdraw)
		r.With(middleware.RateLimit(30, time.Minute)).Post("/api/transactions/transfer", txnHandler.Transfer)
		r.Get("/api/transactions", txnHandler.History)
		r.Get("/api/transactions/export", txnHandler.Export)

		r.With(middleware.RateLimit(20, time.Minute)).Post("/api/chat", chatHandler.Chat)
	})

	// Start server
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
