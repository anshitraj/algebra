import { NextResponse } from "next/server";
import * as anthropicProvider from "@/lib/agent/providers/anthropic";
import * as openaiProvider from "@/lib/agent/providers/openai";
import * as geminiProvider from "@/lib/agent/providers/gemini";
import { AGENT_SYSTEM_PROMPT } from "@/lib/agent/system-prompt";
import type { ProviderTurnInput } from "@/lib/agent/providers/types";
import type { ServerIdentity } from "@/lib/agent/server-client";

export type AgentProviderId = "anthropic" | "openai" | "gemini";

const PROVIDERS: Record<
  AgentProviderId,
  {
    run: (input: ProviderTurnInput) => ReturnType<typeof anthropicProvider.runTurn>;
    envKey: string;
    modelEnvKey: string;
    defaultModel: string;
  }
> = {
  anthropic: {
    run: anthropicProvider.runTurn,
    envKey: "ANTHROPIC_API_KEY",
    modelEnvKey: "ANTHROPIC_MODEL",
    defaultModel: "claude-sonnet-5",
  },
  openai: {
    run: openaiProvider.runTurn,
    envKey: "OPENAI_API_KEY",
    modelEnvKey: "OPENAI_MODEL",
    defaultModel: "gpt-4o",
  },
  gemini: {
    run: geminiProvider.runTurn,
    envKey: "GEMINI_API_KEY",
    modelEnvKey: "GEMINI_MODEL",
    defaultModel: "gemini-flash-latest",
  },
};

type ChatRequestBody = {
  provider?: AgentProviderId;
  message?: string;
  history?: unknown[];
  identity?: ServerIdentity;
};

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, message, history, identity } = body;

  if (!provider || !(provider in PROVIDERS)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (!identity?.userId || !identity?.agentToken) {
    return NextResponse.json({ error: "identity is required" }, { status: 400 });
  }

  const config = PROVIDERS[provider];
  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    return NextResponse.json(
      { error: `${provider} is not configured on the server (missing ${config.envKey})` },
      { status: 400 }
    );
  }
  const model = process.env[config.modelEnvKey] || config.defaultModel;

  try {
    const result = await config.run({
      apiKey,
      model,
      systemPrompt: AGENT_SYSTEM_PROMPT,
      history: Array.isArray(history) ? history : [],
      userMessage: message,
      identity,
    });
    return NextResponse.json(result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Agent turn failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
