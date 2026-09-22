"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button, Field, Input } from "./ui";
import { useIdentity } from "@/lib/identity-context";
import * as api from "@/lib/api-client";

const AGENT_PERMISSIONS = [
  "shopping.read",
  "shopping.create_intent",
  "shopping.execute",
  "payments.request",
  "orders.read",
  "profiles.read",
  "policy.read",
];

export function Connect() {
  const { setIdentity } = useIdentity();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.createUser(email.trim());
      const agent = await api.createAgent(
        user.user_id,
        "algebra-console",
        "Console session",
        AGENT_PERMISSIONS
      );
      setIdentity({
        userId: user.user_id,
        email: user.email,
        agentId: agent.agent_id,
        agentToken: agent.token,
        agentName: "Console session",
      });

      // A shipping address is required for the mock connector to complete
      // checkout (resolveFulfillment has nothing to resolve otherwise —
      // see test/e2e's mustSeedShipping). Seed a clearly-labeled dev
      // address under the alias the new-intent form defaults to, so the
      // core loop below can actually reach an order rather than stalling
      // on a missing profile.
      await api.createShippingProfile("shipping:home", {
        recipient_name: "Algebra Console",
        line1: "1 Dev Console Way",
        city: "Bengaluru",
        state: "KA",
        postal_code: "560001",
        country: "IN",
        phone: "+910000000000",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={34} className="text-primary" />
          <h1 className="font-display mt-5 text-xl font-semibold tracking-tight text-foreground">
            Connect a dev identity
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            No login exists yet — this mints a fresh user + agent token via{" "}
            <code className="font-mono text-xs">POST /users</code> and{" "}
            <code className="font-mono text-xs">POST /agents</code>, stored
            only in this browser. Not a real account system.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Field label="Email" hint="Any value — nothing is verified in dev mode.">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Connecting…" : "Connect"}
          </Button>
        </form>
      </div>
    </div>
  );
}
