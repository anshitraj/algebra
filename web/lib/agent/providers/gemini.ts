import { GoogleGenAI } from "@google/genai";
import type { Content, FunctionDeclaration } from "@google/genai";
import { AGENT_TOOLS } from "../tools";
import { executeTool } from "../execute-tool";
import { detectPendingApproval, type PendingApproval } from "../pending-approval";
import type { ProviderTurnInput, ProviderTurnResult } from "./types";

const MAX_TURNS = 8;

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
}: ProviderTurnInput): Promise<ProviderTurnResult> {
  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = [...(history as Content[]), { role: "user", parts: [{ text: userMessage }] }];
  let pendingApproval: PendingApproval | undefined;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: DECLARATIONS }],
      },
    });

    const modelContent = response.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return { reply: response.text ?? "", history: contents, pendingApproval };
    }

    const responseParts = [];
    for (const call of calls) {
      const name = call.name ?? "";
      const input = (call.args ?? {}) as Record<string, unknown>;
      const result = await executeTool(name, input, identity);
      pendingApproval = detectPendingApproval(name, input, result) ?? pendingApproval;
      responseParts.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: result as unknown as Record<string, unknown>,
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return {
    reply: "Stopped after too many tool calls in a row — ask me to continue if you'd like me to keep going.",
    history: contents,
    pendingApproval,
  };
}
