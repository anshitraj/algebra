// Dev-mode identity — mirrors internal/api/v1's currentUserID doc comment
// exactly: this is NOT a real account system. There is no login endpoint;
// POST /users + POST /agents mint a fresh identity that the browser then
// asserts on every call via Authorization/X-User-ID. See
// docs/LOCAL_DEVELOPMENT.md.

export type StoredIdentity = {
  userId: string;
  email: string;
  agentId: string;
  agentToken: string;
  agentName: string;
};

const KEY = "algebra:identity";

export function getStoredIdentity(): StoredIdentity | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !parsed?.agentToken) return null;
    return parsed as StoredIdentity;
  } catch {
    return null;
  }
}

export function setStoredIdentity(identity: StoredIdentity): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // private browsing / blocked storage — the session still works for
    // this page load, it just won't survive a reload.
  }
}

export function clearStoredIdentity(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to clean up if storage was never writable
  }
}
