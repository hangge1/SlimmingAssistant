package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"resetlife/server/internal/auth"
	"resetlife/server/internal/config"
	"resetlife/server/internal/httpserver"
	"resetlife/server/internal/reminders"
	"resetlife/server/internal/settings"
	"resetlife/server/internal/slimming"
	storagesqlite "resetlife/server/internal/storage/sqlite"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	cfg := config.Load()
	db, err := storagesqlite.Open(context.Background(), cfg.DBPath)
	if err != nil {
		logger.Error("open sqlite database failed", "path", cfg.DBPath, "error", err)
		os.Exit(1)
	}
	defer db.Close()

	authRepository := storagesqlite.AuthRepository{DB: db}
	adminService := &auth.AdminService{Repository: authRepository}
	if err := adminService.EnsureDefaultAdmin(context.Background(), auth.EnsureDefaultAdminInput{
		Username:    "admin",
		DisplayName: "管理员",
		Password:    "admin123456",
	}); err != nil {
		logger.Error("ensure default admin failed", "error", err)
		os.Exit(1)
	}

	settingsService := &settings.Service{
		Repository: storagesqlite.SettingsRepository{DB: db},
	}
	handler := httpserver.NewRouter(httpserver.RouterConfig{
		Logger:                logger,
		AuthResolver:          &auth.Resolver{Repository: authRepository},
		LoginService:          &auth.LoginService{Repository: authRepository},
		AdminService:          adminService,
		InternalReminderToken: cfg.InternalReminderToken,
		StaticDir:             cfg.StaticDir,
		SlimmingService: &slimming.Service{
			Repository: storagesqlite.SlimmingRepository{DB: db},
		},
		SettingsService: settingsService,
		ReminderService: &reminders.Service{
			Repository:      storagesqlite.RemindersRepository{DB: db},
			SettingsService: settingsService,
		},
	})

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("starting api server", "addr", cfg.Addr, "data_dir", cfg.DataDir, "db_path", cfg.DBPath, "static_dir", cfg.StaticDir)
		errCh <- server.ListenAndServe()
	}()

	stopCh := make(chan os.Signal, 1)
	signal.Notify(stopCh, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("api server stopped unexpectedly", "error", err)
			os.Exit(1)
		}
	case signal := <-stopCh:
		logger.Info("shutdown signal received", "signal", signal.String())
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			logger.Error("api server shutdown failed", "error", err)
			os.Exit(1)
		}
	}

	logger.Info("api server stopped")
}
