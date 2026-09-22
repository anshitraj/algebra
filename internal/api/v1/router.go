// Package v1 is Algebra's REST transport. Like internal/mcpserver, every
// handler here is thin: parse the request, call exactly one
// internal/app service method, encode the result. It shares the same
// wiring.Bundle as the MCP server — see internal/platform/wiring — so
// there is exactly one implementation of every commerce rule regardless of
// which transport an integration uses (mandate §53).
package v1

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/project-algebra/algebra/internal/app"
	"github.com/project-algebra/algebra/internal/domain/agent"
	"github.com/project-algebra/algebra/internal/domain/integrator"
	"github.com/project-algebra/algebra/internal/domain/shared"
	"github.com/project-algebra/algebra/internal/platform/wiring"
)

type API struct {
	b       *wiring.Bundle
	limiter app.RateLimiter // optional — see app.RateLimiter's doc comment
}

// NewRouter builds the versioned REST API on Go's standard-library
// ServeMux (method+path patterns, no external router dependency needed).
// limiter may be nil (no Redis configured) — see rateLimitMiddleware.
// allowedOrigins is the browser-frontend CORS allow-list — see corsMiddleware.
func NewRouter(b *wiring.Bundle, limiter app.RateLimiter, allowedOrigins []string) http.Handler {
	api := &API{b: b, limiter: limiter}
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/v1/users", api.createUser)

	mux.HandleFunc("POST /api/v1/agents", api.createAgent)
	mux.HandleFunc("POST /api/v1/agents/{id}/revoke", api.revokeAgent)

	mux.HandleFunc("POST /api/v1/integrators", api.createIntegrator)
	mux.HandleFunc("POST /api/v1/integrators/{id}/revoke", api.revokeIntegrator)
	mux.HandleFunc("POST /api/v1/policy/evaluate-transaction", api.evaluateTransaction)

	mux.HandleFunc("POST /api/v1/intents", api.createIntent)
	mux.HandleFunc("GET /api/v1/intents/{id}", api.getIntent)
	mux.HandleFunc("POST /api/v1/intents/{id}/cancel", api.cancelIntent)
	mux.HandleFunc("POST /api/v1/intents/{id}/discover", api.discover)
	mux.HandleFunc("GET /api/v1/intents/{id}/quotes", api.getQuotes)
	mux.HandleFunc("POST /api/v1/intents/{id}/select-quote", api.selectQuote)
	mux.HandleFunc("POST /api/v1/intents/{id}/request-purchase", api.requestPurchase)
	mux.HandleFunc("GET /api/v1/intents/{id}/policy-preview", api.policyPreview)
	mux.HandleFunc("GET /api/v1/intents/{id}/policy-explain", api.policyExplain)
	mux.HandleFunc("POST /api/v1/intents/{id}/execute", api.execute)
	mux.HandleFunc("GET /api/v1/intents/{id}/order", api.getOrder)
	mux.HandleFunc("GET /api/v1/intents/{id}/receipt", api.getReceipt)
	mux.HandleFunc("POST /api/v1/intents/{id}/complete-authentication", api.completeAuthentication)
	mux.HandleFunc("POST /api/v1/intents/{id}/cancel-order", api.cancelOrder)
	mux.HandleFunc("GET /api/v1/intents/{id}/audit", api.getAuditTrail)

	mux.HandleFunc("GET /api/v1/intents/{id}/approval", api.getApprovalForIntent)
	mux.HandleFunc("POST /api/v1/approvals/{id}/approve", api.approveApproval)
	mux.HandleFunc("POST /api/v1/approvals/{id}/reject", api.rejectApproval)
	mux.HandleFunc("POST /api/v1/approvals/{id}/reapprove", api.reapproveApproval)

	mux.HandleFunc("GET /api/v1/payment-sources", api.listPaymentSources)
	mux.HandleFunc("POST /api/v1/payment-sources", api.addPaymentSource)
	mux.HandleFunc("POST /api/v1/payment-sources/{id}/revoke", api.revokePaymentSource)

	mux.HandleFunc("GET /api/v1/merchants", api.listMerchants)

	mux.HandleFunc("POST /api/v1/profiles/shipping", api.createShippingProfile)
	mux.HandleFunc("POST /api/v1/profiles/billing", api.createBillingProfile)
	mux.HandleFunc("GET /api/v1/profiles/shipping", api.listShippingAliases)

	mux.HandleFunc("POST /api/v1/webhooks/{provider}", api.receiveWebhook)

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	return corsMiddleware(allowedOrigins, api.rateLimitMiddleware(mux))
}

