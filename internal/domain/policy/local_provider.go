package policy

import (
	"context"
	"time"
)

// LocalProvider is Algebra's own deterministic rule-based PolicyProvider. It
// is real, not a mock — it makes actual ALLOW/DENY/REQUIRE_APPROVAL
// decisions from Rules — and is the default provider until an external
// engine is wired up.
type LocalProvider struct {
	rules Rules
}

// NewLocalProvider constructs a LocalProvider over the given ruleset.
func NewLocalProvider(rules Rules) *LocalProvider {
	return &LocalProvider{rules: rules}
}

func (p *LocalProvider) Version() string { return p.rules.Version }

func (p *LocalProvider) decision(d Decision, reason string) *PolicyDecision {
	pd := &PolicyDecision{
		Decision:      d,
		ReasonCodes:   []string{reason},
		PolicyVersion: p.rules.Version,
		EvaluatedAt:   time.Now().UTC(),
	}
	if d == RequireApproval {
		pd.ApprovalRequirement = &ApprovalRequirement{Reason: reason}
	}
	return pd
}

func (p *LocalProvider) EvaluateMerchant(_ context.Context, merchant string) (*PolicyDecision, error) {
	if contains(p.rules.BlockedMerchants, merchant) {
		return p.decision(Deny, "MERCHANT_BLOCKED"), nil
	}
	if len(p.rules.AllowedMerchants) > 0 && !contains(p.rules.AllowedMerchants, merchant) {
		return p.decision(Deny, "MERCHANT_NOT_ALLOWLISTED"), nil
	}
	return p.decision(Allow, "MERCHANT_OK"), nil
}

func (p *LocalProvider) EvaluateCategory(_ context.Context, category string) (*PolicyDecision, error) {
	if category != "" && contains(p.rules.BlockedCategories, category) {
		return p.decision(Deny, "CATEGORY_BLOCKED"), nil
	}
	return p.decision(Allow, "CATEGORY_OK"), nil
}

func (p *LocalProvider) EvaluateAmount(_ context.Context, amountMinorUnits int64, currency string, spendTodayMinorUnits int64) (*PolicyDecision, error) {
	if p.rules.Currency != "" && currency != p.rules.Currency {
		return p.decision(Deny, "CURRENCY_NOT_SUPPORTED"), nil
	}
	if p.rules.MaxPerTransactionMinorUnits > 0 && amountMinorUnits > p.rules.MaxPerTransactionMinorUnits {
		return p.decision(Deny, "AMOUNT_EXCEEDS_PER_TRANSACTION_LIMIT"), nil
	}
	if p.rules.MaxPerDayMinorUnits > 0 && spendTodayMinorUnits+amountMinorUnits > p.rules.MaxPerDayMinorUnits {
		return p.decision(Deny, "AMOUNT_EXCEEDS_DAILY_LIMIT"), nil
	}
	if p.rules.ApprovalThresholdMinorUnits > 0 && amountMinorUnits >= p.rules.ApprovalThresholdMinorUnits {
		return p.decision(RequireApproval, "AMOUNT_AT_OR_ABOVE_APPROVAL_THRESHOLD"), nil
	}
	return p.decision(Allow, "AMOUNT_OK"), nil
}

