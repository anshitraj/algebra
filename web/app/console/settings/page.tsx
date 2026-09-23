"use client";

import { useEffect, useState } from "react";
import * as api from "@/lib/api-client";
import { useSession } from "@/lib/session";
import type { SessionInfo } from "@/lib/types";
import { GitHubMark, GoogleMark, IconCheck, IconMail, Spinner } from "@/components/icons";
import { Avatar } from "@/components/console/shell";
import { ErrorNote, PageHeader, Skeleton, timeAgo } from "@/components/console/ui";

function describeAgent(ua: string) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export default function SettingsPage() {
  const { user, setUser, signOut } = useSession();
  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load sessions"));
  }, []);

  if (!user) return null;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setError(null);
    try {
      setUser(await api.updateMe(name));
      setNameSaved(true);
      window.setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSavingName(false);
    }
  }

  async function revoke(id: string) {
    setRevoking(id);
    try {
      await api.revokeSession(id);
      setSessions((s) => s?.filter((x) => x.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign that device out");
    } finally {
      setRevoking(null);
    }
  }

  const methods = [
    { id: "password", label: "Email and password", icon: <IconMail size={18} />, on: user.has_password },
    { id: "google", label: "Google", icon: <GoogleMark size={18} />, on: user.linked_providers.includes("google") },
    { id: "github", label: "GitHub", icon: <GitHubMark size={18} />, on: user.linked_providers.includes("github") },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Account" description="Who you are to Algebra, how you sign in, and where you're signed in." />
      {error && (
        <div className="mt-6">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <section className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-center gap-4">
          <Avatar user={user} size={52} />
          <div className="min-w-0">
            <p className="truncate text-[0.95rem] font-medium text-foreground">{user.name || "No name yet"}</p>
            <p className="flex items-center gap-1.5 truncate text-sm text-muted">
              {user.email}
              {user.email_verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                  <IconCheck size={10} strokeWidth={3} /> Verified
                </span>
              )}
            </p>
          </div>
        </div>
        <form onSubmit={saveName} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="text-sm font-medium text-foreground">Display name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-1.5 h-11 w-full rounded-xl border border-border-strong bg-background px-3.5 text-[0.95rem] text-foreground focus-visible:border-primary focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={savingName || name.trim() === (user.name ?? "")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-tint disabled:opacity-40"
          >
            {savingName ? <Spinner size={14} /> : nameSaved ? <IconCheck size={15} /> : null}
            {nameSaved ? "Saved" : "Save"}
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-[0.95rem] font-semibold text-foreground">Sign-in methods</h2>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {methods.map((m) => (
            <li key={m.id} className="flex items-center gap-3.5 px-5 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background text-foreground">{m.icon}</span>
              <span className="flex-1 text-sm text-foreground">{m.label}</span>
              {m.on ? (
                <span className="text-xs font-medium text-primary">Connected</span>
              ) : m.id === "password" ? (
                <a href="/forgot-password" className="text-xs font-medium text-muted hover:text-foreground">
                  Set a password
                </a>
              ) : (
                <span className="text-xs text-muted">Sign in with {m.label} once to link it</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[0.95rem] font-semibold text-foreground">Where you&apos;re signed in</h2>
        <p className="mt-1 text-sm text-muted">Signing a device out also revokes the agent it was using.</p>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {sessions === null && (
            <li className="p-5">
              <Skeleton className="h-10" />
            </li>
          )}
          {sessions?.map((s) => (
            <li key={s.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  {describeAgent(s.user_agent)}
                  {s.current && <span className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-[0.7rem] font-medium text-primary">This device</span>}
                </p>
                <p className="text-xs text-muted">
                  {s.ip || "Unknown IP"} · active {timeAgo(s.last_seen_at)} · signed in {timeAgo(s.created_at)}
                </p>
              </div>
              {s.current ? (
                <button type="button" onClick={signOut} className="text-sm font-medium text-danger hover:underline">
                  Sign out
                </button>
              ) : (
                <button
                  type="button"
                  disabled={revoking === s.id}
                  onClick={() => revoke(s.id)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-danger disabled:opacity-50"
                >
                  {revoking === s.id && <Spinner size={13} />} Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
