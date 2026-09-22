package v1

import "net/http"

type createIntegratorRequest struct {
	Name string `json:"name"`
}

type createIntegratorResponse struct {
	IntegratorID string `json:"integrator_id"`
	Token        string `json:"token"` // shown exactly once
}

// createIntegrator mints a new Integrator bearer token — the B2B
// counterpart to createAgent, for a third-party app (a wallet, a checkout
// provider) that wants to call POST /policy/evaluate-transaction. Open,
// like createAgent: nothing to authorize this against yet in this build.
func (a *API) createIntegrator(w http.ResponseWriter, r *http.Request) {
	var req createIntegratorRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	token, integ, err := a.b.IntegratorSvc.CreateIntegrator(r.Context(), req.Name)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, createIntegratorResponse{IntegratorID: integ.ID, Token: token})
}

func (a *API) revokeIntegrator(w http.ResponseWriter, r *http.Request) {
	if err := a.b.IntegratorSvc.Revoke(r.Context(), r.PathValue("id")); err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, okResponse{OK: true})
}
