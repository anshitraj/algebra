package v1

import (
	"net/http"
	"strings"
)

// searchProducts is commerce.search_products over REST: a free-text query
// fanned out to every searchable merchant, without creating an intent.
// Merchants Algebra can't search come back with a handoff_url instead.
func (a *API) searchProducts(w http.ResponseWriter, r *http.Request) {
	ag, err := a.resolveAgent(r)
	if err != nil {
		writeError(w, err)
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, http.StatusBadRequest, errorBody{Error: "q is required"})
		return
	}
	results, err := a.b.Discovery.SearchProducts(r.Context(), ag.ID, q, queryLimit(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

// webSearch is commerce.web_search over REST: the last-resort general web
// search (links only — never a price, cart or order). 501 when no
// web-search fallback is configured.
func (a *API) webSearch(w http.ResponseWriter, r *http.Request) {
	ag, err := a.resolveAgent(r)
	if err != nil {
		writeError(w, err)
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, http.StatusBadRequest, errorBody{Error: "q is required"})
		return
	}
	results, err := a.b.Discovery.SearchWeb(r.Context(), ag.ID, q, queryLimit(r))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}
