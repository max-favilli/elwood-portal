"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPipeline } from "@/lib/api";

export default function NewPipelinePage() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const pipelineId = id.trim().toLowerCase().replace(/\s+/g, "-");
    if (!pipelineId) return;

    setCreating(true);
    setError(null);
    try {
      await createPipeline(pipelineId, {
        yaml: `version: 2\nname: ${pipelineId}\ndescription: ""\nmode: sync\n\nsources:\n  - name: api-trigger\n    trigger: http\n    contentType: json\n\noutputs:\n  - name: api-response\n    response: true\n`,
        scripts: {},
      });
      router.push(`/pipelines/${pipelineId}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to create pipeline");
      setCreating(false);
    }
  }

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-semibold mb-6">New Pipeline</h1>
      <form onSubmit={handleCreate}>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-2">
          Pipeline ID
        </label>
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="e.g. order-sync"
          className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded text-sm outline-none focus:border-[var(--color-accent)] mb-4"
          autoFocus
        />
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Lowercase, hyphens allowed. This becomes the pipeline folder name.
        </p>
        {error && (
          <div className="p-3 mb-4 bg-[var(--color-error-bg)] border border-[var(--color-error)] rounded text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={creating || !id.trim()}
          className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Pipeline"}
        </button>
      </form>
    </div>
  );
}
