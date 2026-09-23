import type { ServerIdentity } from "../server-client";
import type { PendingApproval } from "../pending-approval";
import type { EmitFn } from "../events";

// Each provider owns its own native message-history shape internally
// (Anthropic MessageParam[], OpenAI ChatCompletionMessageParam[], Gemini
// Content[]) — history crosses this boundary as an opaque unknown[] that
// the route handler persists and replays without inspecting.
export type ProviderTurnInput = {
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: unknown[];
  userMessage: string;
  identity: ServerIdentity;
  /** Streams tool steps and interim text to the browser as they happen. */
  emit: EmitFn;
  signal?: AbortSignal;
};

export type ProviderTurnResult = {
  reply: string;
  history: unknown[];
  pendingApproval?: PendingApproval;
};

export const MAX_TOOL_ROUNDS = 12;

export const TOO_MANY_ROUNDS_REPLY =
  "I stopped after a long run of steps without finishing — say “continue” and I'll pick up where I left off.";
