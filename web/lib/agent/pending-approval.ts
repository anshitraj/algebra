// Shared by all three provider loops: after any request_purchase tool call,
// check whether it landed on REQUIRE_APPROVAL so the route handler can
// surface it to the UI. Approval itself never goes through a tool — the
// browser resolves it via the console's existing approve/reject calls.

export type PendingApproval = { intentId: string };

export function detectPendingApproval(
  toolName: string,
  toolInput: Record<string, unknown>,
  result: { ok: boolean; data?: unknown }
): PendingApproval | undefined {
  if (toolName !== "request_purchase" || !result.ok) return undefined;
  const decision = (result.data as { decision?: string } | undefined)?.decision;
  if (decision !== "REQUIRE_APPROVAL") return undefined;
  const intentId = toolInput.intent_id;
  return typeof intentId === "string" && intentId ? { intentId } : undefined;
}
