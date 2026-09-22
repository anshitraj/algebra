import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { AGENT_TOOLS } from "../tools";
import { executeTool } from "../execute-tool";
import { detectPendingApproval, type PendingApproval } from "../pending-approval";
import type { ProviderTurnInput, ProviderTurnResult } from "./types";

const MAX_TURNS = 8;

const TOOLS: Tool[] = AGENT_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters,
}));

export async function runTurn({
  apiKey,
  model,
  systemPrompt,
  history,
  userMessage,
  identity,
}: ProviderTurnInput): Promise<ProviderTurnResult> {
  const client = new Anthropic({ apiKey });
  const messages: MessageParam[] = [...(history as MessageParam[]), { role: "user", content: userMessage }];
  let pendingApproval: PendingApproval | undefined;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "pause_turn") continue;

    const toolUses = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const text = response.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return { reply: text, history: messages, pendingApproval };
    }

    const results: ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const input = (use.input ?? {}) as Record<string, unknown>;
      const result = await executeTool(use.name, input, identity);
      pendingApproval = detectPendingApproval(use.name, input, result) ?? pendingApproval;
      results.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: JSON.stringify(result),
        is_error: !result.ok,
      });
    }
    messages.push({ role: "user", content: results });
  }

  return {
    reply: "Stopped after too many tool calls in a row — ask me to continue if you'd like me to keep going.",
    history: messages,
    pendingApproval,
  };
}