// corsMiddleware is the outermost layer: an OPTIONS preflight is answered
// and returned before it ever reaches rate limiting or a handler, so a
// browser's preflight traffic never consumes a caller's request budget.
// allowedOrigins is matched exactly, never "*" — every origin-gated
// endpoint here accepts Authorization/X-User-ID, and the CORS spec disallows
// a wildcard origin alongside credentialed headers being meaningful anyway.
func corsMiddleware(allowedOrigins []string, next http.Handler) http.Handler {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID, Idempotency-Key")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// defaultRateLimit/defaultRateLimitWindow bound every caller (agent-token
// or, for unauthenticated endpoints, source IP) to a fixed request budget
// per window (mandate §49). This is a blunt, uniform limit rather than
// per-endpoint tuning — appropriate for a control plane whose expensive
// operations (discovery fan-out, execution) already carry their own
// resource cost, not a substitute for it.
const (
	defaultRateLimit       = 120
	defaultRateLimitWindow = time.Minute
)

// rateLimitMiddleware is a no-op when limiter is nil (Redis not
// configured — acceptable for local development, not for production; see
// docs/LOCAL_DEVELOPMENT.md). When a Redis error occurs — as opposed to a
// clean "over limit" answer — it fails OPEN (allows the request through):
// a cache-layer outage must not cascade into a full API outage over a
// defense-in-depth control that isn't the primary authorization boundary.
func (a *API) rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if a.limiter == nil {
			next.ServeHTTP(w, r)
			return
		}
		allowed, retryAfter, err := a.limiter.Allow(r.Context(), "ratelimit:"+rateLimitKey(r), defaultRateLimit, defaultRateLimitWindow)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}
		if !allowed {
			w.Header().Set("Retry-After", formatSeconds(retryAfter))
			writeJSON(w, http.StatusTooManyRequests, errorBody{Error: "rate limit exceeded, retry later"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// rateLimitKey identifies the caller: the agent token's hash when present
// (never the raw token — this becomes part of a Redis key), otherwise the
// remote IP for unauthenticated endpoints (POST /users, POST /agents,
// GET /merchants).
func rateLimitKey(r *http.Request) string {
	if authz := r.Header.Get("Authorization"); strings.HasPrefix(authz, "Bearer ") {
		return "agent:" + agent.HashToken(strings.TrimPrefix(authz, "Bearer "))
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil || host == "" {
		host = r.RemoteAddr
	}
	return "ip:" + host
}

func formatSeconds(d time.Duration) string {
	secs := int64(d / time.Second)
	if secs < 1 {
		secs = 1
	}
	return strconv.FormatInt(secs, 10)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

type errorBody struct {
	Error string `json:"error"`
}

// writeError maps a domain sentinel error to the right HTTP status. Never
// includes the raw error's internal detail beyond its message text — none
// of Algebra's error paths embed secrets in error strings, but this is the
// single choke point where that would be caught/fixed if one ever did.
func writeError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, shared.ErrNotFound):
		status = http.StatusNotFound
	case errors.Is(err, shared.ErrUnauthorized):
		status = http.StatusForbidden
	case errors.Is(err, shared.ErrConflict):
		status = http.StatusConflict
	case errors.Is(err, shared.ErrNotImplemented):
		status = http.StatusNotImplemented
	}
	writeJSON(w, status, errorBody{Error: err.Error()})
}

func decodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// resolveAgent extracts and validates the bearer agent token from the
// Authorization header — the same token mechanism internal/mcpserver uses,
// so an agent's identity means the same thing on both transports.
func (a *API) resolveAgent(r *http.Request) (*agent.Identity, error) {
	authz := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(authz) <= len(prefix) || authz[:len(prefix)] != prefix {
		return nil, errors.New("missing or malformed Authorization: Bearer <agent_token> header")
	}
	token := authz[len(prefix):]
	ag, err := a.b.Agents.GetByTokenHash(r.Context(), agent.HashToken(token))
	if err != nil {
		return nil, errors.New("invalid agent token")
	}
	if ag.IsRevoked() {
		return nil, errors.New("agent token has been revoked")
	}
	return ag, nil
}

// resolveIntegrator is resolveAgent's counterpart for the standalone
// policy-evaluation surface — a third-party integrator's bearer token,
// checked the same way (hashed lookup + revocation), never an
// agent/shopping-permission token used interchangeably with one.
func (a *API) resolveIntegrator(r *http.Request) (*integrator.Integrator, error) {
	authz := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(authz) <= len(prefix) || authz[:len(prefix)] != prefix {
		return nil, errors.New("missing or malformed Authorization: Bearer <integrator_token> header")
	}
	token := authz[len(prefix):]
	integ, err := a.b.Integrators.GetByTokenHash(r.Context(), agent.HashToken(token))
	if err != nil {
		return nil, errors.New("invalid integrator token")
	}
	if integ.IsRevoked() {
		return nil, errors.New("integrator token has been revoked")
	}
	return integ, nil
}

// currentUserID is a DEV-MODE PLACEHOLDER for the human-only endpoints
// (approvals, payment sources, privacy profiles). Production requires a
// real authenticated user session (OIDC/OAuth, mandate §46) — that needs an
// identity provider's client credentials, which do not exist in this
// environment. Until that's wired up, the caller asserts their own user ID
// via this header; this is explicitly NOT a security boundary and must
// never be treated as one outside local development. See
// docs/LOCAL_DEVELOPMENT.md.
func currentUserID(r *http.Request) (string, error) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		return "", errors.New("missing X-User-ID header (dev-mode user identification; see docs/LOCAL_DEVELOPMENT.md)")
	}
	return userID, nil
}
