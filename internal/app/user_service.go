package app

import (
	"context"
	"time"
)

// UserRecord is intentionally minimal — full user profile management is
// out of scope for Phase 1 (no OIDC provider is configured in this
// environment; see docs/LOCAL_DEVELOPMENT.md). This exists so agents and
// payment sources have a real users(id) row to reference via foreign key,
// not to be a user-management system in its own right.
type UserRecord struct {
	ID        string
	Email     string
	CreatedAt time.Time
}

type UserStore interface {
	Create(ctx context.Context, id, email string, createdAt time.Time) error
	Get(ctx context.Context, id string) (*UserRecord, error)
}

type UserService struct {
	store UserStore
	now   func() time.Time
}

func NewUserService(store UserStore) *UserService {
	return &UserService{store: store, now: time.Now}
}

func (s *UserService) Create(ctx context.Context, email string) (*UserRecord, error) {
	rec := &UserRecord{ID: newID("user"), Email: email, CreatedAt: s.now()}
	if err := s.store.Create(ctx, rec.ID, rec.Email, rec.CreatedAt); err != nil {
		return nil, err
	}
	return rec, nil
}

func (s *UserService) Get(ctx context.Context, id string) (*UserRecord, error) {
	return s.store.Get(ctx, id)
}
