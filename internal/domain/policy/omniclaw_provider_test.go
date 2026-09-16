package policy

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// fakeOmniClawServer stands in for a real OmniClaw agent server, replying
// with the exact response shapes captured from
// third_party/omniclaw/src/omniclaw/agent/{routes,models}.py. It lets the
// Go client be verified against the real, vendored wire contract without
// needing a live Python process (Docker/OmniClaw's own dependencies are not
// available in every environment this runs in).
type fakeOmniClawServer struct {
	t                *testing.T
	confirmThreshold string // "" = no threshold configured
	simulateOK       bool
	simulateReason   string
	canPayOK         bool
	canPayReason     string
	lastAuthHeader   string
	lastSimulateBody map[string]any
}

func (f *fakeOmniClawServer) start() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		f.lastAuthHeader = r.Header.Get("Authorization")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok", "version": "1.0.0"})
	})
	mux.HandleFunc("/api/v1/wallets", func(w http.ResponseWriter, r *http.Request) {
		policy := map[string]any{}
		if f.confirmThreshold != "" {
			policy["confirm_threshold"] = f.confirmThreshold
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"wallets": []map[string]any{
				{"alias": "primary", "wallet_id": "wallet_1", "address": "0xabc", "policy": policy},
			},
		})
	})
	mux.HandleFunc("/api/v1/can-pay", func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]any{"can_pay": f.canPayOK}
		if !f.canPayOK {
			resp["reason"] = f.canPayReason
		}
		_ = json.NewEncoder(w).Encode(resp)
	})
	mux.HandleFunc("/api/v1/simulate", func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		_ = json.NewDecoder(r.Body).Decode(&body)
		f.lastSimulateBody = body
		resp := map[string]any{"would_succeed": f.simulateOK, "route": "TRANSFER", "guards_that_would_pass": []string{}}
		if !f.simulateOK {
			resp["reason"] = f.simulateReason
		}
		_ = json.NewEncoder(w).Encode(resp)
	})
	return httptest.NewServer(mux)
}

func TestOmniClawProvider_Health(t *testing.T) {
	f := &fakeOmniClawServer{simulateOK: true, canPayOK: true}
	srv := f.start()
	defer srv.Close()

	p := NewOmniClawProvider(srv.URL, "test-token")
	if err := p.Health(context.Background()); err != nil {
		t.Fatalf("Health failed: %v", err)
	}
	if f.lastAuthHeader != "Bearer test-token" {
		t.Errorf("expected Authorization: Bearer test-token, got %q", f.lastAuthHeader)
	}
}

func TestOmniClawProvider_EvaluatePurchaseIntent_RequiresCryptoFields(t *testing.T) {
	p := NewOmniClawProvider("http://unused", "tok")
	_, err := p.EvaluatePurchaseIntent(context.Background(), Input{Merchant: "zepto", AmountMinorUnits: 10000, Currency: "INR"})
	if err == nil {
		t.Fatal("expected an error when CryptoRecipient/AmountUSDC are not set — OmniClaw cannot evaluate an INR grocery purchase")
	}
}

