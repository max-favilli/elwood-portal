"use client";

import { useMemo, useState } from "react";
import {
  FileCode2, FileText, ChevronRight, ChevronDown, Plus,
  PanelLeftClose, PanelLeftOpen, Trash2
} from "lucide-react";

interface FileTreeProps {
  yaml: string;
  scripts: Record<string, string>;
  activeFile: string;
  onSelectFile: (file: string) => void;
  onAddScript: (name: string) => void;
  onRemoveScript: (name: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface FileGroup {
  label: string;
  files: { name: string; referencedBy?: string }[];
}

export default function PipelineFileTree({
  yaml,
  scripts,
  activeFile,
  onSelectFile,
  onAddScript,
  onRemoveScript,
  collapsed,
  onToggleCollapsed,
}: FileTreeProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["Sources", "Outputs", "Other"])
  );
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  // Parse YAML to find which scripts are referenced where
  const groups = useMemo(() => {
    const sourceScripts: { name: string; referencedBy: string }[] = [];
    const outputScripts: { name: string; referencedBy: string }[] = [];
    const referenced = new Set<string>();

    // Simple regex scan of the YAML for .elwood references
    // Matches: map: foo.elwood, body: bar.elwood, path: baz.elwood
    const lines = yaml.split("\n");
    let currentSection = "";
    let currentName = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("sources:")) currentSection = "sources";
      else if (trimmed.startsWith("outputs:")) currentSection = "outputs";
      else if (trimmed.startsWith("- name:")) currentName = trimmed.replace("- name:", "").trim();

      const elwoodMatch = trimmed.match(/(?:map|body|path|outputId):\s*(\S+\.elwood)/);
      if (elwoodMatch) {
        const scriptName = elwoodMatch[1];
        referenced.add(scriptName);
        if (currentSection === "sources") {
          sourceScripts.push({ name: scriptName, referencedBy: currentName });
        } else if (currentSection === "outputs") {
          outputScripts.push({ name: scriptName, referencedBy: currentName });
        }
      }
    }

    // Unreferenced scripts
    const otherScripts = Object.keys(scripts)
      .filter((name) => !referenced.has(name))
      .map((name) => ({ name }));

    const result: FileGroup[] = [];
    if (sourceScripts.length > 0) result.push({ label: "Sources", files: sourceScripts });
    if (outputScripts.length > 0) result.push({ label: "Outputs", files: outputScripts });
    if (otherScripts.length > 0) result.push({ label: "Other", files: otherScripts });

    return result;
  }, [yaml, scripts]);

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const fileName = name.endsWith(".elwood") ? name : `${name}.elwood`;
    onAddScript(fileName);
    onSelectFile(fileName);
    setNewName("");
    setShowAdd(false);
  }

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col items-center pt-2">
        <button
          onClick={onToggleCollapsed}
          className="p-2 rounded hover:bg-[var(--color-bg-hover)]"
          title="Show file tree (Ctrl+E)"
        >
          <PanelLeftOpen size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 flex-shrink-0 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-[var(--color-border)]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Files
        </span>
        <button
          onClick={onToggleCollapsed}
          className="p-1 rounded hover:bg-[var(--color-bg-hover)]"
          title="Hide file tree (Ctrl+E)"
        >
          <PanelLeftClose size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Pipeline YAML — always first */}
        <button
          onClick={() => onSelectFile("yaml")}
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
            activeFile === "yaml"
              ? "bg-[var(--color-bg-active)] text-white"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
          }`}
        >
          <FileText size={13} className="flex-shrink-0 text-[var(--color-accent)]" />
          <span className="truncate font-medium">pipeline.elwood.yaml</span>
        </button>

        {/* Grouped scripts */}
        {groups.map((group) => (
          <div key={group.label}>
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full text-left px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] flex items-center gap-1 mt-2"
            >
              {expandedGroups.has(group.label) ? (
                <ChevronDown size={10} />
              ) : (
                <ChevronRight size={10} />
              )}
              {group.label}
              <span className="opacity-50 ml-auto">{group.files.length}</span>
            </button>
            {expandedGroups.has(group.label) &&
              group.files.map((file) => (
                <div
                  key={file.name}
                  className={`flex items-center group transition-colors ${
                    activeFile === file.name
                      ? "bg-[var(--color-bg-active)]"
                      : "hover:bg-[var(--color-bg-hover)]"
                  }`}
                >
                  <button
                    onClick={() => onSelectFile(file.name)}
                    className={`flex-1 text-left pl-6 pr-1 py-1.5 text-xs flex items-center gap-2 ${
                      activeFile === file.name
                        ? "text-white"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <FileCode2 size={12} className="flex-shrink-0 text-[var(--color-success)]" />
                    <span className="truncate">{file.name}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveScript(file.name);
                    }}
                    className="px-1 opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                    title={`Remove ${file.name}`}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>

      {/* Add script */}
      <div className="border-t border-[var(--color-border)] p-2">
        {showAdd ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="name.elwood"
              className="flex-1 bg-[var(--color-bg-primary)] text-xs px-2 py-1 rounded border border-[var(--color-border)] outline-none w-24"
              autoFocus
            />
            <button onClick={handleAdd} className="text-[var(--color-success)] text-xs">OK</button>
            <button onClick={() => setShowAdd(false)} className="text-[var(--color-text-muted)] text-xs">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] w-full px-1 py-1"
          >
            <Plus size={12} />
            Add script
          </button>
        )}
      </div>
    </div>
  );
}
