"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useManagementSession } from "@/components/ManagementAccess";
import { createPipeline, canManage } from "@/lib/api";
import sampleData from "@/data/pipeline-samples.json";
import type { PipelineSample } from "@/lib/pipeline-samples";
import { sampleContent } from "@/lib/pipeline-samples";
import { isAxiosError } from "axios";

const samples = sampleData as PipelineSample[];

export default function NewPipelinePage() {
  const session = useManagementSession();
  const router = useRouter();
  const [sampleId, setSampleId] = useState("");
  const sample = samples.find(sample => sample.id === sampleId);
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const pipelineId = id.trim().toLowerCase().replace(/\s+/g, "-");
    if (!pipelineId || !canManage(session, "write", pipelineId)) return;

    setCreating(true);
    setError(null);
    try {
      await createPipeline(pipelineId, sample ? sampleContent(sample, pipelineId) : {
        yaml: `version: 2\nname: ${pipelineId}\ndescription: ""\nmode: sync\n\nsources:\n  - name: api-trigger\n    trigger: http\n    contentType: json\n\noutputs:\n  - name: api-response\n    response: true\n`,
        scripts: {},
      });
      router.push(`/pipelines/${pipelineId}`);
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      const serverMsg = isAxiosError(err) ? err.response?.data?.error : undefined;
      if (status === 409) {
        setError(`Pipeline '${pipelineId}' already exists. Choose a different ID.`);
      } else {
        setError(serverMsg || (err instanceof Error ? err.message : "Failed to create pipeline"));
      }
      setCreating(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl overflow-auto h-full">
      <h1 className="text-2xl font-semibold mb-6">New Pipeline</h1>
      <form onSubmit={handleCreate}>
        <label htmlFor="pipeline-template" className="block text-sm mb-2">Start from</label>
        <select id="pipeline-template" value={sampleId} disabled={creating}
          onChange={e => {
            const next = e.target.value;
            setSampleId(next);
            if (!id || id === sampleId) setId(next);
          }}
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-sm mb-4">
          <option value="">Blank pipeline</option>
          {samples.map(sample => <option key={sample.id} value={sample.id}>{sample.title}</option>)}
        </select>
        {sample && <div className="mb-4 p-3 rounded border border-[var(--color-border)] text-sm space-y-2">
          <p>{sample.description}</p>
          <p className="text-[var(--color-text-secondary)]">{sample.expectedOutcome}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{sample.realNotes}</p>
          <p className="text-xs">Sample input and mock fixtures will be loaded in Test draft. Choose a connector mode before running.</p>
        </div>}
        <label htmlFor="pipeline-id" className="block text-sm text-[var(--color-text-secondary)] mb-2">
          Pipeline ID
        </label>
        <input
          id="pipeline-id"
          disabled={creating}
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="e.g. order-sync"
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-sm outline-none focus:border-[var(--color-accent)] mb-4"
          autoFocus
        />
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Lowercase, hyphens allowed. New pipelines are drafts until explicitly deployed.
        </p>
        {error && (
          <div className="p-3 mb-4 bg-[var(--color-error-bg)] border border-[var(--color-error)] rounded text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={creating || !id.trim() || !canManage(session, "write", id.trim().toLowerCase().replace(/\s+/g, "-"))}
          className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create draft"}
        </button>
      </form>
    </div>
  );
}
