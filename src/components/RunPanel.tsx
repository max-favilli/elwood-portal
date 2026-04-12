"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Play, Clock, AlertTriangle, CheckCircle2, X, AlignLeft } from "lucide-react";
import { executePipeline, triggerViaEndpoint, type TriggerResult } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface RunPanelProps {
  pipelineId: string;
  endpoint?: string;
  authUser?: string;
  authPassword?: string;
  onClose: () => void;
}

const DEFAULT_PAYLOAD = `{
  "example": "replace with your test payload"
}`;

export default function RunPanel({ pipelineId, endpoint, authUser, authPassword, onClose }: RunPanelProps) {
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [running, setRunning] = useState(false);
  // Default to Direct Execute — simpler, bypasses auth. User can switch to HTTP Trigger
  // when they want to test the full flow including endpoint routing and auth validation.
  const [mode, setMode] = useState<"trigger" | "execute">("execute");

  function handleFormat() {
    const lines = payload.split("\n");
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0) return;
    const minIndent = Math.min(...nonEmpty.map((l) => l.match(/^(\s*)/)?.[1].length ?? 0));
    if (minIndent === 0) {
      // Already at column 0 — try JSON pretty-print instead
      try { setPayload(JSON.stringify(JSON.parse(payload), null, 2)); } catch { /* not valid JSON */ }
      return;
    }
    setPayload(lines.map((l) => l.trim().length === 0 ? "" : l.substring(minIndent)).join("\n"));
  }

  async function handleRun() {
    setRunning(true);
    setResult(null);
    try {
      let res: TriggerResult;
      if (mode === "trigger" && endpoint) {
        res = await triggerViaEndpoint(endpoint, payload, authUser, authPassword);
      } else {
        res = await executePipeline(pipelineId, payload);
      }
      setResult(res);
    } finally {
      setRunning(false);
    }
  }

  const isSuccess = result && !result.error && result.statusCode >= 200 && result.statusCode < 400;
  const isError = result && (result.error || result.statusCode >= 400);

  // Try to pretty-print the result body
  let formattedBody = result?.body ?? "";
  try {
    if (formattedBody) formattedBody = JSON.stringify(JSON.parse(formattedBody), null, 2);
  } catch { /* not JSON, show raw */ }

  return (
    <div className="flex flex-col border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]" style={{ height: "45%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Run Pipeline
          </span>

          {/* Mode toggle */}
          <div className="flex items-center bg-[var(--color-bg-tertiary)] rounded text-[10px]">
            {endpoint && (
              <button
                onClick={() => setMode("trigger")}
                className={`px-2 py-0.5 rounded ${mode === "trigger" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)]"}`}
              >
                HTTP Trigger
              </button>
            )}
            <button
              onClick={() => setMode("execute")}
              className={`px-2 py-0.5 rounded ${mode === "execute" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)]"}`}
            >
              Direct Execute
            </button>
          </div>

          {mode === "trigger" && endpoint && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              POST /api/v1/trigger{endpoint}
            </span>
          )}

          {result && (
            <span className={`flex items-center gap-1 text-xs ${isSuccess ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
              {isSuccess ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {result.statusCode > 0 ? result.statusCode : "Error"}
              <Clock size={10} className="ml-1 opacity-60" />
              {result.durationMs}ms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleFormat}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-hover)]"
            title="Format / dedent payload">
            <AlignLeft size={12} />
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90"
          >
            <Play size={12} />
            {running ? "Running..." : "Run"}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} className="text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>

      {/* Content: input + output side by side */}
      <div className="flex flex-1 min-h-0">
        {/* Input */}
        <div className="flex-1 flex flex-col border-r border-[var(--color-border)]">
          <div className="px-3 py-1 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
            Input Payload (JSON)
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              language="json"
              theme="elwood-dark"
              value={payload}
              onChange={(v) => setPayload(v ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: "off",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 4 },
              }}
            />
          </div>
        </div>

        {/* Output */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-1 text-[10px] bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
            {result?.error ? (
              <span className="text-[var(--color-error)]">Error</span>
            ) : result ? (
              <span className="text-[var(--color-text-muted)]">Response</span>
            ) : (
              <span className="text-[var(--color-text-muted)]">Click Run to execute</span>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              language="json"
              theme="elwood-dark"
              value={result?.error
                ? JSON.stringify({ error: result.error, statusCode: result.statusCode }, null, 2)
                : formattedBody || "// Press Run to execute the pipeline"
              }
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: "off",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                readOnly: true,
                tabSize: 2,
                padding: { top: 4 },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
