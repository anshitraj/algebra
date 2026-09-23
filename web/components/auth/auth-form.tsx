"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import * as api from "@/lib/api-client";
import type { AuthProviders, User } from "@/lib/types";
import { GitHubMark, GoogleMark } from "@/components/icons";
import { AuthInput, FormError, PasswordInput, SubmitButton } from "./fields";

type Mode = "login" | "signup";

function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export function destinationFor(user: User, next: string | null) {
  if (!user.onboarded) return "/onboarding";
  return safeNext(next) ?? "/console/agent";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));

  useEffect(() => {
    api.getAuthProviders().then(setProviders).catch(() => setProviders({ password: true, google: false, github: false }));
    // Already signed in? Skip the form.
    api
      .getSession()
      .then(({ user }) => {
        if (user) router.replace(destinationFor(user, next));
      })
      .catch(() => {});
  }, [router, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = mode === "signup" ? await api.signUp(name, email, password) : await api.signIn(email, password);
      router.replace(destinationFor(user, next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";
  const anyOAuth = providers?.google || providers?.github;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {isSignup ? "Already have an account? " : "New to Algebra? "}
        <Link
          href={`${isSignup ? "/login" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>

      <div className="mt-8 grid gap-2.5">
        <OAuthButton provider="github" enabled={!!providers?.github} loading={!providers} next={next}>
          <GitHubMark size={18} /> Continue with GitHub
        </OAuthButton>
        <OAuthButton provider="google" enabled={!!providers?.google} loading={!providers} next={next}>
          <GoogleMark size={18} /> Continue with Google
        </OAuthButton>
        {providers && !anyOAuth && (
          <p className="text-xs leading-relaxed text-muted">
            Google and GitHub sign-in appear here once their OAuth client IDs are set on the API server.
          </p>
        )}
      </div>

      <div className="my-7 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        {isSignup && (
          <AuthInput
            label="Full name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
            maxLength={80}
          />
        )}
        <AuthInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoFocus={!isSignup}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={isSignup ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignup ? "At least 8 characters" : "Your password"}
          trailing={
            !isSignup ? (
              <Link href="/forgot-password" className="text-xs font-medium text-muted hover:text-foreground">
                Forgot password?
              </Link>
            ) : undefined
          }
        />
        {isSignup && password.length > 0 && <StrengthHint password={password} />}
        {!isSignup && params.get("reset") === "1" && !error && (
          <p role="status" className="rounded-xl bg-primary-tint px-3.5 py-2.5 text-sm text-primary">
            Password updated. Sign in with your new password.
          </p>
        )}
        {error && <FormError>{error}</FormError>}
        <SubmitButton busy={busy}>{isSignup ? "Create account" : "Sign in"}</SubmitButton>
      </form>

      {isSignup && (
        <p className="mt-6 text-xs leading-relaxed text-muted">
          By creating an account you agree that Algebra acts only within the guardrails you set, and that anything above
          them waits for your approval.
        </p>
      )}
    </motion.div>
  );
}

function OAuthButton({
  provider,
  enabled,
  loading,
  next,
  children,
}: {
  provider: "google" | "github";
  enabled: boolean;
  loading: boolean;
  next: string | null;
  children: React.ReactNode;
}) {
  const className =
    "flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border-strong bg-surface text-[0.95rem] font-medium text-foreground transition-[background-color,transform] hover:bg-primary-tint/70 active:scale-[0.99]";
  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title={loading ? undefined : `${provider === "google" ? "Google" : "GitHub"} sign-in isn't configured on this server`}
        className={`${className} cursor-not-allowed opacity-45 hover:bg-surface`}
      >
        {children}
      </button>
    );
  }
  // A full navigation, not fetch: the OAuth dance is redirects all the way.
  return (
    <a href={api.oauthStartURL(provider, next)} className={className}>
      {children}
    </a>
  );
}

function StrengthHint({ password }: { password: string }) {
  const len = password.length;
  const varied = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const score = len < 8 ? 0 : len >= 14 || (len >= 10 && varied >= 3) ? 2 : 1;
  const label = ["Too short — 8 characters minimum", "Good", "Strong"][score];
  return (
    <div className="flex items-center gap-2.5" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= score && len > 0 ? (score === 0 ? "bg-danger" : score === 1 ? "bg-accent" : "bg-primary") : "bg-border"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
