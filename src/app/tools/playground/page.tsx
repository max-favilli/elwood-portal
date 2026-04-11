"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Play, Trash2, Clock, AlertTriangle, BookOpen, Search, ChevronRight } from "lucide-react";
import allExamples from "@/data/examples.json";

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

const DEFAULT_SCRIPT = `// Try Elwood expressions here.
// $ is the input JSON (edit on the right).
// Press Ctrl+Enter or click Run to evaluate.

$.items[*]
  | where .active
  | select { name: .name, upper: .name.toUpper() }
`;

const DEFAULT_INPUT = `{
  "items": [
    { "name": "Widget", "active": true, "price": 9.99 },
    { "name": "Gadget", "active": false, "price": 24.99 },
    { "name": "Doohickey", "active": true, "price": 4.50 }
  ]
}`;

export default function PlaygroundPage() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [output, setOutput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [exampleSearch, setExampleSearch] = useState("");
  const [selectedExample, setSelectedExample] = useState<string | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  type Example = typeof allExamples[0];
  const filteredExamples = useMemo(() => {
    if (!exampleSearch.trim()) return allExamples as Example[];
    const q = exampleSearch.toLowerCase();
    return (allExamples as Example[]).filter(
      (ex) => ex.title.toLowerCase().includes(q) || ex.id.toLowerCase().includes(q) || ex.category.toLowerCase().includes(q)
    );
  }, [exampleSearch]);

  const groupedExamples = useMemo(() => {
    const groups: Record<string, Example[]> = {};
    for (const ex of filteredExamples) {
      (groups[ex.category] ??= []).push(ex);
    }
    return groups;
  }, [filteredExamples]);

  function loadExample(ex: Example) {
    setScript(ex.script);
    setInput(ex.input);
    setOutput("");
    setError(null);
    setDurationMs(null);
    setSelectedExample(ex.id);
  }

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setOutput("");
    setDurationMs(null);

    try {
      // Dynamic import — @elwood-lang/core runs entirely in the browser
      const { evaluate, execute } = await import("@elwood-lang/core");

      // Parse input JSON
      let inputData: unknown;
      try {
        inputData = JSON.parse(input);
      } catch (parseErr: any) {
        setError(`Invalid input JSON: ${parseErr.message}`);
        setRunning(false);
        return;
      }

      const scriptText = script.trim();
      const isScript = scriptText.startsWith("let ") ||
                       scriptText.includes("\nlet ") ||
                       scriptText.includes("return ");

      const start = performance.now();
      const result = isScript
        ? execute(scriptText, inputData)
        : evaluate(scriptText, inputData);
      const elapsed = performance.now() - start;

      setDurationMs(Math.round(elapsed * 100) / 100);

      if (result.success) {
        setOutput(JSON.stringify(result.value, null, 2));
      } else {
        const diagnostics = result.diagnostics || [];
        setError(diagnostics.map((d: any) =>
          d.line != null ? `Line ${d.line}:${d.column} — ${d.message}` : d.message
        ).join("\n"));
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error");
    } finally {
      setRunning(false);
    }
  }, [script, input]);

  function handleMonacoMount(monaco: typeof import("monaco-editor")) {
    monacoRef.current = monaco;
    import("@/lib/editor/elwood-language").then(({ registerElwoodLanguage }) => {
      registerElwoodLanguage(monaco);
    });
    monaco.editor.defineTheme("elwood-dark", DARK_THEME);

    // Ctrl+Enter to run
    monaco.editor.addEditorAction({
      id: "elwood-run",
      label: "Run Elwood Expression",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => handleRun(),
    });
  }

  function handleClear() {
    setOutput("");
    setError(null);
    setDurationMs(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Playground</span>
          <span className="text-xs text-[var(--color-text-muted)]">— test Elwood expressions</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExamples(!showExamples)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs border rounded ${
              showExamples
                ? "bg-[var(--color-bg-active)] border-[var(--color-accent)] text-white"
                : "bg-[var(--color-bg-tertiary)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            <BookOpen size={14} />
            Examples ({allExamples.length})
          </button>
          {durationMs !== null && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <Clock size={12} />
              {durationMs}ms
            </span>
          )}
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-hover)]"
          >
            <Trash2 size={14} />
            Clear
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90"
          >
            <Play size={14} />
            {running ? "Running..." : "Run"}
            <span className="text-[10px] opacity-60 ml-1">Ctrl+Enter</span>
          </button>
        </div>
      </div>

      {/* Editor panels */}
      <div className="flex flex-1 min-h-0">
        {/* Examples sidebar */}
        {showExamples && (
          <div className="w-72 flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]">
            <div className="px-3 py-2 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1.5">
                <Search size={12} className="text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={exampleSearch}
                  onChange={(e) => setExampleSearch(e.target.value)}
                  placeholder="Search examples..."
                  className="flex-1 bg-transparent text-xs outline-none placeholder:text-[var(--color-text-muted)]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {Object.entries(groupedExamples).map(([category, examples]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)]">
                    {category}
                  </div>
                  {examples.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => loadExample(ex)}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                        selectedExample === ex.id
                          ? "bg-[var(--color-bg-active)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <ChevronRight size={10} className="flex-shrink-0 opacity-40" />
                      <span className="truncate">{ex.title}</span>
                    </button>
                  ))}
                </div>
              ))}
              {filteredExamples.length === 0 && (
                <div className="px-3 py-4 text-xs text-[var(--color-text-muted)] text-center">
                  No examples match &quot;{exampleSearch}&quot;
                </div>
              )}
            </div>
          </div>
        )}

        {/* Left: Script editor */}
        <div className="flex-1 flex flex-col border-r border-[var(--color-border)]">
          <div className="px-3 py-1.5 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
            Expression / Script
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              language="elwood"
              theme="elwood-dark"
              value={script}
              onChange={(v) => setScript(v ?? "")}
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

        {/* Right: Input + Output stacked */}
        <div className="flex-1 flex flex-col">
          {/* Input JSON */}
          <div className="flex-1 flex flex-col border-b border-[var(--color-border)]">
            <div className="px-3 py-1.5 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
              Input JSON ($)
            </div>
            <div className="flex-1 min-h-0">
              <MonacoEditor
                language="json"
                theme="elwood-dark"
                value={input}
                onChange={(v) => setInput(v ?? "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  padding: { top: 8 },
                }}
              />
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-1.5 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] border-b border-[var(--color-border)]">
              {error ? (
                <span className="flex items-center gap-1 text-[var(--color-error)]">
                  <AlertTriangle size={12} /> Error
                </span>
              ) : (
                "Output"
              )}
            </div>
            <div className="flex-1 min-h-0">
              <MonacoEditor
                language="json"
                theme="elwood-dark"
                value={error || output || "// Press Run or Ctrl+Enter to evaluate"}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "off",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  readOnly: true,
                  tabSize: 2,
                  padding: { top: 8 },
                  ...(error ? { wordWrap: "on" as const } : {}),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
