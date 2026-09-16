package policy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// OmniClawProvider is a real HTTP client for OmniClaw
// (https://www.omniclaw.ai, github.com/omnuron/omniclaw — vendored as a git
// submodule at third_party/omniclaw so the actual source, not a guess, is
// what this client was built against). OmniClaw is a financial policy
// engine and non-custodial payment router for agent buyers, covering two
// rails: `circle_transfer` (Circle Developer Wallet) and `x402` (paid HTTP
// endpoints / Gateway nanopayments). Its policy primitives are keyed on a
// wallet-address-or-URL "recipient" and a USDC decimal amount — there is no
// merchant name, INR amount, or product category anywhere in its model
// (confirmed by reading third_party/omniclaw/src/omniclaw/agent/policy.py
// and policy_schema.py directly: no category field exists in the strict
// Pydantic schema at all).
//
// Endpoints called here (all under /api/v1, verified against
// third_party/omniclaw/src/omniclaw/agent/routes.py):
//
//	GET  /health                     liveness
//	GET  /wallets                    the caller's wallet + its policy config (incl. confirm_threshold)
//	GET  /can-pay?recipient=...      is this recipient/rail allowed at all
//	POST /simulate                   dry-run: would a payment of this amount succeed (limits, guards, rails)
//	POST /pay                        execute a payment (or, if amount >= confirm_threshold, register a
//	                                 pending confirmation instead of moving money)
//	POST /confirmations/{id}/approve accept a pending confirmation (owner-token gated on OmniClaw's side)
//	POST /confirmations/{id}/deny    reject a pending confirmation
//
// EvaluateMerchant/EvaluateAmount/EvaluatePaymentSource/EvaluateCategory
// operate on a single field OmniClaw doesn't have an equivalent lens for in
// isolation (merchant name, INR amount alone, an Algebra payment-source
// alias, or category), so each returns a descriptive error rather than a
// fabricated decision — only EvaluatePurchaseIntent/EvaluatePayment, which
// receive the full Input including CryptoRecipient/AmountUSDC, can produce
// a real OmniClaw-backed answer.
type OmniClawProvider struct {
	BaseURL string
	Token   string
	Client  *http.Client
}

