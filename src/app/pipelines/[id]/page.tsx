"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Save, CheckCircle, ArrowLeft, Plus, X, FileCode2 } from "lucide-react";
import { getPipeline, savePipeline, validatePipeline, type PipelineDefinition } from "@/lib/api";

// Monaco must be loaded client-side only (no SSR)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DARK_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "keyword", foreground: "569cd6" },
    { token: "keyword.pipe", foreground: "c586c0" },
    { token: "string", foreground: "ce9178" },
    { token: "string.interpolated", foreground: "ce9178" },
    { token: "number", foreground: "b5cea8" },
    { token: "comment", foreground: "6a9955" },
    { token: "variable.path", foreground: "9cdcfe" },
    { token: "operator.arrow", foreground: "d4d4d4" },
    { token: "support.function", foreground: "dcdcaa" },
    { token: "delimiter.pipe", foreground: "c586c0", fontStyle: "bold" },
  ],
  colors: {
    "editor.background": "#1e1e1e",
    "editor.foreground": "#d4d4d4",
  },
};

export default function PipelineEditorPage() {
  const params = useParams();
  const router = useRouter();
  const pipelineId = params.id as string;
  const isNew = pipelineId === "new";

  const [pipeline, setPipeline] = useState<PipelineDefinition | null>(null);
  const [yaml, setYaml] = useState("");
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("yaml");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newScriptName, setNewScriptName] = useState("");
  const [showNewScript, setShowNewScript] = useState(false);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  useEffect(() => {
    if (isNew) {
      setYaml(DEFAULT_YAML);
      setLoading(false);
      setDirty(true);
      return;
    }
    loadPipeline();
  }, [pipelineId]);

  async function loadPipeline() {
    setLoading(true);
    try {
      const data = await getPipeline(pipelineId);
      setPipeline(data);
      setYaml(data.content.yaml);
      setScripts(data.content.scripts || {});
    } catch {
      setError("Failed to load pipeline. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await savePipeline(pipelineId, { yaml, scripts });
      setDirty(false);
      setValidationResult(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    try {
      // Save first so the API validates the latest content
      await savePipeline(pipelineId, { yaml, scripts });
      const result = await validatePipeline(pipelineId);
      setValidationResult(result);
    } catch (err: any) {
      setValidationResult({ valid: false, errors: [err?.message || "Validation request failed"] });
    } finally {
      setValidating(false);
    }
  }

  function handleMonacoMount(monaco: typeof import("monaco-editor")) {
    monacoRef.current = monaco;
    // Register Elwood language
    import("@/lib/editor/elwood-language").then(({ registerElwoodLanguage }) => {
      registerElwoodLanguage(monaco);
    });
    // Define the dark theme
    monaco.editor.defineTheme("elwood-dark", DARK_THEME);
  }

  function addScript() {
    const name = newScriptName.trim();
    if (!name) return;
    const fileName = name.endsWith(".elwood") ? name : `${name}.elwood`;
    setScripts((prev) => ({ ...prev, [fileName]: `// ${fileName}\nreturn $` }));
    setActiveTab(fileName);
    setNewScriptName("");
    setShowNewScript(false);
    setDirty(true);
  }

  function removeScript(name: string) {
    setScripts((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    if (activeTab === name) setActiveTab("yaml");
    setDirty(true);
  }

  if (loading) {
    return <div className="p-8 text-[var(--color-text-muted)]">Loading pipeline...</div>;
  }

  if (error && !pipeline && !isNew) {
    return (
      <div className="p-8">
        <div className="p-4 bg-[var(--color-error-bg)] border border-[var(--color-error)] rounded text-[var(--color-error)]">
          {error}
        </div>
      </div>
    );
  }

  const scriptNames = Object.keys(scripts);
  const isYamlTab = activeTab === "yaml";
  const currentContent = isYamlTab ? yaml : (scripts[activeTab] ?? "");
  const currentLanguage = isYamlTab ? "yaml" : "elwood";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/pipelines")}
            className="p-1 hover:bg-[var(--color-bg-hover)] rounded"
          >
            <ArrowLeft size={16} />
          </button>
          <FileCode2 size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-medium">{isNew ? "New Pipeline" : pipelineId}</span>
          {dirty && <span className="text-xs text-[var(--color-text-muted)]">(unsaved)</span>}
        </div>
        <div className="flex items-center gap-2">
          {validationResult && (
            <span className={`text-xs px-2 py-1 rounded ${
              validationResult.valid
                ? "bg-[#1e3a1e] text-[var(--color-success)]"
                : "bg-[var(--color-error-bg)] text-[var(--color-error)]"
            }`}>
              {validationResult.valid ? "Valid" : `${validationResult.errors.length} error(s)`}
            </span>
          )}
          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-hover)]"
          >
            <CheckCircle size={14} />
            {validating ? "Validating..." : "Validate"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-[var(--color-error-bg)] text-xs text-[var(--color-error)] border-b border-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* Validation errors */}
      {validationResult && !validationResult.valid && (
        <div className="px-4 py-2 bg-[var(--color-error-bg)] text-xs text-[var(--color-error)] border-b border-[var(--color-error)]">
          {validationResult.errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)] flex-shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab("yaml")}
          className={`px-4 py-2 text-xs border-r border-[var(--color-border)] ${
            isYamlTab
              ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          pipeline.elwood.yaml
        </button>
        {scriptNames.map((name) => (
          <div key={name} className="flex items-center border-r border-[var(--color-border)]">
            <button
              onClick={() => setActiveTab(name)}
              className={`px-4 py-2 text-xs ${
                activeTab === name
                  ? "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {name}
            </button>
            <button
              onClick={() => removeScript(name)}
              className="px-1 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
              title={`Remove ${name}`}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {showNewScript ? (
          <div className="flex items-center px-2 gap-1">
            <input
              type="text"
              value={newScriptName}
              onChange={(e) => setNewScriptName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addScript()}
              placeholder="script-name.elwood"
              className="bg-[var(--color-bg-primary)] text-xs px-2 py-1 rounded border border-[var(--color-border)] outline-none w-40"
              autoFocus
            />
            <button onClick={addScript} className="text-[var(--color-success)] text-xs">Add</button>
            <button onClick={() => setShowNewScript(false)} className="text-[var(--color-text-muted)] text-xs">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewScript(true)}
            className="px-3 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
            title="Add script"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          key={activeTab}
          language={currentLanguage}
          theme="elwood-dark"
          value={currentContent}
          onChange={(value) => {
            if (isYamlTab) {
              setYaml(value ?? "");
            } else {
              setScripts((prev) => ({ ...prev, [activeTab]: value ?? "" }));
            }
            setDirty(true);
          }}
          beforeMount={handleMonacoMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}

const DEFAULT_YAML = `version: 2
name: my-pipeline
description: ""
mode: sync

sources:
  - name: api-trigger
    trigger: http
    contentType: json

outputs:
  - name: api-response
    response: true
`;
