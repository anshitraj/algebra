import { AgentChat } from "@/components/console/agent-chat";

export default function AgentPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Agent</h1>
      <p className="mt-1.5 text-sm text-muted">
        Chat with an LLM that calls Algebra&apos;s real REST API — create intent, discover, select quote,
        request purchase, execute — on your behalf. Policy still runs for real: a{" "}
        <code className="font-mono text-xs">REQUIRE_APPROVAL</code> decision always needs your click below,
        never the model&apos;s.
      </p>
      <div className="mt-8">
        <AgentChat />
      </div>
    </div>
  );
}
