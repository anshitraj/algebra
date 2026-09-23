// Package websearch holds the domain type for general web-search fallback
// results — not a merchant, not a product, no price and no cart. It exists
// because a search result that just links out to an arbitrary public page
// doesn't fit merchant.Product (which asserts a price and a merchant name a
// real storefront stands behind).
package websearch

// Result is one general web-search hit: a title, snippet and link an agent
// can hand to the user when no connected merchant carries the product.
// Algebra never fetches URL itself and never treats it as a priced,
// buyable item.
type Result struct {
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	URL     string `json:"url"`

	// Store and the price fields are set when the hit is a shopping listing
	// (connectors/websearch.Gemini). The price is what the search result
	// showed — never a quote: Algebra can't buy through it, and it may
	// already be stale.
	Store           string `json:"store,omitempty"`
	PriceMinorUnits int64  `json:"price_minor_units,omitempty"`
	Currency        string `json:"currency,omitempty"`
}
