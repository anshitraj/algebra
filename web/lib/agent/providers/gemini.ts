import { GoogleGenAI } from "@google/genai";
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { AGENT_TOOLS } from "../tools";
import { runTool } from "../run-tool";
import type { PendingApproval } from "../pending-approval";
import { MAX_TOOL_ROUNDS, TOO_MANY_ROUNDS_REPLY, type ProviderTurnInput, type ProviderTurnResult } from "./types";

const DECLARATIONS: FunctionDeclaration[] = AGENT_TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.parameters,
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
  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = [...(history as Content[]), { role: "user", parts: [{ text: userMessage }] }];
  let pendingApproval: PendingApproval | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: DECLARATIONS }],
        abortSignal: signal,
      },
    });

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const calls = response.functionCalls ?? [];
    const text = (modelContent?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (calls.length === 0) {
      return { reply: text || response.text || "", history: contents, pendingApproval };
    }
    if (text) emit({ type: "text", text });

    const responseParts: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      const input = (call.args ?? {}) as Record<string, unknown>;
      const { result, pendingApproval: pa } = await runTool(name, input, identity, emit);
      pendingApproval = pa ?? pendingApproval;
      responseParts.push({
        functionResponse: { id: call.id, name: call.name, response: result as unknown as Record<string, unknown> },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { reply: TOO_MANY_ROUNDS_REPLY, history: contents, pendingApproval };
}
