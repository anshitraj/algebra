// Package wiring constructs every application service exactly once from
// configuration, and is called by BOTH cmd/api and cmd/mcp. This is what
// makes "REST and MCP share the same domain logic" (mandate §53) a
// structural fact rather than a convention two entrypoints could drift
// apart on — there is only one place a service gets `new`'d.
package wiring

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/project-algebra/algebra/internal/app"
	"github.com/project-algebra/algebra/internal/domain/confidential"
	"github.com/project-algebra/algebra/internal/domain/merchant"
	"github.com/project-algebra/algebra/internal/domain/policy"
	"github.com/project-algebra/algebra/internal/domain/privacy"
	"github.com/project-algebra/algebra/internal/platform/config"
	"github.com/project-algebra/algebra/internal/platform/postgres"
	redisplatform "github.com/project-algebra/algebra/internal/platform/redis"
	"github.com/project-algebra/algebra/internal/platform/resilience"
	"github.com/project-algebra/algebra/providers/arcium"
	"github.com/project-algebra/algebra/providers/vault"
)

// Bundle is every long-lived, shared dependency a transport (REST or MCP)
// needs. Transports hold a *Bundle and never construct a service
// themselves.
type Bundle struct {
	DB *postgres.DB

	Agents      *postgres.AgentRepo
	AgentSvc    *app.AgentService
	Users       *app.UserService
	Intents     *app.IntentService
	Discovery   *app.DiscoveryService
	Quotes      *app.QuoteService
	Policy      *app.PolicyService
	Approvals   *app.ApprovalService
	Orders      *app.OrderService
	Payments    *app.PaymentService
	Privacy     *privacy.Resolver
	Connectors  *app.ConnectorRegistry
	Idempotency app.IdempotencyStore
	Audit       *postgres.AuditRepo

	// Redis is nil if REDIS_ADDR was unset or unreachable at startup —
	// every consumer (RateLimiter, Locker below) degrades gracefully when
	// nil rather than failing, per mandate §35's "Postgres remains
	// authoritative" principle applied to Redis too.
	Redis   *redisplatform.Client
	Limiter app.RateLimiter

	Webhooks *app.WebhookService
	AuditSvc *app.AuditService

	// Confidential is the optional confidential-compute provider (mandate
	// §26). It is always constructed with the LOCAL implementation (real
	// AES-256-GCM, no external dependency) so the abstraction is live
	// rather than dead code; swapping in providers/arcium.ArciumProvider
	// requires a real Arcium program/cluster, which no environment here
	// has.
	Confidential confidential.Provider
}

