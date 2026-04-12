"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Play, Clock, AlertTriangle, CheckCircle2, X, AlignLeft, Copy, Terminal, ChevronDown } from "lucide-react";
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

  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  function generateCommand(format: "curl" | "powershell" | "bash"): string {
    const compactPayload = payload.replace(/\n/g, "").replace(/\s{2,}/g, " ");

    if (mode === "execute") {
      const body = JSON.stringify({ pipelineId, payload: JSON.parse(payload) });
      const url = `${API_BASE}/api/executions`;

      if (format === "curl") {
        return `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
      }
      if (format === "powershell") {
        return `Invoke-RestMethod -Uri "${url}" \`\n  -Method POST \`\n  -ContentType "application/json" \`\n  -Body '${body}'`;
      }
      // bash
      return `curl -s -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '${body}' | jq .`;
    }

    // HTTP Trigger mode
    const url = `${API_BASE}/api/v1/trigger${endpoint}`;
    const authLine = authUser && authPassword
      ? format === "powershell"
        ? `$cred = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${authUser}:${authPassword}"))\n`
        : ""
      : "";
    const authHeader = authUser && authPassword
      ? format === "curl" || format === "bash"
        ? `-u "${authUser}:${authPassword}" `
        : `-Headers @{ Authorization = "Basic $cred" } `
      : "";

    if (format === "curl") {
      return `curl -X POST "${url}" \\\n  ${authHeader}\\\n  -H "Content-Type: application/json" \\\n  -d '${compactPayload}'`;
    }
    if (format === "powershell") {
      return `${authLine}Invoke-WebRequest -Uri "${url}" \`\n  -Method POST \`\n  ${authHeader}\`\n  -ContentType "application/json" \`\n  -Body '${compactPayload}'`;
    }
    // bash
    return `curl -s -X POST "${url}" \\\n  ${authHeader}\\\n  -H "Content-Type: application/json" \\\n  -d '${compactPayload}' | jq .`;
  }

  function copyCommand(format: "curl" | "powershell" | "bash") {
    try {
      const cmd = generateCommand(format);
      navigator.clipboard.writeText(cmd);
      setShowCopyMenu(false);
    } catch { /* clipboard not available */ }
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

          {/* Copy as... dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCopyMenu((s) => !s)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-hover)]"
              title="Copy as curl / PowerShell / bash"
            >
              <Terminal size={12} />
              <ChevronDown size={10} />
            </button>
            {showCopyMenu && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-lg z-10 py-1 min-w-[160px]">
                <button onClick={() => copyCommand("curl")}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] flex items-center gap-2">
                  <Copy size={11} /> Copy as curl
                </button>
                <button onClick={() => copyCommand("powershell")}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] flex items-center gap-2">
                  <Copy size={11} /> Copy as PowerShell
                </button>
                <button onClick={() => copyCommand("bash")}
                  className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] flex items-center gap-2">
                  <Copy size={11} /> Copy as bash
                </button>
              </div>
            )}
          </div>

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
