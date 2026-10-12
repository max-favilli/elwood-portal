"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import axios from "axios";
import { apiError, getManagementSession, setManagementToken, type ManagementSession } from "@/lib/api";

const Session = createContext<ManagementSession | null>(null);
export const useManagementSession = () => useContext(Session);

export default function ManagementAccess({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<ManagementSession | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      const saved = sessionStorage.getItem("elwood-management-token");
      if (!saved) return;
      setManagementToken(saved);
      const restored = await getManagementSession();
      if (active) setSession(restored);
    }
    restoreSession().catch((failure) => {
      if (!active) return;
      if (axios.isAxiosError(failure) && failure.response?.status === 401) setManagementToken("");
      setError(apiError(failure));
    }).finally(() => { if (active) setBusy(false); });
    const expired = () => { setSession(null); setManagementToken(""); };
    window.addEventListener("elwood-session-expired", expired);
    return () => { active = false; window.removeEventListener("elwood-session-expired", expired); };
  }, []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    setManagementToken(token.trim());
    try { setSession(await getManagementSession()); setToken(""); }
    catch (failure) {
      setError(apiError(failure));
      if (axios.isAxiosError(failure) && failure.response?.status === 401) setManagementToken("");
    }
    finally { setBusy(false); }
  }

  const publicTool = pathname.startsWith("/tools/");
  return <Session.Provider value={session}>
    <div className="flex-1 min-w-0 flex flex-col h-full">
      {session && <div className="flex justify-end items-center gap-3 px-4 py-1 text-xs border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
        <span>{session.name}</span>
        <button onClick={() => { setSession(null); setManagementToken(""); }}>Sign out</button>
      </div>}
      <main className="flex-1 min-h-0 overflow-auto">
        {publicTool || session ? children : <div className="max-w-lg mx-auto mt-20 p-6 border border-[var(--color-border)] rounded">
          <h1 className="text-xl mb-3">Connect to management API</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">Enter your management access token. Your permissions determine which pipelines you can edit, test and deploy.</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">For local development, npm run dev:all prints the path to your token file. The token stays in this browser tab until you sign out or close it.</p>
          <form onSubmit={signIn} className="flex flex-col gap-3">
            <label htmlFor="management-token" className="text-sm">Management token</label>
            <input id="management-token" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="p-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-secondary)]" />
            {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
            <button disabled={busy || !token.trim()} className="p-2 rounded bg-[var(--color-accent)] text-white disabled:opacity-50">{busy ? "Connecting..." : "Connect"}</button>
          </form>
        </div>}
      </main>
    </div>
  </Session.Provider>;
}
