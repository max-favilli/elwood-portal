"use client";

import { useEffect, useState } from "react";
import { getExecutionInspection, type ConnectorCall, type ExecutionInspection, type InspectionDocument, type SourceStepState, type OutputStepState } from "@/lib/api";

function Data({ document }: { document?: InspectionDocument }) {
  return document?.available
    ? <pre className="text-xs whitespace-pre-wrap break-all p-2 bg-[var(--color-bg-primary)] rounded">{JSON.stringify(document.value, null, 2)}</pre>
    : <p className="text-xs text-[var(--color-text-muted)] p-2">No stored data for this step.</p>;
}

function Details({ title, document }: { title: string; document?: InspectionDocument }) {
  return <details className="border border-[var(--color-border)] rounded p-2">
    <summary className="cursor-pointer text-xs font-medium">{title}</summary>
    <Data document={document} />
  </details>;
}

function Headers({ headers }: { headers?: Record<string, string[]> | null }) {
  if (!headers) return <p className="text-xs text-[var(--color-text-muted)]">Not recorded.</p>;
  const entries = Object.entries(headers);
  if (!entries.length) return <p className="text-xs text-[var(--color-text-muted)]">No headers.</p>;
  return <dl className="text-xs bg-[var(--color-bg-primary)] rounded p-2 space-y-1">
    {entries.map(([name, values]) => <div key={name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
      <dt className="font-medium break-all">{name}</dt>
      <dd className="whitespace-pre-wrap break-all font-mono">{values.join("\n")}</dd>
    </div>)}
  </dl>;
}

function Body({ title, value, bytes, truncated }: { title: string; value?: string | null; bytes?: number | null; truncated?: boolean }) {
  let formatted = value ?? "No body.";
  if (value) { try { formatted = JSON.stringify(JSON.parse(value), null, 2); } catch { /* Keep non-JSON responses readable. */ } }
  return <details className="border border-[var(--color-border)] rounded p-2">
    <summary className="cursor-pointer text-xs">{title}</summary>
    {truncated && <p className="text-xs py-1">{value == null ? "Body not captured" : "Preview truncated"}{bytes != null && ` (${bytes.toLocaleString()} bytes total)`}.</p>}
    <pre className="text-xs whitespace-pre-wrap break-all bg-[var(--color-bg-primary)] rounded p-2 mt-2">{formatted || "Empty body."}</pre>
  </details>;
}

function ConnectorCalls({ calls, mock }: { calls?: ConnectorCall[]; mock: boolean }) {
  return <details className="border border-[var(--color-border)] rounded p-2">
    <summary className="cursor-pointer text-xs font-medium">Connector calls ({calls?.length ?? 0})</summary>
    <p className="text-xs text-[var(--color-text-muted)] py-2">Sensitive headers and credential query parameters are redacted. Bodies retain the submitted and returned data.</p>
    {mock && <p className="text-xs text-[var(--color-text-muted)] pb-2">Mock calls use the supplied fixtures; no network request is sent.</p>}
    {!calls?.length && <p className="text-xs">No connector calls recorded.</p>}
    <div className="space-y-2">{calls?.map((call, index) => <details key={index} className="border border-[var(--color-border)] rounded p-2" open={index === 0}>
      <summary className="cursor-pointer text-xs font-medium break-words">
        {call.kind === "source" ? "Source" : "Output"}: {call.step}
        {call.destinationIndex != null && ` / destination ${call.destinationIndex + 1}`}
        {call.connector && ` / ${call.connector}`}
        {(call.operation ?? call.method) && ` / ${call.operation ?? call.method}`}
        {call.statusCode != null ? ` / HTTP ${call.statusCode}` : call.connector && call.connector !== "http" ? call.error ? " / failed" : " / completed" : " / no response"}
        {call.durationMs != null && ` / ${Math.round(call.durationMs)}ms`}
      </summary>
      <div className="space-y-2 pt-2 text-xs">
        {!call.method && !call.connector && <p className="text-[var(--color-text-muted)]">HTTP details were not recorded for this call. Run the test again to capture them.</p>}
        {call.url && <p className="font-mono break-all">{call.method} {call.url}</p>}
        {call.startedAt && <p>Started: {new Date(call.startedAt).toLocaleString()}
          {call.timeoutMs != null && ` / Timeout: ${call.timeoutMs}ms`}</p>}
        {call.error && <p className="text-[var(--color-error)] whitespace-pre-wrap break-all">{call.error}</p>}
        {call.requestMetadata && <Details title="Request details" document={{ available: true, value: call.requestMetadata }} />}
        {(!call.connector || call.connector === "http") && <><h4 className="font-medium">Request headers</h4>
        <Headers headers={call.requestHeaders} /></>}
        <Body title="Request body" value={call.requestBody} bytes={call.requestBodyBytes} truncated={call.requestBodyTruncated} />
        <h4 className="font-medium">Response{call.statusCode != null && `: ${call.statusCode} ${call.reasonPhrase ?? ""}`}
          {call.httpVersion && ` (HTTP/${call.httpVersion})`}</h4>
        {call.responseMetadata && <Details title="Response details" document={{ available: true, value: call.responseMetadata }} />}
        {call.connector && call.connector !== "http" ? <Body title="Result / receipt" value={call.responseBody} bytes={call.responseBodyBytes} truncated={call.responseBodyTruncated} /> : call.statusCode == null ? <p className="text-[var(--color-text-muted)]">No HTTP response received.</p> : <>
          <h4 className="font-medium">Response headers</h4>
          <Headers headers={call.responseHeaders} />
          <Body title="Response body" value={call.responseBody} bytes={call.responseBodyBytes} truncated={call.responseBodyTruncated} />
        </>}
      </div>
    </details>)}</div>
  </details>;
}

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
  const status = (value: string | number) => ({ 0: "Pending", 1: "Running", 2: "Completed", 3: "Failed", 4: "Waiting to retry", 5: "Awaiting review" }[value] ?? value);
  const context = data.testContext.value as { input?: unknown; mocks?: unknown; calls?: ConnectorCall[] } | null;
  return <div className="p-3 space-y-2 overflow-auto text-[var(--color-text-secondary)]">
    <p className="text-xs">{data.execution.testMode === "mock" ? "Mock test" : data.execution.testMode === "real" ? "Real-system test" : "Execution"}
      {" / "}{status(data.execution.status)}{" / "}{data.execution.durationMs}ms</p>
    <p className="text-[10px] break-all">Revision {data.execution.revisionId ?? "unrecorded"}</p>
    {data.execution.errors.map((error, i) => <p key={i} className="text-xs text-[var(--color-error)]">{error}</p>)}
    {data.testContext.available && <Details title="Trigger input" document={{ available: true, value: context?.input }} />}
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
    {data.testContext.available && <>
      <ConnectorCalls calls={context?.calls} mock={data.execution.testMode === "mock"} />
      {context?.mocks != null && <Details title="Mock fixtures used" document={{ available: true, value: context.mocks }} />}
    </>}
    <Details title="Pipeline snapshot used" document={data.pipeline} />
  </div>;
}
