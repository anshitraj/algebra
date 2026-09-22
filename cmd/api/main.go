// Command api runs Algebra's versioned REST API (mandate §45), sharing the
// exact same application services as cmd/mcp via internal/platform/wiring.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	v1 "github.com/project-algebra/algebra/internal/api/v1"
	"github.com/project-algebra/algebra/internal/platform/config"
	"github.com/project-algebra/algebra/internal/platform/logging"
	"github.com/project-algebra/algebra/internal/platform/wiring"
)

func main() {
	logger := logging.New(os.Stdout, slog.LevelInfo)

	cfg, err := config.FromEnv()
	if err != nil {
		logger.Error("loading config", "error", err)
		os.Exit(1)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	bundle, err := wiring.Build(ctx, cfg, "migrations")
	if err != nil {
		logger.Error("building application", "error", err)
		os.Exit(1)
	}
	defer bundle.DB.Close()

	handler := v1.NewRouter(bundle, bundle.Limiter, cfg.CORSAllowedOrigins)
	server := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = server.Shutdown(shutdownCtx)
	}()

	logger.Info("algebra API listening", "addr", cfg.HTTPAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("server exited", "error", err)
		os.Exit(1)
	}
}
