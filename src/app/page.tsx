"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type ChatLog = {
  id: string;
  channel: string;
  text: string;
  ts: string;
};

type Usage = {
  id: string;
  model: string;
  tokens: number;
  costUsd: number;
  ts: string;
};

type Skill = {
  id: string;
  name: string;
  enabled: boolean;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const adminUser = process.env.NEXT_PUBLIC_ADMIN_USER ?? "admin";
const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASS ?? "openclaw";
const authStorageKey = "openclaw-admin-auth";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const tabs = ["Overview", "Chat History", "API Usage", "Skills"] as const;
type TabKey = (typeof tabs)[number];

export default function Home() {
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySkillId, setBusySkillId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("Overview");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const totalTokens = useMemo(
    () => usage.reduce((sum, item) => sum + item.tokens, 0),
    [usage]
  );
  const totalCost = useMemo(
    () => usage.reduce((sum, item) => sum + item.costUsd, 0),
    [usage]
  );
  const enabledSkills = useMemo(
    () => skills.filter((skill) => skill.enabled).length,
    [skills]
  );
  const latestChat = chatLogs[0];

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(authStorageKey);
    setIsAuthed(stored === "1");
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!isAuthed) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [chatRes, usageRes, skillsRes] = await Promise.all([
          fetch(`${apiBase}/api/chat-logs`),
          fetch(`${apiBase}/api/usage`),
          fetch(`${apiBase}/api/skills`),
        ]);

        if (!chatRes.ok || !usageRes.ok || !skillsRes.ok) {
          throw new Error("Backend returned an error.");
        }

        const chatData = await chatRes.json();
        const usageData = await usageRes.json();
        const skillsData = await skillsRes.json();

        setChatLogs(chatData.items ?? []);
        setUsage(usageData.items ?? []);
        setSkills(skillsData.items ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to reach the backend."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isAuthed]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    const user = loginUser.trim();
    const pass = loginPass;
    if (user === adminUser && pass === adminPass) {
      window.localStorage.setItem(authStorageKey, "1");
      setIsAuthed(true);
      setLoginUser("");
      setLoginPass("");
      return;
    }
    setLoginError("Invalid login. Check the test credentials.");
  };

  const handleLogout = () => {
    window.localStorage.removeItem(authStorageKey);
    setIsAuthed(false);
    setLoginUser("");
    setLoginPass("");
  };

  const toggleSkill = async (skill: Skill) => {
    setBusySkillId(skill.id);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/skills/${skill.id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !skill.enabled }),
      });
      let data: { item?: Skill; error?: string } | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to toggle skill.");
      }

      if (data?.item) {
        setSkills((prev) =>
          prev.map((item) => (item.id === skill.id ? data.item! : item))
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Toggle failed. Please retry."
      );
    } finally {
      setBusySkillId(null);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen px-6 py-10 text-[15px] text-[var(--ink)]">
        <div className="mx-auto w-full max-w-xl rounded-[28px] border border-black/10 bg-[var(--panel)] p-8 text-sm text-[var(--muted)] shadow-[0_20px_60px_-45px_rgba(0,0,0,0.35)]">
          Checking session...
        </div>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen px-6 py-10 text-[15px] text-[var(--ink)]">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <div className="rounded-[28px] border border-black/10 bg-[var(--panel)] p-8 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.35)]">
            <p className="text-sm uppercase tracking-[0.25em] text-[var(--muted)]">
              OpenClaw Admin
            </p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
              Admin Login
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Test login only. Replace with real auth when ready.
            </p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                  Username
                </label>
                <input
                  value={loginUser}
                  onChange={(event) => setLoginUser(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder="admin"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(event) => setLoginPass(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                  placeholder="openclaw"
                  autoComplete="current-password"
                />
              </div>
              {loginError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  {loginError}
                </div>
              ) : null}
              <button
                type="submit"
                className="w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-15px_rgba(0,0,0,0.55)]"
              >
                Sign in
              </button>
            </form>
            <p className="mt-5 text-xs text-[var(--muted)]">
              Test credentials: admin / openclaw (override via
              NEXT_PUBLIC_ADMIN_USER and NEXT_PUBLIC_ADMIN_PASS).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10 text-[15px] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-6 rounded-[28px] border border-black/10 bg-[var(--panel)] p-8 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.35)]">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-2xl font-semibold text-white shadow-[0_12px_30px_-15px_rgba(0,0,0,0.55)]">
                OC
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-[var(--muted)]">
                  OpenClaw Admin
                </p>
                <h1 className="font-[var(--font-display)] text-3xl font-semibold text-[var(--ink)]">
                  Multi-Agent Operations Console
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[var(--muted)]">
                Backend:{" "}
                <span className="font-semibold text-[var(--ink)]">
                  {apiBase}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)] transition hover:border-black/20 hover:text-[var(--ink)]"
              >
                Log out
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] transition ${
                  activeTab === tab
                    ? "border-transparent bg-[var(--accent)] text-white shadow-[0_10px_20px_-12px_rgba(0,0,0,0.55)]"
                    : "border-black/10 bg-white text-[var(--muted)] hover:border-black/20 hover:text-[var(--ink)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {error}
            </div>
          ) : null}
        </header>

        {activeTab === "Overview" ? (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[26px] border border-black/10 bg-white/80 p-6 backdrop-blur">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
                System Snapshot
              </h2>
              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-black/10 bg-white p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                    Routing
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                    Gemini Flash -&gt; Sonnet/Opus Escalation
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Model-router plugin dynamically selects the best tier.
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                    Memory
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                    Persistent OpenClaw Memory
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Local vector store with session-aware recall.
                  </p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                    Comms
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink)]">
                    Telegram + Email SLA
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Real-time replies and 15-minute email turnaround.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-[26px] border border-black/10 bg-white/80 p-6 backdrop-blur">
                <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
                  Activity Overview
                </h2>
                <div className="mt-5 grid gap-4">
                  <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                      Chat Entries
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                      {loading ? "..." : chatLogs.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                      Skills Enabled
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                      {loading ? "..." : `${enabledSkills}/${skills.length}`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                      Total Tokens
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                      {totalTokens.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4 text-sm text-[var(--muted)]">
                  {latestChat ? (
                    <>
                      <p className="text-xs uppercase tracking-[0.3em]">
                        Latest Message
                      </p>
                      <p className="mt-2 font-medium text-[var(--ink)]">
                        {latestChat.text}
                      </p>
                      <p className="mt-1 text-xs">
                        {latestChat.channel} •{" "}
                        {new Date(latestChat.ts).toLocaleString()}
                      </p>
                    </>
                  ) : (
                    "Waiting for the first inbound message."
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "Chat History" ? (
          <section className="rounded-[26px] border border-black/10 bg-white/80 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
                Chat History
              </h2>
              <span className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                {loading ? "Loading" : `${chatLogs.length} entries`}
              </span>
            </div>
            <div className="mt-6 space-y-4">
              {loading ? (
                <div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-[var(--muted)]">
                  Pulling chat history from the backend...
                </div>
              ) : chatLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-[var(--muted)]">
                  No chat logs yet. Once Telegram/email traffic comes in, entries
                  will appear here.
                </div>
              ) : (
                chatLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-[var(--muted)]">
                      <span>{log.channel}</span>
                      <span>{new Date(log.ts).toLocaleString()}</span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--ink)]">{log.text}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "API Usage" ? (
          <section className="rounded-[26px] border border-black/10 bg-white/80 p-6 backdrop-blur">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
              API Usage
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  Total Tokens
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                  {totalTokens.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-[var(--panel)] p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  Total Cost
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">
                  {formatMoney(totalCost)}
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {loading ? (
                <p className="text-sm text-[var(--muted)]">Loading usage...</p>
              ) : usage.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  OpenRouter usage will appear after the first task run.
                </p>
              ) : (
                usage.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-[var(--ink)]">
                        {item.model}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {new Date(item.ts).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[var(--ink)]">
                        {item.tokens.toLocaleString()} tokens
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatMoney(item.costUsd)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "Skills" ? (
          <section className="rounded-[26px] border border-black/10 bg-white/80 p-6 backdrop-blur">
            <h2 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--ink)]">
              Skills Control
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Toggle sub-agents without code changes. Disabled skills are blocked
              at runtime.
            </p>
            <div className="mt-5 space-y-3">
              {skills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => toggleSkill(skill)}
                  disabled={busySkillId === skill.id}
                  className={`flex w-full items-center justify-between rounded-2xl border border-black/10 px-4 py-3 text-left text-sm transition ${
                    skill.enabled ? "bg-[var(--panel)]" : "bg-white opacity-70"
                  } ${busySkillId === skill.id ? "cursor-wait" : "hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-20px_rgba(0,0,0,0.55)]"}`}
                >
                  <span className="font-medium text-[var(--ink)]">
                    {skill.name}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                      skill.enabled
                        ? "bg-[var(--accent-2)] text-white"
                        : "bg-black/10 text-[var(--muted)]"
                    }`}
                  >
                    {skill.enabled ? "Enabled" : "Paused"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