// NewOmniClawProvider constructs a client. It performs no network I/O at
// construction time — call Health to verify connectivity.
func NewOmniClawProvider(baseURL, token string) *OmniClawProvider {
	return &OmniClawProvider{
		BaseURL: strings.TrimRight(baseURL, "/"),
		Token:   token,
		Client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *OmniClawProvider) Version() string { return "omniclaw-live-v1" }

// --- wire types, mirroring third_party/omniclaw/src/omniclaw/agent/models.py exactly ---

type omniclawHealthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

type omniclawCanPayResponse struct {
	CanPay bool    `json:"can_pay"`
	Reason *string `json:"reason"`
}

type omniclawSimulateRequest struct {
	Recipient  string  `json:"recipient"`
	Amount     *string `json:"amount,omitempty"`
	CheckTrust bool    `json:"check_trust"`
	SkipGuards bool    `json:"skip_guards"`
	Method     string  `json:"method"`
}

type omniclawSimulateResponse struct {
	WouldSucceed        bool     `json:"would_succeed"`
	Route               string   `json:"route"`
	Reason              *string  `json:"reason"`
	GuardsThatWouldPass []string `json:"guards_that_would_pass"`
}

type omniclawPayRequest struct {
	Recipient      string  `json:"recipient"`
	Amount         *string `json:"amount,omitempty"`
	Purpose        *string `json:"purpose,omitempty"`
	IdempotencyKey *string `json:"idempotency_key,omitempty"`
}

type omniclawPayResponse struct {
	Success              bool    `json:"success"`
	TransactionID        *string `json:"transaction_id"`
	BlockchainTx         *string `json:"blockchain_tx"`
	Amount               string  `json:"amount"`
	Recipient            string  `json:"recipient"`
	Status               string  `json:"status"`
	Method               string  `json:"method"`
	Error                *string `json:"error"`
	RequiresConfirmation bool    `json:"requires_confirmation"`
	ConfirmationID       *string `json:"confirmation_id"`
}

type omniclawWalletInfo struct {
	Alias       string         `json:"alias"`
	WalletID    string         `json:"wallet_id"`
	Address     string         `json:"address"`
	FundAddress *string        `json:"fund_address"`
	Policy      map[string]any `json:"policy"`
}

type omniclawListWalletsResponse struct {
	Wallets []omniclawWalletInfo `json:"wallets"`
}

// --- transport ---

func (p *OmniClawProvider) request(ctx context.Context, method, path string, query url.Values, body any, out any) error {
	if p.BaseURL == "" || p.Token == "" {
		return fmt.Errorf("omniclaw: OMNICLAW_SERVER_URL and OMNICLAW_TOKEN must both be set")
	}
	full := p.BaseURL + "/api/v1" + path
	if len(query) > 0 {
		full += "?" + query.Encode()
	}

	var bodyReader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("omniclaw: encoding request body: %w", err)
		}
		bodyReader = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, full, bodyReader)
	if err != nil {
		return fmt.Errorf("omniclaw: building request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+p.Token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := p.Client.Do(req)
	if err != nil {
		return fmt.Errorf("omniclaw: calling %s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("omniclaw: reading response from %s: %w", path, err)
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("omniclaw: %s %s returned HTTP %d: %s", method, path, resp.StatusCode, string(respBody))
	}
	if out != nil {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("omniclaw: decoding response from %s: %w", path, err)
		}
	}
	return nil
}

// Health calls GET /api/v1/health to verify connectivity and auth.
func (p *OmniClawProvider) Health(ctx context.Context) error {
	var out omniclawHealthResponse
	if err := p.request(ctx, http.MethodGet, "/health", nil, nil, &out); err != nil {
		return err
	}
	if out.Status != "ok" {
		return fmt.Errorf("omniclaw: health check returned status %q", out.Status)
	}
	return nil
}

func (p *OmniClawProvider) canPay(ctx context.Context, recipient string) (*omniclawCanPayResponse, error) {
	var out omniclawCanPayResponse
	q := url.Values{"recipient": {recipient}}
	if err := p.request(ctx, http.MethodGet, "/can-pay", q, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (p *OmniClawProvider) simulate(ctx context.Context, recipient, amountUSDC string) (*omniclawSimulateResponse, error) {
	req := omniclawSimulateRequest{Recipient: recipient, Method: "GET"}
	if amountUSDC != "" {
		req.Amount = &amountUSDC
	}
	var out omniclawSimulateResponse
	if err := p.request(ctx, http.MethodPost, "/simulate", nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// Pay calls POST /api/v1/pay — a REAL, side-effecting call: it either moves
// money over a rail OmniClaw controls, or (if the amount is at/above the
// wallet's confirm_threshold) registers a pending confirmation and returns
// requires_confirmation=true without moving anything. It is exported for
// use by a future crypto-rail execution path in OrderService; nothing in
// this codebase calls it yet (see docs/PAYMENT_SECURITY.md).
func (p *OmniClawProvider) Pay(ctx context.Context, recipient, amountUSDC, purpose, idempotencyKey string) (*omniclawPayResponse, error) {
	req := omniclawPayRequest{Recipient: recipient}
	if amountUSDC != "" {
		req.Amount = &amountUSDC
	}
	if purpose != "" {
		req.Purpose = &purpose
	}
	if idempotencyKey != "" {
		req.IdempotencyKey = &idempotencyKey
	}
	var out omniclawPayResponse
	if err := p.request(ctx, http.MethodPost, "/pay", nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ApproveConfirmation / DenyConfirmation call OmniClaw's own approval gate
// (POST /confirmations/{id}/approve|deny) — OmniClaw requires its
// OMNICLAW_OWNER_TOKEN header for these, which this client does not hold
// (Algebra's own Approval/ApprovalService is the system of record for user
// approval; these exist so a crypto-rail confirmation raised by /pay can be
// resolved once Algebra's own approval is granted, not as a second,
// independent approval UI).
func (p *OmniClawProvider) ApproveConfirmation(ctx context.Context, confirmationID string) error {
	return p.request(ctx, http.MethodPost, "/confirmations/"+url.PathEscape(confirmationID)+"/approve", nil, nil, nil)
}

func (p *OmniClawProvider) DenyConfirmation(ctx context.Context, confirmationID string) error {
	return p.request(ctx, http.MethodPost, "/confirmations/"+url.PathEscape(confirmationID)+"/deny", nil, nil, nil)
}

// confirmThresholdUSDC fetches the caller's wallet policy via GET /wallets
// and extracts confirm_threshold, if any is configured (globally or per
// wallet — OmniClaw merges these server-side and reflects the effective
// policy in Policy.to_dict(), which is what /wallets serializes).
func (p *OmniClawProvider) confirmThresholdUSDC(ctx context.Context) (string, bool) {
	var out omniclawListWalletsResponse
	if err := p.request(ctx, http.MethodGet, "/wallets", nil, nil, &out); err != nil {
		return "", false
	}
	if len(out.Wallets) == 0 {
		return "", false
	}
	raw, ok := out.Wallets[0].Policy["confirm_threshold"]
	if !ok || raw == nil {
		return "", false
	}
	switch v := raw.(type) {
	case string:
		return v, v != ""
	case float64:
		return fmt.Sprintf("%v", v), true
	default:
		return "", false
	}
}

// --- policy.Provider ---

func (p *OmniClawProvider) EvaluatePurchaseIntent(ctx context.Context, in Input) (*PolicyDecision, error) {
	if in.CryptoRecipient == "" || in.AmountUSDC == "" {
		return nil, fmt.Errorf("omniclaw: EvaluatePurchaseIntent requires Input.CryptoRecipient and Input.AmountUSDC — OmniClaw evaluates crypto payment rails (circle_transfer/x402) only, it has no merchant/category/INR concept (verified against third_party/omniclaw's policy schema)")
	}
	sim, err := p.simulate(ctx, in.CryptoRecipient, in.AmountUSDC)
	if err != nil {
		return nil, fmt.Errorf("omniclaw: EvaluatePurchaseIntent: %w", err)
	}
	if !sim.WouldSucceed {
		reason := "OMNICLAW_SIMULATION_FAILED"
		if sim.Reason != nil && *sim.Reason != "" {
			reason = *sim.Reason
		}
		return &PolicyDecision{Decision: Deny, ReasonCodes: []string{reason}, PolicyVersion: p.Version(), EvaluatedAt: time.Now().UTC()}, nil
	}

	if thresholdStr, ok := p.confirmThresholdUSDC(ctx); ok {
		exceeds, err := usdcAtOrAbove(in.AmountUSDC, thresholdStr)
		if err == nil && exceeds {
			return &PolicyDecision{
				Decision:            RequireApproval,
				ReasonCodes:         []string{"OMNICLAW_AMOUNT_AT_OR_ABOVE_CONFIRM_THRESHOLD"},
				PolicyVersion:       p.Version(),
				ApprovalRequirement: &ApprovalRequirement{Reason: "OmniClaw wallet policy requires confirmation at or above " + thresholdStr + " USDC"},
				EvaluatedAt:         time.Now().UTC(),
			}, nil
		}
	}

	return &PolicyDecision{Decision: Allow, ReasonCodes: []string{"OMNICLAW_SIMULATION_OK"}, PolicyVersion: p.Version(), EvaluatedAt: time.Now().UTC()}, nil
}

// EvaluatePayment is the execute-time re-check. It deliberately does NOT
// re-apply the confirm_threshold gate — see local_provider.go's
// evaluateHardAmountCaps doc comment for why re-demanding an approval a
// human already granted would make every above-threshold payment
// unexecutable. It only re-verifies the payment would still clear
// OmniClaw's limits/recipient/rail guards right now.
func (p *OmniClawProvider) EvaluatePayment(ctx context.Context, in Input) (*PolicyDecision, error) {
	if in.CryptoRecipient == "" || in.AmountUSDC == "" {
		return nil, fmt.Errorf("omniclaw: EvaluatePayment requires Input.CryptoRecipient and Input.AmountUSDC")
	}
	sim, err := p.simulate(ctx, in.CryptoRecipient, in.AmountUSDC)
	if err != nil {
		return nil, fmt.Errorf("omniclaw: EvaluatePayment: %w", err)
	}
	if !sim.WouldSucceed {
		reason := "OMNICLAW_SIMULATION_FAILED"
		if sim.Reason != nil && *sim.Reason != "" {
			reason = *sim.Reason
		}
		return &PolicyDecision{Decision: Deny, ReasonCodes: []string{reason}, PolicyVersion: p.Version(), EvaluatedAt: time.Now().UTC()}, nil
	}
	return &PolicyDecision{Decision: Allow, ReasonCodes: []string{"OMNICLAW_SIMULATION_OK"}, PolicyVersion: p.Version(), EvaluatedAt: time.Now().UTC()}, nil
}

// EvaluateMerchant maps onto OmniClaw's recipient/rail allow-list via
// GET /can-pay when the caller can supply a wallet-address-or-URL
// recipient. A bare merchant *name* (e.g. "zepto") has no OmniClaw
// equivalent — Algebra's own LocalProvider merchant allow-list handles
// that case.
func (p *OmniClawProvider) EvaluateMerchant(ctx context.Context, merchant string) (*PolicyDecision, error) {
	if !looksLikeOmniClawRecipient(merchant) {
		return nil, fmt.Errorf("omniclaw: EvaluateMerchant requires a wallet address or https:// URL, got %q — OmniClaw has no merchant-name concept, only recipient/domain allow-lists (see docs/MERCHANT_CONNECTORS.md)", merchant)
	}
	resp, err := p.canPay(ctx, merchant)
	if err != nil {
		return nil, fmt.Errorf("omniclaw: EvaluateMerchant: %w", err)
	}
	if !resp.CanPay {
		reason := "OMNICLAW_RECIPIENT_NOT_ALLOWED"
		if resp.Reason != nil && *resp.Reason != "" {
			reason = *resp.Reason
		}
		return &PolicyDecision{Decision: Deny, ReasonCodes: []string{reason}, PolicyVersion: p.Version(), EvaluatedAt: time.Now().UTC()}, nil
	}
	return &PolicyDecision{Decision: Allow, ReasonCodes: []string{"OMNICLAW_RECIPIENT_OK"}, PolicyVersion: p.Version(), EvaluatedAt: time.Now().UTC()}, nil
}

func (p *OmniClawProvider) EvaluateAmount(context.Context, int64, string, int64) (*PolicyDecision, error) {
	return nil, fmt.Errorf("omniclaw: EvaluateAmount is not meaningful in isolation — OmniClaw's limits are per-recipient (see EvaluatePurchaseIntent/EvaluatePayment, which take a full Input including CryptoRecipient/AmountUSDC)")
}

func (p *OmniClawProvider) EvaluateCategory(context.Context, string) (*PolicyDecision, error) {
	return nil, fmt.Errorf("omniclaw: EvaluateCategory is not supported — OmniClaw's policy schema has no category field (verified against third_party/omniclaw/src/omniclaw/agent/policy_schema.py)")
}

func (p *OmniClawProvider) EvaluatePaymentSource(context.Context, string) (*PolicyDecision, error) {
	return nil, fmt.Errorf("omniclaw: EvaluatePaymentSource is not applicable — OmniClaw resolves a wallet from the bearer token server-side, it does not accept an Algebra payment-source alias")
}

func looksLikeOmniClawRecipient(s string) bool {
	if strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") {
		return true
	}
	return strings.HasPrefix(s, "0x") && len(s) == 42
}

// usdcAtOrAbove compares two USDC decimal strings without importing a
// bignum/decimal package for one comparison — both values come from
// trusted internal sources (Algebra's own resolved amount, OmniClaw's own
// policy response), not user-supplied free text.
func usdcAtOrAbove(amount, threshold string) (bool, error) {
	a, err := parseUSDCMicros(amount)
	if err != nil {
		return false, err
	}
	t, err := parseUSDCMicros(threshold)
	if err != nil {
		return false, err
	}
	return a >= t, nil
}

// parseUSDCMicros parses a decimal USDC string (e.g. "10.50") into an
// integer count of micro-USDC (1e-6), giving exact comparisons without
// floating point.
func parseUSDCMicros(s string) (int64, error) {
	s = strings.TrimSpace(s)
	neg := false
	if strings.HasPrefix(s, "-") {
		neg = true
		s = s[1:]
	}
	whole, frac, _ := strings.Cut(s, ".")
	if whole == "" {
		whole = "0"
	}
	for len(frac) < 6 {
		frac += "0"
	}
	if len(frac) > 6 {
		frac = frac[:6]
	}
	var wholeVal, fracVal int64
	if _, err := fmt.Sscanf(whole, "%d", &wholeVal); err != nil {
		return 0, fmt.Errorf("omniclaw: invalid USDC amount %q: %w", s, err)
	}
	if frac != "" {
		if _, err := fmt.Sscanf(frac, "%d", &fracVal); err != nil {
			return 0, fmt.Errorf("omniclaw: invalid USDC amount %q: %w", s, err)
		}
	}
	total := wholeVal*1_000_000 + fracVal
	if neg {
		total = -total
	}
	return total, nil
}

// compile-time interface checks
var (
	_ Provider = (*LocalProvider)(nil)
	_ Provider = (*OmniClawProvider)(nil)
)
