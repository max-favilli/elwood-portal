"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, FileCode2 } from "lucide-react";
import { listPipelines, type PipelineSummary } from "@/lib/api";

export default function PipelineListPage() {
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPipelines();
  }, []);

  async function loadPipelines() {
    setLoading(true);
    setError(null);
    try {
      const data = await listPipelines(search || undefined);
      setPipelines(data);
    } catch (err) {
      setError(
        "Failed to load pipelines. Is the Elwood Runtime API running? " +
        "(cd Elwood/dotnet/src/Elwood.Runtime.Api && dotnet run)"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadPipelines();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Pipelines</h1>
        <Link
          href="/pipelines/new"
          className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Pipeline
        </Link>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded px-3 py-2 max-w-md">
          <Search size={16} className="text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pipelines..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
          />
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div className="p-4 mb-6 bg-[var(--color-error-bg)] border border-[var(--color-error)] rounded text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <p className="text-sm text-[var(--color-text-muted)]">Loading pipelines...</p>
      )}

      {/* Empty state */}
      {!loading && !error && pipelines.length === 0 && (
        <div className="text-center py-16">
          <FileCode2 size={48} className="mx-auto mb-4 text-[var(--color-text-muted)]" />
          <p className="text-[var(--color-text-secondary)] mb-2">No pipelines yet</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Create your first pipeline to get started
          </p>
        </div>
      )}

      {/* Pipeline list */}
      {!loading && pipelines.length > 0 && (
        <div className="border border-[var(--color-border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium text-center">Sources</th>
                <th className="px-4 py-3 font-medium text-center">Outputs</th>
                <th className="px-4 py-3 font-medium">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/pipelines/${p.id}`}
                      className="text-[var(--color-accent)] hover:underline font-medium"
                    >
                      {p.name || p.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {p.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">{p.sourceCount}</td>
                  <td className="px-4 py-3 text-center">{p.outputCount}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">
                    {new Date(p.lastModified).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
