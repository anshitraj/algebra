.PHONY: dev-up dev-down build test test-integration lint fmt vet

dev-up:
	docker compose up -d
	@echo "Postgres on :5432, Redis on :6379. Copy .env.example to .env and fill ALGEBRA_MASTER_KEY."

dev-down:
	docker compose down

build:
	go build ./...

fmt:
	gofmt -l -w .

vet:
	go vet ./...

test:
	go test ./...

# Requires dev-up first (needs a live DATABASE_URL/ALGEBRA_MASTER_KEY in the
# environment) — tests that need Postgres skip themselves otherwise, see
# internal/platform/postgres and test/e2e. See docs/LOCAL_DEVELOPMENT.md.
test-integration:
	go test ./internal/platform/postgres/... ./test/e2e/... -v
