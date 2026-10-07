"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Play, Clock, AlertTriangle, CheckCircle2, X, AlignLeft, Copy, Terminal, ChevronDown } from "lucide-react";
import Warnings from "./Warnings";
import ExecutionInspector from "./ExecutionInspector";
import sampleData from "@/data/pipeline-samples.json";
import type { PipelineSample } from "@/lib/pipeline-samples";
import { findPipelineSample } from "@/lib/pipeline-samples";
import { testScript, executePipeline, triggerViaEndpoint, getMockTemplate, type TestMode, type PipelineContent, type TriggerResult } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface RunPanelProps {
  pipelineId: string;
  content?: PipelineContent;
  draftRevisionId?: string;
  scriptName?: string;
  endpoint?: string;
  authUser?: string;
  authPassword?: string;
  onClose: () => void;
}

const DEFAULT_PAYLOAD = `{
  "example": "replace with your test payload"
}`;

const samples = sampleData as PipelineSample[];

export default function RunPanel({ pipelineId, content, draftRevisionId, scriptName, endpoint, authUser, authPassword, onClose }: RunPanelProps) {
  const sample = !scriptName ? findPipelineSample(samples, content) : undefined;
  const [payload, setPayload] = useState(() => sample ? JSON.stringify(sample.input, null, 2) : DEFAULT_PAYLOAD);
  const [result, setResult] = useState<TriggerResult | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"trigger" | "execute">("execute");
  const [testMode, setTestMode] = useState<TestMode | "">("");
  const [fixtures, setFixtures] = useState(() => sample ? JSON.stringify(sample.mocks, null, 2) : '{"sources":{},"outputs":{}}');
  const [inputTab, setInputTab] = useState<"input" | "mocks">("input");
  const [resultTab, setResultTab] = useState<"response" | "steps">("steps");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [fixtureError, setFixtureError] = useState("");

  async function buildTemplate() {
    setTemplateLoading(true);
    setFixtureError("");
    try {
      const template = await getMockTemplate(pipelineId, content);
      setFixtures(JSON.stringify(template.mocks, null, 2));
      setInputTab("mocks");
    } catch (err) {
      // Validation responses contain useful errors in their JSON body.
      const response = (err as { response?: { data?: { errors?: string[]; error?: string } } }).response?.data;
      setFixtureError(response?.errors?.join("; ") ?? response?.error ?? "Could not build fixtures. Validate this draft first.");
    } finally { setTemplateLoading(false); }
  }

  const activeMode = endpoint ? mode : "execute";

  const draftTest = !scriptName && activeMode === "execute";
  const editingMocks = draftTest && testMode === "mock" && inputTab === "mocks";
  const canRun = !running && !templateLoading && (!draftTest || testMode !== "");

  function handleFormat() {
    const value = editingMocks ? fixtures : payload;
    const setValue = editingMocks ? setFixtures : setPayload;
    const lines = value.split("\n");
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0) return;
    const minIndent = Math.min(...nonEmpty.map((l) => l.match(/^(\s*)/)?.[1].length ?? 0));
    if (minIndent === 0) {
      // Already at column 0 — try JSON pretty-print instead
      try { setValue(JSON.stringify(JSON.parse(value), null, 2)); } catch { /* not valid JSON */ }
      return;
    }
    setValue(lines.map((l) => l.trim().length === 0 ? "" : l.substring(minIndent)).join("\n"));
  }

  async function handleRun() {
    if (!canRun) return;
    setRunning(true);
    setResult(null);
    try {
      let res: TriggerResult;
      if (scriptName) {
        res = await testScript(pipelineId, scriptName, payload, draftRevisionId);
      } else if (activeMode === "trigger" && endpoint) {
        res = await triggerViaEndpoint(endpoint, payload, authUser, authPassword);
      } else {
        if (!testMode) return;
        res = await executePipeline(pipelineId, payload, {
          testMode, ...(testMode === "mock" ? { mocks: JSON.parse(fixtures) } : {}),
        }, content, draftRevisionId);
      }
      setResult(res);
    } catch (err) {
      setResult({ statusCode: 0, body: "", durationMs: 0, error: err instanceof Error ? err.message : "Invalid test input." });
    } finally {
      setRunning(false);
    }
  }

  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  function generateCommand(format: "curl" | "powershell" | "bash"): string {
    const quote = (value: string) => "'" + value.replaceAll("'", format === "powershell" ? "''" : "'\"'\"'") + "'";
    const isDraft = activeMode === "execute";
    const url = isDraft ? `${API_BASE}/api/executions` : `${API_BASE}/api/v1/trigger${endpoint}`;
    const body = isDraft
      ? JSON.stringify({ pipelineId, payload: JSON.parse(payload), content, expectedRevisionId: draftRevisionId, testMode, ...(testMode === "mock" ? { mocks: JSON.parse(fixtures) } : {}) })
      : payload;
    const credentials = authUser && authPassword ? `${authUser}:${authPassword}` : undefined;
    if (format === "powershell") {
      const basic = !isDraft && credentials
        ? `$cred = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(${quote(credentials)}))\n` : "";
      const headers = isDraft ? '-Headers @{ Authorization = "Bearer $env:ELWOOD_MANAGEMENT_TOKEN" }'
        : credentials ? '-Headers @{ Authorization = "Basic $cred" }' : '';
      return `${basic}Invoke-RestMethod -Uri ${quote(url)} -Method POST ${headers} -ContentType 'application/json' -Body ${quote(body)}`;
    }
    const auth = isDraft ? '-H "Authorization: Bearer $ELWOOD_MANAGEMENT_TOKEN"'
      : credentials ? `-u ${quote(credentials)}` : '';
    return `curl -s -X POST ${quote(url)} ${auth} -H 'Content-Type: application/json' -d ${quote(body)}${format === "bash" ? " | jq ." : ""}`;
  }

  function copyCommand(format: "curl" | "powershell" | "bash") {
    try {
      const cmd = generateCommand(format);
      navigator.clipboard.writeText(cmd);
      setShowCopyMenu(false);
    } catch { /* clipboard not available */ }
  }

  const isSuccess = result && !result.error && result.statusCode >= 200 && result.statusCode < 400;

  // Try to pretty-print the result body
  let formattedBody = result?.body ?? "";
  try {
    if (formattedBody) formattedBody = JSON.stringify(JSON.parse(formattedBody), null, 2);
  } catch { /* not JSON, show raw */ }

  return (
    <div className="flex flex-col border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]" style={{ height: "55%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-9 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            {scriptName ? `Test saved script: ${scriptName}` : "Test current draft"}
          </span>

          {/* Mode toggle */}
          {!scriptName && <div className="flex items-center bg-[var(--color-bg-tertiary)] rounded text-[10px]">
            {endpoint && (
              <button
                disabled={running || templateLoading} onClick={() => setMode("trigger")}
                className={`px-2 py-0.5 rounded ${activeMode === "trigger" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)]"}`}
              >
                Deployed HTTP endpoint
              </button>
            )}
            <button
              disabled={running || templateLoading} onClick={() => setMode("execute")}
              className={`px-2 py-0.5 rounded ${activeMode === "execute" ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)]"}`}
            >
              Draft (synchronous)
            </button>
          </div>}

          {activeMode === "trigger" && endpoint && !scriptName && (
            <span className="text-[10px] text-[var(--color-text-muted)]">
              POST /api/v1/trigger{endpoint}
            </span>
          )}

          {result && (
            <span className={`flex items-center gap-1 text-xs ${isSuccess ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
              {isSuccess ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {isSuccess ? "Succeeded" : "Failed"}{result.statusCode > 0 ? ` / HTTP ${result.statusCode}` : ""}
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

          {/* Copy commands apply to pipeline runs. */}
          {!scriptName && <div className="relative">
            <button
              disabled={!canRun}
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
          </div>}

          <button
            onClick={handleRun}
            disabled={!canRun}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90 disabled:opacity-40"
          >
            <Play size={12} />
            {running ? "Running..." : "Run"}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <X size={14} className="text-[var(--color-text-muted)]" />
          </button>
        </div>
      </div>

      <div className="px-3 py-1 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
        {scriptName ? "Testing the saved draft script." : activeMode === "trigger" ? "Calls the deployed endpoint using real systems." : testMode === "mock" ? "Runs the editor snapshot synchronously with mocks. No external systems or secrets are accessed." : testMode === "real" ? "Runs the editor snapshot synchronously. Real systems may be changed." : "Choose real systems or mocks to test this editor snapshot synchronously."}
        {result?.revisionId && <span className="ml-3">Tested revision: {result.revisionId.slice(0, 12)}</span>}
      </div>
      {draftTest && <div className="flex items-center gap-3 px-3 py-2 text-xs border-b border-[var(--color-border)]">
        <label className="flex items-center gap-2">Connectors
          <select aria-label="Test connectors" disabled={running || templateLoading} value={testMode} onChange={e => setTestMode(e.target.value as TestMode | "")}
            className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded px-2 py-1">
            <option value="">Choose test mode...</option>
            <option value="mock">Mocks</option>
            <option value="real">Real systems</option>
          </select>
        </label>
        {testMode === "mock" && <>
          <button onClick={buildTemplate} disabled={running || templateLoading} className="px-2 py-1 border border-[var(--color-border)] rounded">
            {templateLoading ? "Building..." : "Replace fixtures with template"}
          </button>
          <span className="text-[var(--color-text-muted)]">Set response bodies and optional expectBody assertions.</span>
        </>}
      </div>}
      {draftTest && sample && <div className="px-3 py-1 text-xs border-b border-[var(--color-border)] max-h-24 overflow-auto flex-shrink-0">
        <span className="font-medium">{sample.title}: </span>{sample.expectedOutcome}
        {testMode === "real" && <p className="text-[var(--color-text-muted)]">{sample.realNotes}</p>}
        <button disabled={running || templateLoading} onClick={() => {
          setPayload(JSON.stringify(sample.input, null, 2));
          setFixtures(JSON.stringify(sample.mocks, null, 2));
          setFixtureError("");
        }} className="ml-3 underline disabled:opacity-40">Reset sample input and mocks</button>
      </div>}
      {fixtureError && <p className="px-3 py-1 text-xs text-[var(--color-error)]">{fixtureError}</p>}
      {/* Content: input + output side by side */}
      <div className="flex flex-1 min-h-0">
        {/* Input */}
        <div className="flex-1 flex flex-col border-r border-[var(--color-border)]">
          <div className="px-3 py-1 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
            <button disabled={running} onClick={() => setInputTab("input")} className={!editingMocks ? "text-[var(--color-accent)]" : ""}>Input payload (JSON)</button>
            {draftTest && testMode === "mock" && <button disabled={running} onClick={() => setInputTab("mocks")}
              className={`ml-4 ${editingMocks ? "text-[var(--color-accent)]" : ""}`}>Mock fixtures (JSON)</button>}
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              language="json"
              theme="elwood-dark"
              path={editingMocks ? "test-mocks.json" : "test-input.json"}
              value={editingMocks ? fixtures : payload}
              onChange={(v) => (editingMocks ? setFixtures : setPayload)(v ?? "")}
              options={{
                readOnly: running || templateLoading,
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
            <button onClick={() => setResultTab("response")} className={resultTab === "response" ? "text-[var(--color-accent)]" : ""}>Response</button>
            {result?.inspection && <button onClick={() => setResultTab("steps")} className={`ml-4 ${resultTab === "steps" ? "text-[var(--color-accent)]" : ""}`}>Steps and data</button>}
            {result?.error && <span className="ml-3 text-[var(--color-error)]">{result.error}</span>}
          </div>
          <Warnings warnings={result?.warnings ?? []} />
          <div className="flex-1 min-h-0 overflow-auto">
            {resultTab === "steps" && result?.inspection ? <ExecutionInspector inspection={result.inspection} /> : <MonacoEditor
              language="json"
              theme="elwood-dark"
              value={formattedBody || result?.error || "// Choose a test mode, then Run"}
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
            />}
          </div>
        </div>
      </div>
    </div>
  );
}
