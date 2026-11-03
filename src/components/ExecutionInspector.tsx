"use client";

import { useEffect, useState } from "react";
import WorkItems from "@/components/WorkItems";
import { Data, Details, ConnectorCalls } from "@/components/InspectionParts";
import { getExecutionInspection, type ConnectorCall, type ExecutionInspection, type SourceStepState, type OutputStepState } from "@/lib/api";

export default function ExecutionInspector({ inspection, executionId, refreshKey }: { inspection?: ExecutionInspection; executionId?: string; refreshKey?: string }) {
  const [loaded, setLoaded] = useState<{ id: string; data?: ExecutionInspection; error?: string }>();
  useEffect(() => {
    if (inspection || !executionId) return;
    let active = true;
    getExecutionInspection(executionId).then(data => {
      if (active) setLoaded({ id: executionId, data });
    }).catch(() => {
      if (active) setLoaded({ id: executionId, error: "Could not load execution data." });
    });
    return () => { active = false; };
  }, [executionId, inspection, refreshKey]);
  const result = loaded?.id === executionId ? loaded : undefined;
  const data = inspection ?? result?.data;
  if (!data) return <p className="text-xs p-3">{result?.error ?? "Loading execution data..."}</p>;
  const status = (value: string | number) => ({ 0: "Pending", 1: "Running", 2: "Completed", 3: "Failed", 4: "Waiting to retry", 5: "Awaiting review", 6: "Skipped" }[value] ?? value);
  const context = data.testContext.value as { input?: unknown; mocks?: unknown; calls?: ConnectorCall[] } | null;
  return <div className="p-3 space-y-2 overflow-auto text-[var(--color-text-secondary)]">
    <p className="text-xs">{data.execution.testMode === "mock" ? "Mock test" : data.execution.testMode === "real" ? "Real-system test" : "Execution"}
      {" / "}{status(data.execution.status)}{" / "}{data.execution.durationMs}ms</p>
    <p className="text-[10px] break-all">Revision {data.execution.revisionId ?? "unrecorded"}</p>
    {data.execution.contentFingerprint && <p className="text-xs break-all">File source: {data.execution.duplicateSource} / SHA-256: {data.execution.contentFingerprint}</p>}
    {data.execution.duplicateOf && <p className="text-xs">Matching content belongs to execution {data.execution.duplicateOf}.</p>}
    {data.execution.forceProcessing && <p className="text-xs">Operator requested forced processing of identical content.</p>}
    {data.execution.errors.map((error, i) => <p key={i} className="text-xs text-[var(--color-error)]">{error}</p>)}
    {data.execution.workProfile && <WorkItems key={data.execution.executionId} execution={data.execution} />}
    {data.testContext.available && <Details title={data.testContext.omitted ? "Test context" : "Trigger input"} document={data.testContext.omitted ? data.testContext : { available: true, value: context?.input }} />}
    {(["sources", "outputs"] as const).map(kind => Object.entries(data.execution[kind] as Record<string, SourceStepState | OutputStepState>).map(([name, step]) =>
      <details key={`${kind}/${name}`} className="border border-[var(--color-border)] rounded p-2">
        <summary className="cursor-pointer text-xs font-medium">{kind === "sources" ? "Source" : "Output"}: {name} / {status(step.status)}</summary>
        {step.nextAttemptAt && <p className="text-xs py-1">Next attempt: {new Date(step.nextAttemptAt).toLocaleString()}</p>}
        {step.outcomeUncertain && <p className="text-xs text-[var(--color-error)] py-1">The last external write may have completed.</p>}
        {step.errors.map((error, i) => <p key={i} className="text-xs text-[var(--color-error)] py-1">{error}</p>)}
        {(step.diagnostics ?? []).map((d, i) => <p key={i} className="text-xs py-1">{d.severity}: {d.reference}: {d.message}</p>)}
        <Data document={data[kind][name]} />
        {!!step.attempts?.length && <details className="mt-2 border border-[var(--color-border)] rounded p-2">
          <summary className="cursor-pointer text-xs">Attempts ({step.attempts.length})</summary>
          {step.attempts.map(attempt => <div key={attempt.attemptId} className="text-xs py-2 border-b border-[var(--color-border)] last:border-0 space-y-1">
            <p className="font-medium">Attempt {attempt.number} / {attempt.status}</p>
            <p>{new Date(attempt.startedAt).toLocaleString()}{attempt.completedAt && ` → ${new Date(attempt.completedAt).toLocaleString()}`}</p>
            <p className="font-mono break-all text-[var(--color-text-muted)]">{attempt.attemptId}</p>
            {attempt.error && <p className="text-[var(--color-error)] whitespace-pre-wrap break-all">{attempt.error}</p>}
            {attempt.diagnostics?.map((d, i) => <p key={i}>{d.severity}: {d.reference}: {d.message}</p>)}
            {!!attempt.calls?.length && <ConnectorCalls calls={attempt.calls} mock={data.execution.testMode === "mock"} />}
          </div>)}
        </details>}
      </details>))}
    <Details title="Merged data (IDM)" document={data.idm} />
    {data.testContext.available && !data.testContext.omitted && <>
      <ConnectorCalls calls={context?.calls} mock={data.execution.testMode === "mock"} />
      {context?.mocks != null && <Details title="Mock fixtures used" document={{ available: true, value: context.mocks }} />}
    </>}
    <Details title="Pipeline snapshot used" document={data.pipeline} />
  </div>;
}