func TestOmniClawProvider_EvaluatePurchaseIntent_Allow(t *testing.T) {
	f := &fakeOmniClawServer{simulateOK: true}
	srv := f.start()
	defer srv.Close()

	p := NewOmniClawProvider(srv.URL, "tok")
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{CryptoRecipient: "0x1111111111111111111111111111111111111111", AmountUSDC: "5.00"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Allow {
		t.Errorf("expected ALLOW, got %s (%v)", dec.Decision, dec.ReasonCodes)
	}
	if f.lastSimulateBody["recipient"] != "0x1111111111111111111111111111111111111111" {
		t.Errorf("expected recipient to be forwarded to /simulate, got %v", f.lastSimulateBody)
	}
}

func TestOmniClawProvider_EvaluatePurchaseIntent_Deny(t *testing.T) {
	f := &fakeOmniClawServer{simulateOK: false, simulateReason: "Amount 50 exceeds per_tx_max 10"}
	srv := f.start()
	defer srv.Close()

	p := NewOmniClawProvider(srv.URL, "tok")
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{CryptoRecipient: "0x1111111111111111111111111111111111111111", AmountUSDC: "50.00"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Fatalf("expected DENY, got %s", dec.Decision)
	}
	if dec.ReasonCodes[0] != "Amount 50 exceeds per_tx_max 10" {
		t.Errorf("expected OmniClaw's own reason to be surfaced, got %v", dec.ReasonCodes)
	}
}

func TestOmniClawProvider_EvaluatePurchaseIntent_RequireApproval_AtConfirmThreshold(t *testing.T) {
	f := &fakeOmniClawServer{simulateOK: true, confirmThreshold: "10.00"}
	srv := f.start()
	defer srv.Close()

	p := NewOmniClawProvider(srv.URL, "tok")

	// Below threshold: ALLOW.
	below, err := p.EvaluatePurchaseIntent(context.Background(), Input{CryptoRecipient: "0xabc", AmountUSDC: "5.00"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if below.Decision != Allow {
		t.Errorf("expected ALLOW below confirm_threshold, got %s", below.Decision)
	}

	// At threshold: REQUIRE_APPROVAL.
	at, err := p.EvaluatePurchaseIntent(context.Background(), Input{CryptoRecipient: "0xabc", AmountUSDC: "10.00"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if at.Decision != RequireApproval {
		t.Errorf("expected REQUIRE_APPROVAL at confirm_threshold, got %s", at.Decision)
	}
	if at.ApprovalRequirement == nil {
		t.Error("expected ApprovalRequirement to be set")
	}
}

// TestOmniClawProvider_EvaluatePayment_NeverRequiresApproval regression-
// tests the same class of bug fixed in LocalProvider
// (TestEvaluatePayment_NeverReturnsRequireApproval_EvenAboveThreshold):
// the execute-time re-check must not re-demand a confirmation a human
// already granted, or an above-threshold OmniClaw payment could never
// execute either.
func TestOmniClawProvider_EvaluatePayment_NeverRequiresApproval(t *testing.T) {
	f := &fakeOmniClawServer{simulateOK: true, confirmThreshold: "10.00"}
	srv := f.start()
	defer srv.Close()

	p := NewOmniClawProvider(srv.URL, "tok")
	dec, err := p.EvaluatePayment(context.Background(), Input{CryptoRecipient: "0xabc", AmountUSDC: "50.00"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Allow {
		t.Errorf("expected ALLOW (a human already approved this payment), got %s", dec.Decision)
	}
}

func TestOmniClawProvider_EvaluateMerchant_RealRecipient(t *testing.T) {
	f := &fakeOmniClawServer{canPayOK: true}
	srv := f.start()
	defer srv.Close()

	p := NewOmniClawProvider(srv.URL, "tok")
	dec, err := p.EvaluateMerchant(context.Background(), "https://pay.example.com/invoice")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Allow {
		t.Errorf("expected ALLOW, got %s", dec.Decision)
	}
}

func TestOmniClawProvider_EvaluateMerchant_RejectsNonRecipientNames(t *testing.T) {
	p := NewOmniClawProvider("http://unused", "tok")
	if _, err := p.EvaluateMerchant(context.Background(), "zepto"); err == nil {
		t.Fatal("expected an error for a bare merchant name — OmniClaw has no merchant-name concept")
	}
}

func TestOmniClawProvider_UnsupportedMethods_ReturnDescriptiveErrors(t *testing.T) {
	p := NewOmniClawProvider("http://unused", "tok")
	if _, err := p.EvaluateAmount(context.Background(), 1000, "INR", 0); err == nil {
		t.Error("expected EvaluateAmount to error (not meaningful without a recipient)")
	}
	if _, err := p.EvaluateCategory(context.Background(), "groceries"); err == nil {
		t.Error("expected EvaluateCategory to error (OmniClaw has no category field)")
	}
	if _, err := p.EvaluatePaymentSource(context.Background(), "payment:personal"); err == nil {
		t.Error("expected EvaluatePaymentSource to error (OmniClaw resolves wallet from token, not an alias)")
	}
}

func TestParseUSDCMicros(t *testing.T) {
	cases := map[string]int64{
		"10.00":      10_000_000,
		"10":         10_000_000,
		"0.50":       500_000,
		"10.5":       10_500_000,
		"0.000001":   1,
		"100.123456": 100_123_456,
	}
	for input, want := range cases {
		got, err := parseUSDCMicros(input)
		if err != nil {
			t.Errorf("parseUSDCMicros(%q) unexpected error: %v", input, err)
			continue
		}
		if got != want {
			t.Errorf("parseUSDCMicros(%q) = %d, want %d", input, got, want)
		}
	}
}

func TestUsdcAtOrAbove(t *testing.T) {
	if exceeds, err := usdcAtOrAbove("9.99", "10.00"); err != nil || exceeds {
		t.Errorf("expected 9.99 to NOT be at/above 10.00, got exceeds=%v err=%v", exceeds, err)
	}
	if exceeds, err := usdcAtOrAbove("10.00", "10.00"); err != nil || !exceeds {
		t.Errorf("expected 10.00 to be at/above 10.00, got exceeds=%v err=%v", exceeds, err)
	}
	if exceeds, err := usdcAtOrAbove("10.01", "10.00"); err != nil || !exceeds {
		t.Errorf("expected 10.01 to be at/above 10.00, got exceeds=%v err=%v", exceeds, err)
	}
}