// evaluateHardAmountCaps checks only the caps that DENY regardless of
// approval (per-transaction limit, daily limit, currency) — never the
// approval-threshold rule. It deliberately does NOT reuse EvaluateAmount:
// that method's RequireApproval result means "a human must click approve,"
// which is a question about what happens BEFORE an Approval exists. Once an
// Approval exists (this is what EvaluatePayment, called from
// OrderService.Execute, guards), re-asking "does this amount need approval"
// would re-fire RequireApproval for the exact amount a human already
// approved, on every single execution attempt — an unrecoverable loop, not
// a safety check. Hard caps, by contrast, are correct to re-check every
// time: no human approval can override a per-transaction/daily limit.
func (p *LocalProvider) evaluateHardAmountCaps(amountMinorUnits int64, currency string, spendTodayMinorUnits int64) *PolicyDecision {
	if p.rules.Currency != "" && currency != p.rules.Currency {
		return p.decision(Deny, "CURRENCY_NOT_SUPPORTED")
	}
	if p.rules.MaxPerTransactionMinorUnits > 0 && amountMinorUnits > p.rules.MaxPerTransactionMinorUnits {
		return p.decision(Deny, "AMOUNT_EXCEEDS_PER_TRANSACTION_LIMIT")
	}
	if p.rules.MaxPerDayMinorUnits > 0 && spendTodayMinorUnits+amountMinorUnits > p.rules.MaxPerDayMinorUnits {
		return p.decision(Deny, "AMOUNT_EXCEEDS_DAILY_LIMIT")
	}
	return p.decision(Allow, "AMOUNT_WITHIN_HARD_LIMITS")
}

func (p *LocalProvider) EvaluatePaymentSource(_ context.Context, paymentProfile string) (*PolicyDecision, error) {
	if len(p.rules.AllowedPaymentProfiles) > 0 && !contains(p.rules.AllowedPaymentProfiles, paymentProfile) {
		return p.decision(Deny, "PAYMENT_PROFILE_NOT_ALLOWED"), nil
	}
	return p.decision(Allow, "PAYMENT_PROFILE_OK"), nil
}

func (p *LocalProvider) evaluateShipping(shippingProfile string) *PolicyDecision {
	if len(p.rules.AllowedShippingProfiles) > 0 && !contains(p.rules.AllowedShippingProfiles, shippingProfile) {
		return p.decision(Deny, "SHIPPING_PROFILE_NOT_ALLOWED")
	}
	return p.decision(Allow, "SHIPPING_PROFILE_OK")
}

func (p *LocalProvider) evaluateInternational(international bool) *PolicyDecision {
	if international && p.rules.InternationalRequiresApproval {
		return p.decision(RequireApproval, "INTERNATIONAL_MERCHANT_REQUIRES_APPROVAL")
	}
	return p.decision(Allow, "INTERNATIONAL_OK")
}

// EvaluatePurchaseIntent runs every sub-check and merges them: any DENY
// wins outright, otherwise any REQUIRE_APPROVAL wins, otherwise ALLOW.
func (p *LocalProvider) EvaluatePurchaseIntent(ctx context.Context, in Input) (*PolicyDecision, error) {
	merchantDec, err := p.EvaluateMerchant(ctx, in.Merchant)
	if err != nil {
		return nil, err
	}
	categoryDec, err := p.EvaluateCategory(ctx, in.Category)
	if err != nil {
		return nil, err
	}
	amountDec, err := p.EvaluateAmount(ctx, in.AmountMinorUnits, in.Currency, in.SpendTodayMinorUnits)
	if err != nil {
		return nil, err
	}
	paymentDec, err := p.EvaluatePaymentSource(ctx, in.PaymentProfile)
	if err != nil {
		return nil, err
	}
	shippingDec := p.evaluateShipping(in.ShippingProfile)
	intlDec := p.evaluateInternational(in.International)

	return merge(merchantDec, categoryDec, amountDec, paymentDec, shippingDec, intlDec), nil
}

// EvaluatePayment re-checks hard amount caps + payment source — run
// immediately before authorization to catch a payment-source switch or a
// daily-limit breach (e.g. another purchase already landed today) after the
// intent was originally cleared. It intentionally never returns
// RequireApproval — see evaluateHardAmountCaps.
func (p *LocalProvider) EvaluatePayment(ctx context.Context, in Input) (*PolicyDecision, error) {
	amountDec := p.evaluateHardAmountCaps(in.AmountMinorUnits, in.Currency, in.SpendTodayMinorUnits)
	paymentDec, err := p.EvaluatePaymentSource(ctx, in.PaymentProfile)
	if err != nil {
		return nil, err
	}
	return merge(amountDec, paymentDec), nil
}
