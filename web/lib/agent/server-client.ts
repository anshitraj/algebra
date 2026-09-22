// Server-side counterpart to ../api-client.ts, for use inside Next.js route
// handlers only. api-client.ts reads identity from window.localStorage and
// cannot run server-side, so this takes identity explicitly on every call
// instead. Wraps only the endpoints the agent's tools need — see tools.ts.

import type {
  AuditEvent,
  ExecuteResult,
  Intent,
  IntentConstraints,
  IntentItem,
  Merchant,
  Order,
  PolicyDecision,
  Quote,
} from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type ServerIdentity = {
  userId: string;
  agentToken: string;
};

export class ServerApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ServerApiError";
    this.status = status;
  }
}

type FetchOpts = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function apiFetch<T>(path: string, identity: ServerIdentity | null, opts: FetchOpts = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = opts;

  const finalHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (identity) finalHeaders["Authorization"] = `Bearer ${identity.agentToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error ?? res.statusText;
    throw new ServerApiError(res.status, message);
  }
  return data as T;
}

export function createIntent(
  identity: ServerIdentity,
  items: IntentItem[],
  constraints: IntentConstraints,
  idempotencyKey: string
) {
  return apiFetch<Intent>("/api/v1/intents", identity, {
    method: "POST",
    body: { items, constraints },
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function discover(identity: ServerIdentity, id: string) {
  return apiFetch<{ quotes: Quote[] }>(`/api/v1/intents/${id}/discover`, identity, { method: "POST" });
}

export function getQuotes(identity: ServerIdentity, id: string) {
  return apiFetch<{ quotes: Quote[] }>(`/api/v1/intents/${id}/quotes`, identity);
}

export function selectQuote(identity: ServerIdentity, id: string, quoteId: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/intents/${id}/select-quote`, identity, {
    method: "POST",
    body: { quote_id: quoteId },
  });
}

export function requestPurchase(identity: ServerIdentity, id: string) {
  return apiFetch<PolicyDecision>(`/api/v1/intents/${id}/request-purchase`, identity, { method: "POST" });
}

export function execute(identity: ServerIdentity, id: string, idempotencyKey: string) {
  return apiFetch<ExecuteResult>(`/api/v1/intents/${id}/execute`, identity, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function getOrder(identity: ServerIdentity, id: string) {
  return apiFetch<Order>(`/api/v1/intents/${id}/order`, identity);
}

export function getAuditTrail(identity: ServerIdentity, id: string) {
  return apiFetch<AuditEvent[]>(`/api/v1/intents/${id}/audit`, identity);
}

export function cancelIntent(identity: ServerIdentity, id: string) {
  return apiFetch<Intent>(`/api/v1/intents/${id}/cancel`, identity, { method: "POST" });
}

export function listMerchants() {
  return apiFetch<Merchant[]>("/api/v1/merchants", null);
}
