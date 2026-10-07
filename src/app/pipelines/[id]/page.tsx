"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Save, CheckCircle, ArrowLeft, FileCode2, AlignLeft, Play } from "lucide-react";
import { getPipeline, savePipeline, validatePipeline, deployPipeline, migratePipeline, canManage, apiError, type PipelineDefinition } from "@/lib/api";
import { useManagementSession } from "@/components/ManagementAccess";
import PipelineFileTree from "@/components/PipelineFileTree";
import RunPanel from "@/components/RunPanel";

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
  colors: { "editor.background": "#1e1e1e", "editor.foreground": "#d4d4d4" },
};

export default function PipelineEditorPage() {
  const params = useParams<{ id: string }>();
  return <PipelineEditor key={params.id} pipelineId={params.id} />;
}

function PipelineEditor({ pipelineId }: { pipelineId: string }) {
  const session = useManagementSession();
  const router = useRouter();
  const isNew = pipelineId === "new";

  const [pipeline, setPipeline] = useState<PipelineDefinition | null>(null);
  const [yaml, setYaml] = useState(isNew ? DEFAULT_YAML : "");
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState("yaml");
  const [loading, setLoading] = useState(!isNew);
  const [deploying, setDeploying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(isNew);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [testScriptName, setTestScriptName] = useState<string | undefined>();
  const [showRunPanel, setShowRunPanel] = useState(false);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  const canEdit = canManage(session, "write", pipelineId) && !pipeline?.migrationRequired;
  const canTest = canManage(session, "test", pipelineId);
  const canDeploy = canManage(session, "deploy", pipelineId);

  // Extract endpoint and auth from the YAML for the run panel
  const deployedYaml = pipeline?.activeRevisionId === pipeline?.draftRevisionId ? pipeline?.content.yaml ?? "" : "";
  const endpointMatch = deployedYaml.match(/endpoint:\s*(\S+)/);
  const triggerEndpoint = endpointMatch?.[1] || undefined;
  const authUserMatch = deployedYaml.match(/auth:[\s\S]*?user:\s*(.+)/);
  const authPassMatch = deployedYaml.match(/auth:[\s\S]*?password:\s*["']?([^\n"']+)/);
  const triggerAuthUser = authUserMatch?.[1]?.trim();
  const triggerAuthPass = authPassMatch?.[1]?.trim();

  useEffect(() => {
    if (isNew) return;
    loadPipeline();
  }, [pipelineId]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        setTreeCollapsed((c) => !c);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [yaml, scripts, pipelineId, pipeline, canEdit, saving]);

  async function loadPipeline() {
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
    if (!canEdit || !pipeline || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await savePipeline(pipelineId, { yaml, scripts }, pipeline.draftRevisionId);
      setPipeline(saved);
      setDirty(false);
      setValidationResult(null);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    setValidating(true);
    try {
      const result = await validatePipeline(pipelineId, { yaml, scripts });
      setValidationResult(result);
    } catch (err) {
      setValidationResult({ valid: false, errors: [err instanceof Error ? err.message : "Validation request failed"] });
    } finally {
      setValidating(false);
    }
  }

  async function handleDeploy() {
    if (!pipeline || dirty || !canDeploy || deploying) return;
    setDeploying(true); setError(null);
    try { setPipeline(await deployPipeline(pipelineId, pipeline.draftRevisionId)); }
    catch (failure) { setError(apiError(failure)); }
    finally { setDeploying(false); }
  }

  async function handleMigrate() {
    if (!pipeline || !canDeploy) return;
    setDeploying(true); setError(null);
    try { setPipeline(await migratePipeline(pipelineId, pipeline.draftRevisionId)); }
    catch (failure) { setError(apiError(failure)); }
    finally { setDeploying(false); }
  }

  function handleMonacoMount(monaco: typeof import("monaco-editor")) {
    monacoRef.current = monaco;
    import("@/lib/editor/elwood-language").then(({ registerElwoodLanguage }) => {
      registerElwoodLanguage(monaco);
    });
    monaco.editor.defineTheme("elwood-dark", DARK_THEME);
  }

  function handleFormat() {
    const isYaml = activeFile === "yaml";
    const content = isYaml ? yaml : (scripts[activeFile] ?? "");
    const lines = content.split("\n");
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0) return;
    const minIndent = Math.min(...nonEmpty.map((l) => l.match(/^(\s*)/)?.[1].length ?? 0));
    if (minIndent === 0) return;
    const dedented = lines.map((l) => (l.trim().length === 0 ? "" : l.substring(minIndent))).join("\n");
    if (isYaml) setYaml(dedented);
    else setScripts((prev) => ({ ...prev, [activeFile]: dedented }));
    setDirty(true);
  }

  function addScript(name: string) {
    setScripts((prev) => ({ ...prev, [name]: `// ${name}\nreturn $` }));
    setDirty(true);
  }

  function removeScript(name: string) {
    setScripts((prev) => { const next = { ...prev }; delete next[name]; return next; });
    if (activeFile === name) setActiveFile("yaml");
    setDirty(true);
  }

  if (loading) return <div className="p-8 text-[var(--color-text-muted)]">Loading pipeline...</div>;

  if (error && !pipeline && !isNew) {
    return (
      <div className="p-8">
        <div className="p-4 bg-[var(--color-error-bg)] border border-[var(--color-error)] rounded text-[var(--color-error)]">{error}</div>
      </div>
    );
  }

  const isYaml = activeFile === "yaml";
  const currentContent = isYaml ? yaml : (scripts[activeFile] ?? "");
  const currentLanguage = isYaml ? "yaml" : "elwood";

  return (
    <div className="flex flex-col h-full">
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 h-12 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/pipelines")} className="p-1 hover:bg-[var(--color-bg-hover)] rounded">
            <ArrowLeft size={16} />
          </button>
          <FileCode2 size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-medium">{isNew ? "New Pipeline" : pipelineId}</span>
          {dirty && <span className="text-xs text-[var(--color-text-muted)]">(unsaved)</span>}
        </div>
        <div className="flex items-center gap-2">
          <button disabled={!canEdit || saving || deploying} onClick={handleFormat}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-hover)]"
            title="Remove extra leading whitespace">
            <AlignLeft size={14} /> Format
          </button>
          {validationResult && (
            <span className={`text-xs px-2 py-1 rounded ${validationResult.valid
              ? "bg-[#1e3a1e] text-[var(--color-success)]"
              : "bg-[var(--color-error-bg)] text-[var(--color-error)]"}`}>
              {validationResult.valid ? "Valid" : `${validationResult.errors.length} error(s)`}
            </span>
          )}
          <button onClick={handleValidate} disabled={validating || !canManage(session, "write", pipelineId)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-hover)]">
            <CheckCircle size={14} /> {validating ? "Validating..." : "Validate"}
          </button>
          <button onClick={handleSave} disabled={saving || !canEdit}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90">
            <Save size={14} /> {saving ? "Saving..." : "Save draft"}
          </button>
          <button onClick={handleDeploy} disabled={dirty || !canDeploy || deploying || saving || pipeline?.migrationRequired}
            title={dirty ? "Save this draft before deploying" : "Publish this saved draft and activate its endpoints"}
            className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded disabled:opacity-40">
            {deploying ? "Publishing..." : "Deploy"}
          </button>
          {!isNew && !isYaml && (
            <button disabled={dirty || !canTest} title={dirty ? "Save changes before testing this script" : "Test the saved script with a JSON input"}
              onClick={() => { setTestScriptName(activeFile); setShowRunPanel(true); }}
              className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded disabled:opacity-40">
              Test saved script
            </button>
          )}
          {!isNew && (
            <button disabled={!canTest} onClick={() => { setTestScriptName(undefined); setShowRunPanel((s) => testScriptName ? true : !s); }}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded ${
                showRunPanel
                  ? "bg-[var(--color-success)] text-black"
                  : "bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
              }`}>
              <Play size={14} /> Test draft
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-2 text-xs border-b border-[var(--color-border)] flex items-center gap-4 text-[var(--color-text-secondary)]">
        <span>Draft: {pipeline?.draftRevisionId?.slice(0, 12) ?? "unsaved"}</span>
        <span>Deployed: {pipeline?.activeRevisionId?.slice(0, 12) ?? "not deployed"}</span>
        {pipeline?.migrationRequired && <><span>Legacy pipeline is live. Migrate to enable separate drafts.</span>
          <button onClick={handleMigrate} disabled={!canDeploy || deploying} className="underline disabled:opacity-40">Migrate existing deployment</button></>}
      </div>
      {/* Error / validation banners */}
      {error && (
        <div className="px-4 py-2 bg-[var(--color-error-bg)] text-xs text-[var(--color-error)] border-b border-[var(--color-error)]">{error}</div>
      )}
      {validationResult && !validationResult.valid && (
        <div className="px-4 py-2 bg-[var(--color-error-bg)] text-xs text-[var(--color-error)] border-b border-[var(--color-error)]">
          {validationResult.errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* File tree + editor + run panel */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Editor area */}
        <div className="flex flex-1 min-h-0">
          <PipelineFileTree
            readOnly={!canEdit || saving || deploying}
            yaml={yaml}
            scripts={scripts}
            activeFile={activeFile}
            onSelectFile={setActiveFile}
            onAddScript={canEdit ? addScript : () => {}}
            onRemoveScript={canEdit ? removeScript : () => {}}
            collapsed={treeCollapsed}
            onToggleCollapsed={() => setTreeCollapsed((c) => !c)}
          />

          {/* Monaco editor */}
          <div className="flex-1 min-h-0">
            <MonacoEditor
              key={activeFile}
              language={currentLanguage}
              theme="elwood-dark"
              value={currentContent}
              onChange={(value) => {
                if (isYaml) setYaml(value ?? "");
                else setScripts((prev) => ({ ...prev, [activeFile]: value ?? "" }));
                setDirty(true);
                setValidationResult(null);
              }}
              beforeMount={handleMonacoMount}
              options={{
                readOnly: !canEdit || saving || deploying,
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

        {/* Run panel (bottom) */}
        {showRunPanel && (
          <RunPanel
            key={testScriptName ?? "pipeline"}
            scriptName={testScriptName}
            pipelineId={pipelineId}
            content={{ yaml, scripts }}
            draftRevisionId={pipeline?.draftRevisionId}
            endpoint={triggerEndpoint}
            authUser={triggerAuthUser}
            authPassword={triggerAuthPass}
            onClose={() => setShowRunPanel(false)}
          />
        )}
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
