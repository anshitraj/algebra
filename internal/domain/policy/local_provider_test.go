package policy

import (
	"context"
	"testing"
)

func TestEvaluatePurchaseIntent_Allow(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{
		Merchant:         "zepto",
		Category:         "groceries",
		AmountMinorUnits: 40000, // ₹400, under ₹1,000 approval threshold
		Currency:         "INR",
		PaymentProfile:   "payment:personal",
		ShippingProfile:  "shipping:home",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Allow {
		t.Errorf("expected ALLOW, got %s (reasons: %v)", dec.Decision, dec.ReasonCodes)
	}
}

func TestEvaluatePurchaseIntent_RequiresApprovalAtThreshold(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{
		Merchant:         "zepto",
		AmountMinorUnits: 100000, // exactly ₹1,000 threshold
		Currency:         "INR",
		PaymentProfile:   "payment:personal",
		ShippingProfile:  "shipping:home",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != RequireApproval {
		t.Errorf("expected REQUIRE_APPROVAL, got %s", dec.Decision)
	}
	if dec.ApprovalRequirement == nil {
		t.Error("expected ApprovalRequirement to be set")
	}
}

func TestEvaluatePurchaseIntent_DeniesOverPerTransactionLimit(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{
		Merchant:         "zepto",
		AmountMinorUnits: 200001, // ₹2,000.01, over the ₹2,000 per-tx limit
		Currency:         "INR",
		PaymentProfile:   "payment:personal",
		ShippingProfile:  "shipping:home",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY, got %s", dec.Decision)
	}
}

func TestEvaluatePurchaseIntent_DeniesOverDailyLimitEvenIfPerTxOK(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{
		Merchant:             "zepto",
		AmountMinorUnits:     50000,  // ₹500, well under per-tx limit
		SpendTodayMinorUnits: 480000, // already spent ₹4,800 today; +500 breaches ₹5,000
		Currency:             "INR",
		PaymentProfile:       "payment:personal",
		ShippingProfile:      "shipping:home",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY (daily limit), got %s: %v", dec.Decision, dec.ReasonCodes)
	}
}

func TestEvaluatePurchaseIntent_DeniesBlockedCategory(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{
		Merchant:         "amazon",
		Category:         "gift_cards",
		AmountMinorUnits: 10000,
		Currency:         "INR",
		PaymentProfile:   "payment:personal",
		ShippingProfile:  "shipping:home",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY for blocked category, got %s", dec.Decision)
	}
	found := false
	for _, r := range dec.ReasonCodes {
		if r == "CATEGORY_BLOCKED" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected CATEGORY_BLOCKED reason code, got %v", dec.ReasonCodes)
	}
}

func TestEvaluatePurchaseIntent_DeniesDisallowedPaymentProfile(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{
		Merchant:         "zepto",
		AmountMinorUnits: 10000,
		Currency:         "INR",
		PaymentProfile:   "payment:travel", // not in AllowedPaymentProfiles
		ShippingProfile:  "shipping:home",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY for disallowed payment profile, got %s", dec.Decision)
	}
}

func TestEvaluatePurchaseIntent_InternationalRequiresApproval(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{
		Merchant:         "some-intl-merchant",
		AmountMinorUnits: 10000,
		Currency:         "INR",
		PaymentProfile:   "payment:personal",
		ShippingProfile:  "shipping:home",
		International:    true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != RequireApproval {
		t.Errorf("expected REQUIRE_APPROVAL for international merchant, got %s", dec.Decision)
	}
}

func TestEvaluatePurchaseIntent_DenyBeatsRequireApproval(t *testing.T) {
	// Amount is over the per-transaction limit (DENY) AND international
	// (REQUIRE_APPROVAL) at once — DENY must win.
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePurchaseIntent(context.Background(), Input{
		Merchant:         "some-intl-merchant",
		AmountMinorUnits: 900000,
		Currency:         "INR",
		PaymentProfile:   "payment:personal",
		ShippingProfile:  "shipping:home",
		International:    true,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY to win over REQUIRE_APPROVAL, got %s", dec.Decision)
	}
}

func TestEvaluateMerchant_Blocklist(t *testing.T) {
	rules := DefaultRules()
	rules.BlockedMerchants = []string{"shady-merchant"}
	p := NewLocalProvider(rules)

	dec, err := p.EvaluateMerchant(context.Background(), "shady-merchant")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY for blocked merchant, got %s", dec.Decision)
	}
}

func TestEvaluateMerchant_Allowlist(t *testing.T) {
	rules := DefaultRules()
	rules.AllowedMerchants = []string{"zepto", "blinkit"}
	p := NewLocalProvider(rules)

	if dec, _ := p.EvaluateMerchant(context.Background(), "zepto"); dec.Decision != Allow {
		t.Errorf("expected ALLOW for allowlisted merchant, got %s", dec.Decision)
	}
	if dec, _ := p.EvaluateMerchant(context.Background(), "amazon"); dec.Decision != Deny {
		t.Errorf("expected DENY for non-allowlisted merchant, got %s", dec.Decision)
	}
}

func TestEvaluatePayment_NeverReturnsRequireApproval_EvenAboveThreshold(t *testing.T) {
	// Regression test: EvaluatePayment runs at execution time, AFTER a
	// human has already approved a REQUIRE_APPROVAL purchase. If it
	// re-applied the approval-threshold rule, every over-threshold purchase
	// would loop forever between APPROVED and REAPPROVAL_REQUIRED and never
	// actually execute — see internal/app's
	// TestOrchestration_RequiresApproval_CrossUserRejected, which caught
	// exactly this before evaluateHardAmountCaps existed.
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePayment(context.Background(), Input{
		AmountMinorUnits: 150000, // ₹1,500 — above the ₹1,000 approval threshold, below the ₹2,000 cap
		Currency:         "INR",
		PaymentProfile:   "payment:personal",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Allow {
		t.Errorf("expected ALLOW (a human already approved this amount), got %s: %v", dec.Decision, dec.ReasonCodes)
	}
}

func TestEvaluatePayment_StillDeniesHardCapBreach(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePayment(context.Background(), Input{
		AmountMinorUnits: 250000, // ₹2,500 — over the ₹2,000 per-transaction cap, no approval can fix this
		Currency:         "INR",
		PaymentProfile:   "payment:personal",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY for a hard per-transaction cap breach, got %s", dec.Decision)
	}
}

func TestEvaluatePayment_StillDeniesDailyCapBreach(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePayment(context.Background(), Input{
		AmountMinorUnits:     50000,
		SpendTodayMinorUnits: 480000, // already ₹4,800 today; +500 breaches the ₹5,000 daily cap
		Currency:             "INR",
		PaymentProfile:       "payment:personal",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY for a daily cap breach, got %s", dec.Decision)
	}
}

func TestEvaluatePayment_StillDeniesDisallowedPaymentProfile(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	dec, err := p.EvaluatePayment(context.Background(), Input{
		AmountMinorUnits: 10000,
		Currency:         "INR",
		PaymentProfile:   "payment:travel",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dec.Decision != Deny {
		t.Errorf("expected DENY for a disallowed payment profile, got %s", dec.Decision)
	}
}

func TestVersion_IsStamped(t *testing.T) {
	p := NewLocalProvider(DefaultRules())
	if p.Version() == "" {
		t.Error("expected non-empty policy version for audit trails")
	}
}
