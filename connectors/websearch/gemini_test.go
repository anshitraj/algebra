package websearch

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

// fakeGoogle serves both the generateContent endpoint and the grounding
// redirect paths, so the test exercises the real request, parse, verify and
// resolve path end to end.
func fakeGoogle(t *testing.T, modelText string) (*httptest.Server, *Gemini) {
	t.Helper()
	var srv *httptest.Server
	srv = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, ":generateContent"):
			if r.Header.Get("x-goog-api-key") != "test-key" {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			body, _ := io.ReadAll(r.Body)
			if !strings.Contains(string(body), `"google_search"`) {
				t.Errorf("request did not enable google_search grounding: %s", body)
			}
			text := strings.ReplaceAll(modelText, "REDIRECT", "https://"+srv.Listener.Addr().String()+groundingRedirectPath)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"candidates": []any{map[string]any{"content": map[string]any{"parts": []any{map[string]any{"text": text}}}}},
			})
		case strings.HasPrefix(r.URL.Path, groundingRedirectPath+"blinkit"):
			w.Header().Set("Location", "https://blinkit.com/prn/coke-zero/prid/1")
			w.WriteHeader(http.StatusFound)
		case strings.HasPrefix(r.URL.Path, groundingRedirectPath+"zepto"):
			w.Header().Set("Location", "https://www.zeptonow.com/pn/coke-zero/pvid/2")
			w.WriteHeader(http.StatusFound)
		case strings.HasPrefix(r.URL.Path, groundingRedirectPath+"internal"):
			w.Header().Set("Location", "https://169.254.169.254/latest/meta-data")
			w.WriteHeader(http.StatusFound)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	g := NewGemini(GeminiConfig{APIKey: "test-key", APIBase: srv.URL + "/v1beta", HTTPClient: srv.Client()})
	g.redirectHost = srv.Listener.Addr().String()
	return srv, g
}

func TestGemini_KeepsOnlyVerifiedGroundedListings(t *testing.T) {
	text := "```json\n" + `[
	  {"name":"Coca-Cola Zero Sugar","variant":"300 ml can","price_inr":38,"store":"Blinkit","url":"REDIRECTblinkit/abc"},
	  {"name":"Coke Zero PET","variant":"250 ml","price_inr":20,"store":"","url":"REDIRECTzepto/def"},
	  {"name":"Invented listing","variant":"1 L","price_inr":99,"store":"BigBasket","url":"https://www.bigbasket.com/pd/99999/made-up"},
	  {"name":"SSRF bait","variant":"","price_inr":1,"store":"x","url":"REDIRECTinternal/zzz"},
	  {"name":"Blinkit dup","variant":"300 ml can","price_inr":38,"store":"Blinkit","url":"REDIRECTblinkit/abc"}
	]` + "\n```"
	_, g := fakeGoogle(t, text)

	got, err := g.Search(context.Background(), "Coke Zero", 8)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 verified listings (invented URL, SSRF redirect and duplicate dropped), got %d: %+v", len(got), got)
	}
	if got[0].URL != "https://blinkit.com/prn/coke-zero/prid/1" || got[0].PriceMinorUnits != 3800 || got[0].Currency != "INR" || got[0].Store != "Blinkit" {
		t.Errorf("first listing wrong: %+v", got[0])
	}
	if got[1].Store != "Zeptonow" {
		t.Errorf("empty store should fall back to the resolved host, got %q", got[1].Store)
	}
	for _, r := range got {
		if strings.Contains(r.URL, groundingRedirectPath) {
			t.Errorf("returned an unresolved redirect: %s", r.URL)
		}
	}
}

func TestGemini_BadKeyIsAClearError(t *testing.T) {
	srv, _ := fakeGoogle(t, "[]")
	g := NewGemini(GeminiConfig{APIKey: "wrong", APIBase: srv.URL + "/v1beta", HTTPClient: srv.Client()})
	if _, err := g.Search(context.Background(), "coke", 5); err == nil || !strings.Contains(err.Error(), "rejected the API key") {
		t.Errorf("want API-key error, got %v", err)
	}
}

func TestGemini_UnparseableAnswerIsEmptyNotError(t *testing.T) {
	_, g := fakeGoogle(t, "Sorry, I couldn't find anything.")
	got, err := g.Search(context.Background(), "unobtainium", 5)
	if err != nil || len(got) != 0 {
		t.Errorf("want (empty, nil), got (%v, %v)", got, err)
	}
}

func TestGemini_ModelPathIsEscaped(t *testing.T) {
	g := NewGemini(GeminiConfig{APIKey: "k", Model: "../evil"})
	if !strings.Contains(g.cfg.APIBase+"/models/"+url.PathEscape(g.cfg.Model), "..%2Fevil") {
		t.Error(fmt.Sprintf("model name must be path-escaped: %s", url.PathEscape(g.cfg.Model)))
	}
}
