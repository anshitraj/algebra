package websearch

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/project-algebra/algebra/connectors/sanitize"
	"github.com/project-algebra/algebra/internal/domain/merchant"
	wsdomain "github.com/project-algebra/algebra/internal/domain/websearch"
)

const (
	DefaultGeminiAPIBase = "https://generativelanguage.googleapis.com/v1beta"
	// DefaultGeminiModel is Google's stable "latest Flash" alias: fast, and
	// grounded search doesn't need a Pro model.
	DefaultGeminiModel = "gemini-flash-latest"

	// groundingRedirectHost serves the result links Google Search grounding
	// hands the model. Only links on this host are trusted: a URL the model
	// typed out itself may be invented (observed in testing — product IDs
	// that change between identical calls), so it is dropped.
	groundingRedirectHost = "vertexaisearch.cloud.google.com"
	groundingRedirectPath = "/grounding-api-redirect/"
)

// GeminiConfig configures the Gemini-grounded shopping search.
type GeminiConfig struct {
	APIKey string
	// Model defaults to DefaultGeminiModel.
	Model string
	// Region biases the search ("India" by default).
	Region string
	// APIBase/HTTPClient exist for tests.
	APIBase    string
	HTTPClient *http.Client
}

// Gemini is a WebSearcher backed by Gemini with Google Search grounding: a
// real, live Google search whose result links come back through Google's
// grounding redirect. Each kept result is resolved to the store's own URL
// and checked by merchant.ValidatePublicHTTPSURL before anyone sees it.
type Gemini struct {
	cfg          GeminiConfig
	http         *http.Client
	redirectHost string // groundingRedirectHost; overridden only in tests
}

func NewGemini(cfg GeminiConfig) *Gemini {
	if cfg.Model == "" {
		cfg.Model = DefaultGeminiModel
	}
	if cfg.Region == "" {
		cfg.Region = "India"
	}
	if cfg.APIBase == "" {
		cfg.APIBase = DefaultGeminiAPIBase
	}
	cfg.APIBase = strings.TrimSuffix(cfg.APIBase, "/")
	hc := cfg.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: 45 * time.Second}
	}
	client := *hc
	// Never follow redirects with the API key attached; redirect resolution
	// below reads Location itself.
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return &Gemini{cfg: cfg, http: &client, redirectHost: groundingRedirectHost}
}

type geminiListing struct {
	Name     string   `json:"name"`
	Variant  string   `json:"variant"`
	PriceINR *float64 `json:"price_inr"`
	Store    string   `json:"store"`
	URL      string   `json:"url"`
}

var jsonArray = regexp.MustCompile(`(?s)\[.*\]`)

// Search runs one grounded search and returns up to limit shopping
// listings, most relevant first.
func (g *Gemini) Search(ctx context.Context, query string, limit int) ([]wsdomain.Result, error) {
	q := sanitize.Text(strings.TrimSpace(query), 200)
	if q == "" {
		return nil, errors.New("websearch: empty search query")
	}
	if limit <= 0 || limit > 10 {
		limit = 8
	}
	prompt := fmt.Sprintf(`Search Google for: %s price %s — quick commerce and online stores (Blinkit, Zepto, Swiggy Instamart, BigBasket, Amazon, Flipkart, JioMart, the brand's own store).
From the search results only, list up to %d distinct buyable options as a JSON array and nothing else:
[{"name":"","variant":"","price_inr":0,"store":"","url":""}]
name: the product as listed. variant: size or pack. store: the shop's name.
url must be the exact result link you were given. price_inr: the price the result shows in rupees, or null if it shows none.`,
		q, g.cfg.Region, limit)

	reqBody, _ := json.Marshal(map[string]any{
		"contents": []any{map[string]any{"role": "user", "parts": []any{map[string]any{"text": prompt}}}},
		"tools":    []any{map[string]any{"google_search": map[string]any{}}},
		"generationConfig": map[string]any{
			"thinkingConfig": map[string]any{"thinkingLevel": "low"},
		},
	})
	endpoint := g.cfg.APIBase + "/models/" + url.PathEscape(g.cfg.Model) + ":generateContent"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("websearch: building gemini request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", g.cfg.APIKey)

	resp, err := g.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("websearch: gemini search failed: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("websearch: reading gemini response: %w", err)
	}
	switch {
	case resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden:
		return nil, fmt.Errorf("websearch: Gemini rejected the API key (HTTP %d)", resp.StatusCode)
	case resp.StatusCode == http.StatusTooManyRequests:
		return nil, errors.New("websearch: Gemini rate limit reached — try again shortly")
	case resp.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("websearch: Gemini returned HTTP %d", resp.StatusCode)
	}

	var body struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, fmt.Errorf("websearch: decoding gemini response: %w", err)
	}
	var text strings.Builder
	for _, c := range body.Candidates {
		for _, p := range c.Content.Parts {
			text.WriteString(p.Text)
		}
	}
	listings := parseListings(text.String())
	return g.verify(ctx, listings, limit), nil
}

