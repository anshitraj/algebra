import type { ServerIdentity } from "../server-client";
import type { PendingApproval } from "../pending-approval";

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
};

export type ProviderTurnResult = {
  reply: string;
  history: unknown[];
  pendingApproval?: PendingApproval;
};
