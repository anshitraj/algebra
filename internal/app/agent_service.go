package app

import (
	"context"
	"fmt"
	"time"

	"github.com/project-algebra/algebra/internal/domain/agent"
)

// AgentService creates and revokes AgentIdentity credentials. This is a
// human/account-management action (REST only, never exposed through MCP —
// an agent has no business minting other agents).
type AgentService struct {
	store AgentStore
	now   func() time.Time
}

func NewAgentService(store AgentStore) *AgentService {
	return &AgentService{store: store, now: time.Now}
}

// CreateAgent mints a new bearer token and returns it exactly once — it is
// never retrievable again, only its SHA-256 hash is persisted (see
// internal/domain/agent.GenerateToken).
func (s *AgentService) CreateAgent(ctx context.Context, userID, clientID, name string, permissions []agent.Permission) (rawToken string, identity *agent.Identity, err error) {
	for _, p := range permissions {
		if !p.Valid() {
			return "", nil, fmt.Errorf("app: unknown permission %q", p)
		}
	}
	raw, hash, err := agent.GenerateToken()
	if err != nil {
		return "", nil, err
	}
	id := &agent.Identity{
		ID: newID("agent"), UserID: userID, ClientID: clientID, Name: name,
		Permissions: permissions, TokenHash: hash, CreatedAt: s.now(),
	}
	if err := s.store.Create(ctx, id); err != nil {
		return "", nil, fmt.Errorf("app: creating agent: %w", err)
	}
	return raw, id, nil
}

func (s *AgentService) Revoke(ctx context.Context, agentID string) error {
	return s.store.Revoke(ctx, agentID, s.now())
}
