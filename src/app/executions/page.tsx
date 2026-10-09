"use client";

import { useEffect, useState } from "react";
import ExecutionInspector from "@/components/ExecutionInspector";
import RecoveryActions from "@/components/RecoveryActions";
import { getExecution, listExecutions, type ExecutionState } from "@/lib/api";
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Search, FlaskConical } from "lucide-react";

const STATUS_LABELS: Record<number | string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  0: { label: "Pending", color: "text-[var(--color-text-muted)]", icon: Clock },
  1: { label: "Running", color: "text-[var(--color-accent)]", icon: Loader2 },
  2: { label: "Completed", color: "text-[var(--color-success)]", icon: CheckCircle2 },
  3: { label: "Failed", color: "text-[var(--color-error)]", icon: XCircle },
  4: { label: "Waiting to retry", color: "text-[var(--color-accent)]", icon: Clock },
  5: { label: "Awaiting review", color: "text-[var(--color-error)]", icon: Clock },
  6: { label: "Skipped", color: "text-[var(--color-text-muted)]", icon: CheckCircle2 },
  Skipped: { label: "Skipped", color: "text-[var(--color-text-muted)]", icon: CheckCircle2 },
  Pending: { label: "Pending", color: "text-[var(--color-text-muted)]", icon: Clock },
  Running: { label: "Running", color: "text-[var(--color-accent)]", icon: Loader2 },
  Completed: { label: "Completed", color: "text-[var(--color-success)]", icon: CheckCircle2 },
  Failed: { label: "Failed", color: "text-[var(--color-error)]", icon: XCircle },
  Retrying: { label: "Waiting to retry", color: "text-[var(--color-accent)]", icon: Clock },
  AwaitingReview: { label: "Awaiting review", color: "text-[var(--color-error)]", icon: Clock },
};

