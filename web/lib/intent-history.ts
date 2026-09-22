// Algebra's REST API has no "list my intents" endpoint (by design — see
// openapi/v1.yaml: every intent/approval/order route is scoped to a known
// {id}). This console keeps a local, browser-only index of intents it has
// created so Approvals/Orders/Dashboard have something to iterate over.
// It is a convenience list, not a system of record — the server-side
// audit trail (GET /intents/{id}/audit) is that.

export type TrackedIntent = {
  id: string;
  summary: string;
  createdAt: string;
};

const KEY = "algebra:intent-history";

export function getTrackedIntents(): TrackedIntent[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function trackIntent(entry: TrackedIntent): void {
  try {
    const existing = getTrackedIntents().filter((t) => t.id !== entry.id);
    const next = [entry, ...existing].slice(0, 50);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort — a missed history entry just means it won't show up
    // in Approvals/Orders until visited directly by ID
  }
}
