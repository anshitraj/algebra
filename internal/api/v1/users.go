package v1

import "net/http"

type createUserRequest struct {
	Email string `json:"email"`
}

type createUserResponse struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
}

// createUser is a dev-only bootstrap endpoint — see docs/LOCAL_DEVELOPMENT.md.
// There is no session system yet to authenticate a signup against (no OIDC
// provider configured in this environment), so this exists purely so
// agents and payment sources have a real users(id) row to reference.
func (a *API) createUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, err)
		return
	}
	user, err := a.b.Users.Create(r.Context(), req.Email)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, createUserResponse{UserID: user.ID, Email: user.Email})
}