// Build connects to Postgres, runs migrations, registers every merchant
// connector this build ships, and constructs every application service.
// migrationsDir should point at the repo's migrations/ folder.
func Build(ctx context.Context, cfg *config.Config, migrationsDir string) (*Bundle, error) {
	db, err := postgres.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("wiring: connecting to postgres: %w", err)
	}
	if err := db.Migrate(ctx, migrationsDir); err != nil {
		db.Close()
		return nil, fmt.Errorf("wiring: running migrations: %w", err)
	}

	masterKey, err := cfg.MasterKey()
	if err != nil {
		db.Close()
		return nil, err
	}
	encryptor, err := privacy.NewAESGCMEncryptor(masterKey)
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("wiring: building encryptor: %w", err)
	}

	agents := postgres.NewAgentRepo(db)
	intents := postgres.NewIntentRepo(db)
	quotes := postgres.NewQuoteRepo(db)
	decisions := postgres.NewPolicyDecisionRepo(db)
	approvals := postgres.NewApprovalRepo(db)
	paymentSources := postgres.NewPaymentSourceRepo(db)
	orders := postgres.NewOrderRepo(db)
	auditRepo := postgres.NewAuditRepo(db)
	ledger := postgres.NewSpendLedgerRepo(db)
	idempotency := postgres.NewIdempotencyRepo(db)
	privacyRepo := postgres.NewPrivacyProfileRepo(db)
	users := postgres.NewUserRepo(db)

	connectors, err := buildConnectors(cfg.Merchants, encryptor)
	if err != nil {
		db.Close()
		return nil, err
	}
	warmConnectors(connectors)

	var policyProvider policy.Provider
	if cfg.OmniClawServerURL != "" {
		policyProvider = policy.NewOmniClawProvider(cfg.OmniClawServerURL, cfg.OmniClawToken)
	} else {
		policyProvider = policy.NewLocalProvider(policy.DefaultRules())
	}

	cardVault := vault.NewSandboxProvider()

	privacyResolver := privacy.NewResolver(privacyRepo, encryptor, &postgres.ResolutionAuditSink{Logger: auditRepo, Now: time.Now})

	intentSvc := app.NewIntentService(intents, agents, auditRepo)
	discoverySvc := app.NewDiscoveryService(intents, agents, quotes, connectors, auditRepo, cfg.QuoteTTL)
	discoverySvc.SetResilience(resilience.NewRegistry(5, 30*time.Second), cfg.Merchants.WithDefaults().ConnectorTimeout)
	discoverySvc.SetURLAllowlist(merchant.NewAllowedDomains(cfg.MerchantURLAllowlist...))
	quoteSvc := app.NewQuoteService(intents, agents, quotes, connectors)
	policySvc := app.NewPolicyService(intents, agents, quotes, decisions, approvals, ledger, policyProvider, auditRepo, cfg.ApprovalTTL)
	approvalSvc := app.NewApprovalService(intents, approvals, quoteSvc, auditRepo)
	orderSvc := app.NewOrderService(intents, agents, approvals, orders, quoteSvc, connectors, policyProvider, ledger, auditRepo, cfg.QuoteAmountToleranceMinorUnits)
	// The privacy resolver is what turns "shipping:home" into a real
	// address, once, inside a checkout call — without this line the whole
	// alias mechanism would be decorative (mandate §24).
	orderSvc.SetPrivacyResolver(privacyResolver)
	paymentSvc := app.NewPaymentService(paymentSources, agents, cardVault)
	agentSvc := app.NewAgentService(agents)
	userSvc := app.NewUserService(users)
	webhookSvc := app.NewWebhookService(postgres.NewWebhookRepo(db), auditRepo, envWebhookSecret)
	auditSvc := app.NewAuditService(auditRepo, agents)
	confidentialProvider := arcium.NewLocalEncryptedProvider(encryptor)

	// Redis is optional (mandate §35) — a missing or unreachable REDIS_ADDR
	// degrades to "no rate limiting, no fast-fail lock" rather than
	// preventing startup. Postgres already provides the real correctness
	// guarantees (approvals.MarkConsumed) that don't depend on this.
	var redisClient *redisplatform.Client
	var limiter app.RateLimiter
	if cfg.RedisAddr != "" {
		rc, err := redisplatform.Connect(ctx, cfg.RedisAddr)
		if err != nil {
			log.Printf("wiring: Redis unavailable at %q, continuing without rate limiting/locks: %v", cfg.RedisAddr, err)
		} else {
			redisClient = rc
			limiter = rc
			orderSvc.SetLocker(rc)
		}
	}

	return &Bundle{
		DB: db, Agents: agents, AgentSvc: agentSvc, Users: userSvc, Intents: intentSvc, Discovery: discoverySvc, Quotes: quoteSvc,
		Policy: policySvc, Approvals: approvalSvc, Orders: orderSvc, Payments: paymentSvc,
		Privacy: privacyResolver, Connectors: connectors, Idempotency: idempotency, Audit: auditRepo,
		Redis: redisClient, Limiter: limiter,
		Webhooks: webhookSvc, AuditSvc: auditSvc, Confidential: confidentialProvider,
	}, nil
}

// envWebhookSecret looks up WEBHOOK_SECRET_<PROVIDER> (uppercased). No real
// webhook-sending provider is configured in this environment, so every
// lookup returns "" today — see app.WebhookService.Receive, which rejects
// any provider with no configured secret rather than accepting it
// unverified.
func envWebhookSecret(provider string) string {
	return os.Getenv("WEBHOOK_SECRET_" + strings.ToUpper(provider))
}
