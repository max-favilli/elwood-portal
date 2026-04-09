"use client";

import Link from "next/link";
import { FileCode2, Play, Activity } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Welcome to the Elwood Management Portal. Start by creating or editing pipelines.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/pipelines"
          className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] transition-colors"
        >
          <FileCode2 size={24} className="text-[var(--color-accent)] mb-3" />
          <h2 className="text-sm font-medium mb-1">Pipelines</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Author, edit, and deploy integration pipelines
          </p>
        </Link>

        <Link
          href="/executions"
          className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] transition-colors"
        >
          <Play size={24} className="text-[var(--color-accent)] mb-3" />
          <h2 className="text-sm font-medium mb-1">Executions</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            Monitor pipeline runs and inspect state
          </p>
        </Link>

        <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg">
          <Activity size={24} className="text-[var(--color-success)] mb-3" />
          <h2 className="text-sm font-medium mb-1">Runtime Health</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            API status will appear here when connected
          </p>
        </div>
      </div>
    </div>
  );
}
