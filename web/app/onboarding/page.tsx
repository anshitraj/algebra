import type { Metadata } from "next";
import { SessionProvider } from "@/lib/session";
import { OnboardingFlow } from "@/components/onboarding/flow";

export const metadata: Metadata = { title: "Set up your agent — Algebra" };

export default function OnboardingPage() {
  return (
    <SessionProvider required>
      <OnboardingFlow />
    </SessionProvider>
  );
}