function getStatus(status: number | string) {
  return STATUS_LABELS[status] ?? STATUS_LABELS[0];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<ExecutionState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showTests, setShowTests] = useState<"all" | "real" | "test">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { loadExecutions(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const refresh = async () => {
      try {
        const data = await getExecution(selectedId);
        if (active) setExecutions(current => current.some(e => e.executionId === data.executionId)
          ? current.map(e => e.executionId === data.executionId ? data : e) : [data, ...current]);
      } catch { /* Keep the last snapshot visible; explicit refresh displays API errors. */ }
    };
    const timer = setInterval(refresh, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [selectedId]);

  async function loadExecutions() {
    setLoading(true);
    setError(null);
    try {
      const data = await listExecutions();
      // Sort newest first
      data.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setExecutions(data);
    } catch {
      setError("Failed to load executions. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  const filtered = executions.filter(e => {
    // Text filter
    if (filter && !e.pipelineName.toLowerCase().includes(filter.toLowerCase()) &&
        !e.executionId.toLowerCase().includes(filter.toLowerCase()))
      return false;
    // Test/real filter
    if (showTests === "real" && e.isTest) return false;
    if (showTests === "test" && !e.isTest) return false;
    return true;
  });

  const selected = selectedId ? executions.find(e => e.executionId === selectedId) : null;

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-[450px] flex-shrink-0 flex flex-col border-r border-[var(--color-border)]">
        <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--color-border)]">
          <h1 className="text-sm font-semibold">Executions</h1>
          <button onClick={loadExecutions}
            className="p-1.5 rounded hover:bg-[var(--color-bg-hover)]" title="Refresh">
            <RefreshCw size={14} className={`text-[var(--color-text-muted)] ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-[var(--color-border)] space-y-2">
          <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-2 py-1.5">
            <Search size={12} className="text-[var(--color-text-muted)]" />
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by pipeline or ID..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--color-text-muted)]" />
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {(["all", "real", "test"] as const).map((v) => (
              <button key={v} onClick={() => setShowTests(v)}
                className={`px-2 py-0.5 rounded ${showTests === v
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}>
                {v === "all" ? "All" : v === "real" ? "Deployed" : "Tests"}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 text-xs text-[var(--color-error)]">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-xs text-[var(--color-text-muted)]">
              {executions.length === 0 ? "No executions yet. Run a pipeline to see results here." : "No matches."}
            </div>
          )}
          {filtered.map((exec) => {
            const s = getStatus(exec.status);
            const Icon = s.icon;
            return (
              <button
                key={exec.executionId}
                onClick={() => setSelectedId(exec.executionId)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] transition-colors ${
                  selectedId === exec.executionId
                    ? "bg-[var(--color-bg-active)]"
                    : "hover:bg-[var(--color-bg-hover)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{exec.pipelineName}</span>
                    {exec.isTest && (
                      <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                        <FlaskConical size={9} />
                        {exec.testMode === "mock" ? "mock test" : exec.testMode === "real" ? "real-system test" : "test"}
                      </span>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 text-[10px] ${s.color}`}>
                    <Icon size={11} />
                    {s.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                  <span>{formatTime(exec.startedAt)}</span>
                  <span>{formatDuration(exec.durationMs)}</span>
                </div>
                <div className="text-[9px] text-[var(--color-text-muted)] mt-0.5 font-mono truncate">
                  {exec.executionId}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto p-6">
        {!selected ? (
          <div className="text-sm text-[var(--color-text-muted)] text-center mt-20">
            Select an execution to view details
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-semibold">{selected.pipelineName}</h2>
              <p className="text-xs text-[var(--color-text-muted)]" title={selected.revisionId}>Revision: {selected.revisionId?.slice(0, 12) ?? "legacy (unrecorded)"} {selected.isTest ? " / draft test" : " / deployed run"}</p>
              {selected.isTest && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
                  <FlaskConical size={10} /> Test execution
                </span>
              )}
              {(() => {
                const s = getStatus(selected.status);
                const Icon = s.icon;
                return <span className={`flex items-center gap-1 text-xs ${s.color}`}><Icon size={14} />{s.label}</span>;
              })()}
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Execution ID</div>
                <div className="font-mono text-[var(--color-text-secondary)]">{selected.executionId}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Duration</div>
                <div>{formatDuration(selected.durationMs)}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Started</div>
                <div>{formatTime(selected.startedAt)}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-muted)] mb-1">Completed</div>
                <div>{selected.completedAt ? formatTime(selected.completedAt) : "—"}</div>
              </div>
              {selected.expiresAt && <div><div className="text-[var(--color-text-muted)] mb-1">Retained until</div><div>{formatTime(selected.expiresAt)}</div></div>}
              {selected.replayOf && <div><div className="text-[var(--color-text-muted)] mb-1">Replay of</div>
                <button className="underline font-mono break-all" onClick={async () => {
                  try { const original = await getExecution(selected.replayOf!); setExecutions(current => [original, ...current.filter(e => e.executionId !== original.executionId)]); setSelectedId(original.executionId); }
                  catch { setError("The original execution is unavailable or has expired."); }
                }}>{selected.replayOf}</button></div>}
            </div>

            <RecoveryActions key={`recovery-${selected.executionId}`} execution={selected} onRecovered={async id => { await loadExecutions(); setSelectedId(id); }} />

            {/* Errors */}
            {selected.errors && selected.errors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-[var(--color-error)] mb-2">Errors</h3>
                <div className="bg-[var(--color-error-bg)] border border-[var(--color-error)] rounded p-3">
                  {selected.errors.map((e, i) => (
                    <div key={i} className="text-xs text-[var(--color-error)]">{e}</div>
                  ))}
                </div>
              </div>
            )}

            <ExecutionInspector key={`inspection-${selected.executionId}`} executionId={selected.executionId} refreshKey={JSON.stringify(selected)} />


          </div>
        )}
      </div>
    </div>
  );
}
