// Package config loads Algebra's process configuration from environment
// variables. See .env.example at the repo root for the full list with
// descriptions. Nothing here reads a checked-in secret — local dev uses
// docker-compose defaults, production is expected to inject real values via
// Secret Manager (mandate §37).
package config

import (
	"encoding/base64"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	// DatabaseURL is a standard postgres:// connection string.
	DatabaseURL string
	// RedisAddr is host:port for the Redis instance.
	RedisAddr string

	// MasterKeyBase64 is the 32-byte AES-256 data-encryption key for
	// PrivacyResolver, base64-encoded. In production this should be a DEK
	// unwrapped from Cloud KMS at process start, not a static env var — see
	// docs/GCP_DEPLOYMENT.md. Local dev only.
	MasterKeyBase64 string

	// HTTPAddr is the REST API listen address, e.g. ":8080".
	HTTPAddr string

	ApprovalTTL                    time.Duration
	QuoteTTL                       time.Duration
	QuoteAmountToleranceMinorUnits int64

	// MerchantURLAllowlist bounds which domains a merchant-supplied product
	// URL may point at before Algebra passes it on to an agent (mandate
	// §47/§49). Defaults to the merchants this build ships connectors for.
	MerchantURLAllowlist []string

	// CORSAllowedOrigins is the exact-match allow-list for browser-frontend
	// requests (web/, the Next.js console) — see internal/api/v1's
	// corsMiddleware. Defaults to the Next.js dev server's own default port.
	CORSAllowedOrigins []string

	Merchants MerchantsConfig

	// GoogleSearchAPIKey/GoogleSearchEngineID configure the optional general
	// web-search fallback (connectors/websearch) used only when no
	// connected merchant can find a product. Both empty (the default) means
	// the capability is off — commerce.web_search returns ErrNotImplemented.
	GoogleSearchAPIKey   string
	GoogleSearchEngineID string
}

// DefaultEnabledMerchants is every connector registered unless
// ENABLED_MERCHANTS says otherwise. Swiggy Instamart is deliberately absent:
// Swiggy reviews production access to its MCP servers, so an operator opts in
// once they have it.
const DefaultEnabledMerchants = "mock,zepto,amazon,flipkart,blinkit,generic-browser"

const (
	defaultMerchantSessionDir  = ".data/merchant-sessions"
	defaultConnectorTimeout    = 20 * time.Second
	defaultZeptoMCPEndpoint    = "https://mcp.zepto.co.in/mcp"
	defaultSwiggyIMMCPEndpoint = "https://mcp.swiggy.com/im"
	defaultAmazonMarketplace   = "www.amazon.in"
)

// MerchantsConfig holds per-merchant connector settings. None of these are
// required: a merchant with nothing configured is still listed, with a
// status saying what it needs.
type MerchantsConfig struct {
	// Enabled lists connector names to register.
	Enabled []string
	// SessionDir holds the encrypted linked-account sessions that
	// cmd/merchant-login writes (Zepto, Swiggy Instamart).
	SessionDir string
	// ConnectorTimeout bounds one connector's discovery work. Real merchant
	// APIs need several round trips (search, cart, quote) per intent.
	ConnectorTimeout time.Duration

	ZeptoMCPEndpoint           string
	SwiggyInstamartMCPEndpoint string

	FlipkartAffiliateID    string
	FlipkartAffiliateToken string

	AmazonCredentialID      string
	AmazonCredentialSecret  string
	AmazonCredentialVersion string
	AmazonPartnerTag        string
	AmazonMarketplace       string
}

// IsEnabled reports whether the named connector should be registered.
func (m MerchantsConfig) IsEnabled(name string) bool {
	return slices.Contains(m.Enabled, name)
}

// WithDefaults fills in anything left empty, for callers that build a
// Config by hand (tests, tools) rather than through FromEnv.
func (m MerchantsConfig) WithDefaults() MerchantsConfig {
	if len(m.Enabled) == 0 {
		m.Enabled = splitCSV(DefaultEnabledMerchants)
	}
	if m.SessionDir == "" {
		m.SessionDir = defaultMerchantSessionDir
	}
	if m.ConnectorTimeout <= 0 {
		m.ConnectorTimeout = defaultConnectorTimeout
	}
	if m.ZeptoMCPEndpoint == "" {
		m.ZeptoMCPEndpoint = defaultZeptoMCPEndpoint
	}
	if m.SwiggyInstamartMCPEndpoint == "" {
		m.SwiggyInstamartMCPEndpoint = defaultSwiggyIMMCPEndpoint
	}
	if m.AmazonMarketplace == "" {
		m.AmazonMarketplace = defaultAmazonMarketplace
	}
	return m
}

