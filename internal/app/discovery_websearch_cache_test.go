package app

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	agentpkg "github.com/project-algebra/algebra/internal/domain/agent"
	"github.com/project-algebra/algebra/internal/domain/websearch"
)

type countingSearcher struct {
	calls   int
	results []websearch.Result
	err     error
}

func (c *countingSearcher) Search(context.Context, string, int) ([]websearch.Result, error) {
	c.calls++
	return c.results, c.err
}

type memCache struct {
	mu   sync.Mutex
	data map[string][]websearch.Result
}

func (m *memCache) GetJSON(_ context.Context, key string, out any) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	v, ok := m.data[key]
	if !ok {
		return false
	}
	*(out.(*[]websearch.Result)) = v
	return true
}

func (m *memCache) SetJSON(_ context.Context, key string, v any, _ time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.data[key] = v.([]websearch.Result)
}

func newSearchHarness(t *testing.T, ws WebSearcher) (*DiscoveryService, *memCache) {
	t.Helper()
	agents := newFakeAgentStore()
	agents.put(&agentpkg.Identity{ID: "agent_1", UserID: "user_1", Permissions: []agentpkg.Permission{agentpkg.PermShoppingRead}})
	svc := NewDiscoveryService(newFakeIntentStore(), agents, newFakeQuoteStore(), NewConnectorRegistry(), newFakeAuditLogger(), time.Minute)
	svc.SetWebSearcher(ws)
	cache := &memCache{data: map[string][]websearch.Result{}}
	svc.SetSearchCache(cache, time.Minute)
	return svc, cache
}

func TestSearchWeb_CachesAcrossEquivalentQueries(t *testing.T) {
	ctx := context.Background()
	ws := &countingSearcher{results: []websearch.Result{{Title: "Coke Zero 750ml", URL: "https://blinkit.com/x", Store: "Blinkit"}}}
	svc, _ := newSearchHarness(t, ws)

	for _, q := range []string{"Coke Zero", "coke zero", "  Coke   Zero "} {
		got, err := svc.SearchWeb(ctx, "agent_1", q, 5)
		if err != nil || len(got) != 1 || got[0].Store != "Blinkit" {
			t.Fatalf("%q: %v %+v", q, err, got)
		}
	}
	if ws.calls != 1 {
		t.Errorf("equivalent queries should hit the provider once, got %d calls", ws.calls)
	}
	// A different limit is a different answer, so it must not reuse the cache.
	if _, err := svc.SearchWeb(ctx, "agent_1", "Coke Zero", 8); err != nil {
		t.Fatal(err)
	}
	if ws.calls != 2 {
		t.Errorf("a different limit should search again, got %d calls", ws.calls)
	}
}

func TestSearchWeb_DoesNotCacheEmptyOrFailedSearches(t *testing.T) {
	ctx := context.Background()
	ws := &countingSearcher{results: nil}
	svc, _ := newSearchHarness(t, ws)
	for i := 0; i < 2; i++ {
		if _, err := svc.SearchWeb(ctx, "agent_1", "unobtainium", 5); err != nil {
			t.Fatal(err)
		}
	}
	if ws.calls != 2 {
		t.Errorf("an empty result must not be cached (upstream hiccups hide products), got %d calls", ws.calls)
	}

	failing := &countingSearcher{err: errors.New("rate limited")}
	svc2, cache := newSearchHarness(t, failing)
	if _, err := svc2.SearchWeb(ctx, "coke", "x", 5); err == nil {
		t.Error("permission check should reject an unknown agent")
	}
	if _, err := svc2.SearchWeb(ctx, "agent_1", "coke", 5); err == nil {
		t.Error("a provider error must surface, not be swallowed")
	}
	if len(cache.data) != 0 {
		t.Error("a failed search must not be cached")
	}
}
