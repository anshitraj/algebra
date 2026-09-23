import Link from "next/link";
import { Container } from "./container";
import { Logo } from "./logo";
import { DecisionStrip } from "./decision-strip";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-8 md:pt-20 md:pb-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-primary/[0.08] blur-3xl md:h-[560px] md:w-[560px]"
      />
      <Container className="relative grid gap-14 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-10">
        <div>
          <h1 className="font-display text-[2.75rem] leading-[1.04] font-semibold tracking-tight text-balance text-foreground md:text-[3.75rem]">
            Give agents permission to spend,
            <span className="text-primary"> not access to money.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-muted">
            Algebra turns a plain-language instruction into discovery, a
            server-side policy decision, user approval, and merchant
            checkout — without ever handing the agent a card number, a
            wallet key, or an OTP.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-tint shadow-[0_8px_20px_-10px_color-mix(in_srgb,var(--color-primary)_85%,transparent)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started free
            </Link>
            <a
              href="#get-started"
              className="text-sm font-medium text-foreground underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-foreground"
            >
              See the four steps
            </a>
          </div>

          <div className="mt-10 flex items-center gap-3 text-xs text-muted">
            <Logo size={18} className="opacity-70" />
            <span>
              Policy decisions are computed server-side and cannot be
              overridden by an LLM.
            </span>
          </div>
        </div>

        <div className="flex justify-center md:justify-end">
          <DecisionStrip />
        </div>
      </Container>
    </section>
  );
}
