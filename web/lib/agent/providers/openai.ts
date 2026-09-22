import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { AGENT_TOOLS } from "../tools";
import { executeTool } from "../execute-tool";
import { detectPendingApproval, type PendingApproval } from "../pending-approval";
import type { ProviderTurnInput, ProviderTurnResult } from "./types";

const MAX_TURNS = 8;

const TOOLS: ChatCompletionTool[] = AGENT_TOOLS.map((t) => ({
  type: "function",
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

export async function runTurn({
  apiKey,
  model,
  systemPrompt,
  history,
  userMessage,
  identity,
}: ProviderTurnInput): Promise<ProviderTurnResult> {
  const client = new OpenAI({ apiKey });
  const messages: ChatCompletionMessageParam[] = [...(history as ChatCompletionMessageParam[])];
  if (messages.length === 0) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userMessage });

  let pendingApproval: PendingApproval | undefined;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.chat.completions.create({ model, messages, tools: TOOLS });
    const message = response.choices[0].message;
    messages.push(message);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { reply: message.content ?? "", history: messages, pendingApproval };
    }

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments || "{}");
      } catch {
        // model produced malformed JSON args — executeTool below will fail
        // the missing-field checks and report that back to the model.
      }
      const result = await executeTool(call.function.name, input, identity);
      pendingApproval = detectPendingApproval(call.function.name, input, result) ?? pendingApproval;
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return {
    reply: "Stopped after too many tool calls in a row — ask me to continue if you'd like me to keep going.",
    history: messages,
    pendingApproval,
  };
}
