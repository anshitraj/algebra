import { NextResponse } from "next/server";
import { resolveProvider } from "@/lib/agent/models";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { getAgentToken, getCommerceProfile, getGuardrails, ServerApiError } from "@/lib/agent/server-client";
import type { AgentEvent } from "@/lib/agent/events";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ChatRequestBody = {
  provider?: string;
  model?: string;
  message?: string;
  history?: unknown[];
};

const MAX_MESSAGE_CHARS = 4000;

/**
 * POST /api/agent/chat runs one agent turn and streams it back as NDJSON
 * (see lib/agent/events.ts): a line per tool step as it starts and
 * finishes, interim text, an approval marker, then `done` with the reply
 * and the provider-native history to send back next turn.
 *
 * Identity comes only from the browser's session cookie: it's exchanged
 * server-side for the session's console-agent token, which every tool call
 * then uses. The browser never sends (or holds) an agent token, and the
 * agent token can't approve — approvals stay a human click.
 */
export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: `Keep messages under ${MAX_MESSAGE_CHARS} characters` }, { status: 400 });
  }

  const provider = resolveProvider(body.provider, body.model);
  if (!provider) {
    return NextResponse.json(
      { error: "No AI provider is configured on this server. Add ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY to web/.env.local." },
      { status: 503 }
    );
  }

  const cookie = request.headers.get("cookie") ?? "";
  let identity;
  try {
    identity = await getAgentToken(cookie);
  } catch (err) {
    const status = err instanceof ServerApiError ? err.status : 502;
    return NextResponse.json(
      { error: status === 401 ? "Your session expired — sign in again." : "Can't reach Algebra's API." },
      { status: status === 401 ? 401 : 502 }
    );
  }

  // Rebuilt every turn: a preference saved mid-chat or a guardrail edited in
  // another tab takes effect on the very next message.
  const [profile, guardrails] = await Promise.all([
    getCommerceProfile(identity).catch(() => null),
    getGuardrails(cookie).catch(() => null),
  ]);
  const systemPrompt = buildSystemPrompt(profile, guardrails);
  if (guardrails?.max_per_purchase_minor_units) identity = { ...identity, defaultBudgetMinor: guardrails.max_per_purchase_minor_units };
  const history = Array.isArray(body.history) ? body.history : [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (e: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          closed = true;
        }
      };
      try {
        const result = await provider.run({
          apiKey: provider.apiKey,
          model: provider.model,
          systemPrompt,
          history,
          userMessage: message,
          identity,
          emit,
          signal: request.signal,
        });
        emit({ type: "done", reply: result.reply, history: result.history, provider: provider.id, model: provider.model });
      } catch (err) {
        if (!request.signal.aborted) {
          const detail = err instanceof Error ? err.message : "The agent hit an error.";
          emit({ type: "error", error: friendlyProviderError(detail) });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by a client disconnect
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

function friendlyProviderError(detail: string) {
  if (/401|invalid.*api.?key|authentication/i.test(detail)) return "The AI provider rejected this server's API key.";
  if (/429|rate.?limit|quota/i.test(detail)) return "The AI provider is rate-limiting us. Wait a few seconds and try again.";
  if (/model.*(not found|does not exist)|404/i.test(detail)) return "That model isn't available on this API key. Pick another in the model menu.";
  return detail.length > 240 ? `${detail.slice(0, 240)}…` : detail;
}
