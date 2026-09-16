package policy

// Rules is the deterministic, JSON-configurable ruleset LocalProvider
// evaluates against. This is Algebra's own real policy engine — it is not a
// mock, and it is the default until an external engine (e.g. OmniClaw) is
// wired up with a confirmed wire contract (see OmniClawProvider).
type Rules struct {
	Version string `json:"version"`

	MaxPerTransactionMinorUnits int64  `json:"max_per_transaction_minor_units"`
	MaxPerDayMinorUnits         int64  `json:"max_per_day_minor_units"`
	Currency                    string `json:"currency"`

	// ApprovalThresholdMinorUnits: amounts at or above this always require
	// approval, even when under the hard limits above.
	ApprovalThresholdMinorUnits int64 `json:"approval_threshold_minor_units"`

	// AllowedMerchants, if non-empty, is an allow-list — anything not in it
	// is denied. BlockedMerchants is checked regardless and always wins.
	AllowedMerchants []string `json:"allowed_merchants,omitempty"`
	BlockedMerchants []string `json:"blocked_merchants,omitempty"`

	BlockedCategories []string `json:"blocked_categories,omitempty"`

	// AllowedPaymentProfiles/AllowedShippingProfiles, if non-empty, are
	// allow-lists over privacy aliases (e.g. "payment:personal",
	// "shipping:home"). Empty means "no restriction beyond existing".
	AllowedPaymentProfiles  []string `json:"allowed_payment_profiles,omitempty"`
	AllowedShippingProfiles []string `json:"allowed_shipping_profiles,omitempty"`

	InternationalRequiresApproval bool `json:"international_requires_approval"`
}

// DefaultRules mirrors the example ruleset in the build mandate verbatim,
// as a safe, conservative starting point for local development:
//
//	Max ₹5,000/day, Max ₹2,000/purchase, gift cards blocked,
//	international merchants require approval, purchases ≥ ₹1,000 require
//	approval, only payment:personal allowed, only shipping:home permitted.
func DefaultRules() Rules {
	return Rules{
		Version:                       "local-rules-v1",
		Currency:                      "INR",
		MaxPerTransactionMinorUnits:   200000, // ₹2,000
		MaxPerDayMinorUnits:           500000, // ₹5,000
		ApprovalThresholdMinorUnits:   100000, // ₹1,000
		BlockedCategories:             []string{"gift_cards"},
		AllowedPaymentProfiles:        []string{"payment:personal"},
		AllowedShippingProfiles:       []string{"shipping:home"},
		InternationalRequiresApproval: true,
	}
}

func contains(list []string, v string) bool {
	for _, item := range list {
		if item == v {
			return true
		}
	}
	return false
}
