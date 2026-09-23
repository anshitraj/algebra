import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, TextBlock, Tool, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { AGENT_TOOLS } from "../tools";
import { runTool } from "../run-tool";
import type { PendingApproval } from "../pending-approval";
import { MAX_TOOL_ROUNDS, TOO_MANY_ROUNDS_REPLY, type ProviderTurnInput, type ProviderTurnResult } from "./types";

// The tool list is identical on every call, so it's marked as a prompt-cache
// breakpoint (on the last tool) — repeat turns re-read it from cache.
const TOOLS: Tool[] = AGENT_TOOLS.map((t, i) => ({
  name: t.name,
  description: t.description,
  input_schema: t.parameters,
  ...(i === AGENT_TOOLS.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
}));

export async function runTurn({
  apiKey,
  model,
  systemPrompt,
  history,
  userMessage,
  identity,
  emit,
  signal,
}: ProviderTurnInput): Promise<ProviderTurnResult> {
  const client = new Anthropic({ apiKey });
  const messages: MessageParam[] = [...(history as MessageParam[]), { role: "user", content: userMessage }];
  let pendingApproval: PendingApproval | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create(
      {
        model,
        max_tokens: 4096,
        system: [{ type: "text", text: systemPrompt }],
        tools: TOOLS,
        messages,
      },
      { signal }
    );

    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;

    const text = response.content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const toolUses = response.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      return { reply: text, history: messages, pendingApproval };
    }
    if (text) emit({ type: "text", text });

    const results: ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const input = (use.input ?? {}) as Record<string, unknown>;
      const { result, pendingApproval: pa } = await runTool(use.name, input, identity, emit);
      pendingApproval = pa ?? pendingApproval;
      results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(result), is_error: !result.ok });
    }
    messages.push({ role: "user", content: results });
  }

  return { reply: TOO_MANY_ROUNDS_REPLY, history: messages, pendingApproval };
}
