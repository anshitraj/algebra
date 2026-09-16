package v1

import (
	"net/http"

	"github.com/project-algebra/algebra/internal/domain/agent"
)

type createAgentRequest struct {
	UserID      string   `json:"user_id"`
	ClientID    string   `json:"client_id"`
	Name        string   `json:"name"`
	Permissions []string `json:"permissions"`
}

type createAgentResponse struct {
	AgentID string `json:"agent_id"`
	Token   string `json:"token"` // shown exactly once
}

// createAgent mints a new AgentIdentity. A human/account-management action,
// not exposed to MCP — an agent cannot create another agent.
func (a *API) createAgent(w http.ResponseWriter, r *http.Request) {
	var req createAgentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	perms := make([]agent.Permission, len(req.Permissions))
	for i, p := range req.Permissions {
		perms[i] = agent.Permission(p)
	}
	token, identity, err := a.b.AgentSvc.CreateAgent(r.Context(), req.UserID, req.ClientID, req.Name, perms)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, createAgentResponse{AgentID: identity.ID, Token: token})
}

func (a *API) revokeAgent(w http.ResponseWriter, r *http.Request) {
	if err := a.b.AgentSvc.Revoke(r.Context(), r.PathValue("id")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, okResponse{OK: true})
}

type okResponse struct {
	OK bool `json:"ok"`
}
