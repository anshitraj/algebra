import { getStoredIdentity } from "./identity";
import type {
  Approval,
  AuditEvent,
  ExecuteResult,
  Intent,
  IntentConstraints,
  IntentItem,
  Merchant,
  PaymentSource,
  PolicyDecision,
  Quote,
  Order,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type FetchOpts = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: "agent" | "user" | "none";
};

async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = "GET", body, headers = {}, auth = "agent" } = opts;
  const identity = getStoredIdentity();

  const finalHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth !== "none" && identity) {
    finalHeaders["Authorization"] = `Bearer ${identity.agentToken}`;
  }
  if (auth === "user" && identity) {
    finalHeaders["X-User-ID"] = identity.userId;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error ?? res.statusText;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

// --- identity ---

export function createUser(email: string) {
  return apiFetch<{ user_id: string; email: string }>("/api/v1/users", {
    method: "POST",
    body: { email },
    auth: "none",
  });
}

export function createAgent(userId: string, clientId: string, name: string, permissions: string[]) {
  return apiFetch<{ agent_id: string; token: string }>("/api/v1/agents", {
    method: "POST",
    body: { user_id: userId, client_id: clientId, name, permissions },
    auth: "none",
  });
}

// --- intents ---

export function createIntent(
  items: IntentItem[],
  constraints: IntentConstraints,
  idempotencyKey: string
) {
  return apiFetch<Intent>("/api/v1/intents", {
    method: "POST",
    body: { items, constraints },
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function getIntent(id: string) {
  return apiFetch<Intent>(`/api/v1/intents/${id}`);
}

export function cancelIntent(id: string) {
  return apiFetch<Intent>(`/api/v1/intents/${id}/cancel`, { method: "POST" });
}

export function discover(id: string) {
  return apiFetch<{ quotes: Quote[] }>(`/api/v1/intents/${id}/discover`, { method: "POST" });
}

export function getQuotes(id: string) {
  return apiFetch<{ quotes: Quote[] }>(`/api/v1/intents/${id}/quotes`);
}

export function selectQuote(id: string, quoteId: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/intents/${id}/select-quote`, {
    method: "POST",
    body: { quote_id: quoteId },
  });
}

export function requestPurchase(id: string) {
  return apiFetch<PolicyDecision>(`/api/v1/intents/${id}/request-purchase`, { method: "POST" });
}

export function policyPreview(id: string) {
  return apiFetch<PolicyDecision>(`/api/v1/intents/${id}/policy-preview`);
}

export function policyExplain(id: string) {
  return apiFetch<PolicyDecision>(`/api/v1/intents/${id}/policy-explain`);
}

export function execute(id: string, idempotencyKey: string) {
  return apiFetch<ExecuteResult>(`/api/v1/intents/${id}/execute`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function getOrder(id: string) {
  return apiFetch<Order>(`/api/v1/intents/${id}/order`);
}

export function getReceipt(id: string) {
  return apiFetch<Order>(`/api/v1/intents/${id}/receipt`);
}

export function cancelOrder(id: string) {
  return apiFetch<Order>(`/api/v1/intents/${id}/cancel-order`, { method: "POST" });
}

export function getAuditTrail(id: string) {
  return apiFetch<AuditEvent[]>(`/api/v1/intents/${id}/audit`);
}

// --- approvals ---

export function getApprovalForIntent(intentId: string) {
  return apiFetch<Approval>(`/api/v1/intents/${intentId}/approval`, { auth: "user" });
}

export function approveApproval(id: string) {
  return apiFetch<{ approval_id: string; status: string }>(`/api/v1/approvals/${id}/approve`, {
    method: "POST",
    auth: "user",
  });
}

export function rejectApproval(id: string) {
  return apiFetch<{ approval_id: string; status: string }>(`/api/v1/approvals/${id}/reject`, {
    method: "POST",
    auth: "user",
  });
}

export function reapproveApproval(id: string) {
  return apiFetch<{ approval_id: string; status: string }>(`/api/v1/approvals/${id}/reapprove`, {
    method: "POST",
    auth: "user",
  });
}

// --- payment sources ---

export function listPaymentSources() {
  return apiFetch<PaymentSource[]>("/api/v1/payment-sources");
}

export function addPaymentSource(providerNonce: string, alias: string, nickname?: string) {
  return apiFetch<PaymentSource>("/api/v1/payment-sources", {
    method: "POST",
    body: { provider_nonce: providerNonce, alias, nickname },
    auth: "user",
  });
}

export function revokePaymentSource(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/payment-sources/${id}/revoke`, {
    method: "POST",
    auth: "user",
  });
}

// --- merchants ---

export function listMerchants() {
  return apiFetch<Merchant[]>("/api/v1/merchants", { auth: "none" });
}

// --- shipping profiles ---

export type ShippingProfile = {
  recipient_name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
};

export function createShippingProfile(alias: string, profile: ShippingProfile) {
  return apiFetch<{ ok: boolean }>("/api/v1/profiles/shipping", {
    method: "POST",
    body: { alias, profile },
    auth: "user",
  });
}

export function listShippingAliases() {
  return apiFetch<string[]>("/api/v1/profiles/shipping", { auth: "user" });
}
