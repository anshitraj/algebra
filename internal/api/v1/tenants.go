package v1

import (
	"fmt"
	"net/http"

	"github.com/project-algebra/algebra/internal/domain/shared"
	"github.com/project-algebra/algebra/internal/domain/tenant"
)

type createTenantRequest struct {
	Name string `json:"name"`
}

type createTenantResponse struct {
	TenantID string `json:"tenant_id"`
	Token    string `json:"token"` // shown exactly once
}

// createTenant mints a new Tenant bearer token — the B2B root credential a
// business integration authenticates its own admin operations with. Open,
// like createAgent/createIntegrator: a business registers itself, there is
// nothing to authorize this against yet in this build.
func (a *API) createTenant(w http.ResponseWriter, r *http.Request) {
	var req createTenantRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	token, t, err := a.b.TenantSvc.CreateTenant(r.Context(), req.Name)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, createTenantResponse{TenantID: t.ID, Token: token})
}

func (a *API) revokeTenant(w http.ResponseWriter, r *http.Request) {
	if err := a.b.TenantSvc.Revoke(r.Context(), r.PathValue("id")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, okResponse{OK: true})
}

// requireOwnTenant checks the resolved tenant's ID matches the {id} path
// segment on a /tenants/{id}/... route — without this, any valid tenant
// token could read or modify a DIFFERENT tenant's policy/webhooks/
// transactions just by guessing its ID in the URL.
func requireOwnTenant(t *tenant.Tenant, pathID string) error {
	if pathID != t.ID {
		return fmt.Errorf("%w: token does not match tenant %s", shared.ErrUnauthorized, pathID)
	}
	return nil
}