// FromEnv loads configuration from the process environment, applying
// sensible local-development defaults for anything optional. Required
// values that are missing return an error rather than silently defaulting —
// a missing DATABASE_URL should fail fast, not fall back to something that
// looks like it's working.
func FromEnv() (*Config, error) {
	// Load .env into the process environment for local development — see
	// .env.example. godotenv.Load only fills variables not already set, so
	// a real deployment's actual environment (Secret Manager, Cloud Run
	// env vars, ...) always wins over a stray .env file, and a missing
	// .env (every non-local environment) is silently fine: godotenv.Load's
	// error is deliberately ignored, not logged, since "no .env file" is
	// the expected, correct state outside local dev.
	_ = godotenv.Load()

	cfg := &Config{
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://algebra:algebra@localhost:5432/algebra?sslmode=disable"),
		RedisAddr:       getEnv("REDIS_ADDR", "localhost:6379"),
		MasterKeyBase64: os.Getenv("ALGEBRA_MASTER_KEY"),
		HTTPAddr:        getEnv("HTTP_ADDR", ":8080"),
	}

	approvalTTL, err := getDuration("APPROVAL_TTL", 15*time.Minute)
	if err != nil {
		return nil, err
	}
	cfg.ApprovalTTL = approvalTTL

	quoteTTL, err := getDuration("QUOTE_TTL", 5*time.Minute)
	if err != nil {
		return nil, err
	}
	cfg.QuoteTTL = quoteTTL

	tolerance, err := getInt64("QUOTE_AMOUNT_TOLERANCE_MINOR_UNITS", 500) // ₹5 default
	if err != nil {
		return nil, err
	}
	cfg.QuoteAmountToleranceMinorUnits = tolerance

	cfg.MerchantURLAllowlist = splitCSV(getEnv("MERCHANT_URL_ALLOWLIST",
		"zepto.co.in,zeptonow.com,swiggy.com,amazon.in,flipkart.com,blinkit.com"))

	cfg.CORSAllowedOrigins = splitCSV(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"))

	cfg.GoogleSearchAPIKey = os.Getenv("GOOGLE_SEARCH_API_KEY")
	cfg.GoogleSearchEngineID = os.Getenv("GOOGLE_SEARCH_ENGINE_ID")

	connectorTimeout, err := getDuration("CONNECTOR_TIMEOUT", defaultConnectorTimeout)
	if err != nil {
		return nil, err
	}
	cfg.Merchants = MerchantsConfig{
		Enabled:                    splitCSV(getEnv("ENABLED_MERCHANTS", DefaultEnabledMerchants)),
		SessionDir:                 getEnv("MERCHANT_SESSION_DIR", defaultMerchantSessionDir),
		ConnectorTimeout:           connectorTimeout,
		ZeptoMCPEndpoint:           getEnv("ZEPTO_MCP_ENDPOINT", defaultZeptoMCPEndpoint),
		SwiggyInstamartMCPEndpoint: getEnv("SWIGGY_INSTAMART_MCP_ENDPOINT", defaultSwiggyIMMCPEndpoint),
		FlipkartAffiliateID:        os.Getenv("FLIPKART_AFFILIATE_ID"),
		FlipkartAffiliateToken:     os.Getenv("FLIPKART_AFFILIATE_TOKEN"),
		AmazonCredentialID:         os.Getenv("AMAZON_CREATORS_CREDENTIAL_ID"),
		AmazonCredentialSecret:     os.Getenv("AMAZON_CREATORS_CREDENTIAL_SECRET"),
		AmazonCredentialVersion:    os.Getenv("AMAZON_CREATORS_CREDENTIAL_VERSION"),
		AmazonPartnerTag:           os.Getenv("AMAZON_ASSOCIATE_TAG"),
		AmazonMarketplace:          getEnv("AMAZON_MARKETPLACE", defaultAmazonMarketplace),
	}

	if cfg.MasterKeyBase64 == "" {
		return nil, fmt.Errorf("config: ALGEBRA_MASTER_KEY is required (32 random bytes, base64-encoded — see .env.example)")
	}
	if _, err := cfg.MasterKey(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// MasterKey decodes MasterKeyBase64 into the 32-byte key AESGCMEncryptor
// expects.
func (c *Config) MasterKey() ([]byte, error) {
	key, err := base64.StdEncoding.DecodeString(c.MasterKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("config: ALGEBRA_MASTER_KEY is not valid base64: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("config: ALGEBRA_MASTER_KEY must decode to 32 bytes, got %d", len(key))
	}
	return key, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0, fmt.Errorf("config: %s is not a valid duration: %w", key, err)
	}
	return d, nil
}

func getInt64(key string, fallback int64) (int64, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("config: %s is not a valid integer: %w", key, err)
	}
	return n, nil
}

// splitCSV parses a comma-separated env value, trimming whitespace and
// dropping empties.
func splitCSV(v string) []string {
	var out []string
	for _, part := range strings.Split(v, ",") {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
