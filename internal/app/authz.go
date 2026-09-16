package app

import (
	"context"
	"fmt"

	"github.com/project-algebra/algebra/internal/domain/agent"
	"github.com/project-algebra/algebra/internal/domain/shared"
)

// requirePermission loads the agent and checks it holds perm and is not
// revoked. Every mutating entry point in every service calls this before
// doing anything else — there is no code path that trusts a caller-supplied
// claim about what an agent may do.
func requirePermission(ctx context.Context, agents AgentStore, agentID string, perm agent.Permission) (*agent.Identity, error) {
	ag, err := agents.Get(ctx, agentID)
	if err != nil {
		return nil, err
	}
	if !ag.HasPermission(perm) {
		return nil, fmt.Errorf("%w: agent %s lacks permission %s", shared.ErrUnauthorized, agentID, perm)
	}
	return ag, nil
}
