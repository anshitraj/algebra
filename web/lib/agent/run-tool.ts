import { executeTool, type ToolResult } from "./execute-tool";
import { detectPendingApproval, type PendingApproval } from "./pending-approval";
import { stepTitle, summarizeStep } from "./steps";
import type { EmitFn } from "./events";
import type { ServerIdentity } from "./server-client";

/**
 * runTool is the single path every provider loop uses to execute a tool
 * call: it streams a "running" step, runs the real API call, streams the
 * outcome, and reports a pending approval (never resolves one — approval is
 * a human click in the browser, not a tool).
 */
export async function runTool(
  name: string,
  input: Record<string, unknown>,
  identity: ServerIdentity,
  emit: EmitFn
): Promise<{ result: ToolResult; pendingApproval?: PendingApproval }> {
  const id = crypto.randomUUID();
  const title = stepTitle(name, input);
  emit({ type: "step", id, tool: name, status: "running", title });

  const result = await executeTool(name, input, identity);
  const outcome = summarizeStep(name, input, result);
  emit({ type: "step", id, tool: name, title, ...outcome });

  if (name === "execute_purchase" && result.ok) {
    const order = (result.data as { order?: { order_id?: string; merchant?: string; total?: { minor_units: number; currency: string } } })
      ?.order;
    if (order?.total) emit({ type: "spend", amount: order.total, orderId: order.order_id ?? "", merchant: order.merchant ?? "" });
  }

  const pendingApproval = detectPendingApproval(name, input, result);
  if (pendingApproval) emit({ type: "approval", intentId: pendingApproval.intentId });
  return { result, pendingApproval };
}