func parseListings(text string) []geminiListing {
	m := jsonArray.FindString(text)
	if m == "" {
		return nil
	}
	var out []geminiListing
	if err := json.Unmarshal([]byte(m), &out); err != nil {
		return nil
	}
	return out
}

// verify keeps only listings whose link is a genuine grounding redirect,
// resolves each to the store's real URL (one request each, in parallel,
// never following further), and drops anything that isn't a public https
// page.
func (g *Gemini) verify(ctx context.Context, listings []geminiListing, limit int) []wsdomain.Result {
	type slot struct {
		res wsdomain.Result
		ok  bool
	}
	slots := make([]slot, len(listings))
	var wg sync.WaitGroup
	for i, l := range listings {
		if i >= limit*2 { // bound the fan-out even if the model over-delivers
			break
		}
		if !g.isGroundingRedirect(l.URL) || strings.TrimSpace(l.Name) == "" {
			continue
		}
		wg.Add(1)
		go func(i int, l geminiListing) {
			defer wg.Done()
			target, err := g.resolve(ctx, l.URL)
			if err != nil {
				return
			}
			if _, err := merchant.ValidatePublicHTTPSURL(target); err != nil {
				return
			}
			r := wsdomain.Result{
				Title:   sanitize.Text(l.Name, 160),
				Snippet: sanitize.Text(l.Variant, 120),
				URL:     target,
				Store:   sanitize.Text(l.Store, 60),
			}
			if r.Store == "" {
				r.Store = storeFromHost(target)
			}
			if l.PriceINR != nil && *l.PriceINR > 0 && *l.PriceINR < 10_000_000 {
				r.PriceMinorUnits = int64(math.Round(*l.PriceINR * 100))
				r.Currency = "INR"
			}
			slots[i] = slot{res: r, ok: true}
		}(i, l)
	}
	wg.Wait()

	out := make([]wsdomain.Result, 0, limit)
	seen := map[string]bool{}
	for _, s := range slots {
		if !s.ok || seen[s.res.URL] {
			continue
		}
		seen[s.res.URL] = true
		out = append(out, s.res)
		if len(out) == limit {
			break
		}
	}
	return out
}

func (g *Gemini) isGroundingRedirect(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && u.Scheme == "https" && u.Host == g.redirectHost && strings.HasPrefix(u.Path, groundingRedirectPath)
}

// resolve reads the grounding redirect's Location without following it.
func (g *Gemini) resolve(ctx context.Context, redirect string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, redirect, nil)
	if err != nil {
		return "", err
	}
	resp, err := g.http.Do(req)
	if err != nil {
		return "", err
	}
	resp.Body.Close()
	if resp.StatusCode < 300 || resp.StatusCode > 399 {
		return "", fmt.Errorf("websearch: grounding redirect returned %d", resp.StatusCode)
	}
	loc := resp.Header.Get("Location")
	if loc == "" {
		return "", errors.New("websearch: grounding redirect had no Location")
	}
	return loc, nil
}

func storeFromHost(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	h := strings.TrimPrefix(u.Hostname(), "www.")
	if i := strings.Index(h, "."); i > 0 {
		h = h[:i]
	}
	if h == "" {
		return ""
	}
	return strings.ToUpper(h[:1]) + h[1:]
}
