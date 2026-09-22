"use client";

import { motion } from "motion/react";
import { Container } from "./container";

const steps = [
  {
    n: "01",
    title: "Agent",
    body: "Turns a user instruction into a structured PurchaseIntent — items, budget, category, merchant preferences.",
  },
  {
    n: "02",
    title: "Discovery",
    body: "Algebra's merchant connectors search, quote, and apply coupons — the agent never talks to a merchant directly.",
  },
  {
    n: "03",
    title: "Policy",
    body: "A deterministic engine decides ALLOW, DENY, or REQUIRE_APPROVAL from persisted state. An LLM cannot override this.",
    emphasize: true,
  },
  {
    n: "04",
    title: "Approval",
    body: "When policy requires it, a human approves — bound to the merchant, items, amount, and payment source.",
  },
  {
    n: "05",
    title: "Merchant",
    body: "Checkout runs against the real connector: Zepto, Swiggy Instamart, Amazon, Flipkart, or a handoff link.",
  },
  {
    n: "06",
    title: "Order",
    body: "A receipt and an append-only audit trail — every decision, every approval, every charge.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="pt-20 pb-6 md:pt-28 md:pb-10">
      <Container>
        <h2 className="font-display max-w-lg text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          One request, six checkpoints.
        </h2>
        <p className="mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-muted">
          Every purchase — agent-initiated or not — passes through the same
          six stages. Nothing skips the gate.
        </p>

        <div className="mt-16 grid gap-x-8 gap-y-12 md:grid-cols-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              className={`relative ${step.emphasize ? "md:-mt-3" : ""}`}
            >
              {i > 0 && (
                <motion.span
                  aria-hidden="true"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.07 }}
                  style={{ transformOrigin: "left" }}
                  className="absolute top-[0.65rem] right-full hidden h-px w-8 bg-border-strong md:block"
                />
              )}
              <div
                className={`font-mono text-xs ${step.emphasize ? "text-primary" : "text-muted"}`}
              >
                {step.n}
              </div>
              <h3
                className={`font-display mt-2 text-lg font-semibold tracking-tight ${
                  step.emphasize ? "text-primary" : "text-foreground"
                }`}
              >
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
