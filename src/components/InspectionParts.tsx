"use client";
import type { ConnectorCall, InspectionDocument } from "@/lib/api";
export function Data({ document }: { document?: InspectionDocument }) {
  if (document?.omitted) return <p className="text-xs p-2">Stored data{document.bytes != null && ` (${document.bytes.toLocaleString()} bytes)`} exceeds the inspection preview limit. The full document remains retained.</p>;
  return document?.available
    ? <pre className="text-xs whitespace-pre-wrap break-all p-2 bg-[var(--color-bg-primary)] rounded">{JSON.stringify(document.value, null, 2)}</pre>
    : <p className="text-xs text-[var(--color-text-muted)] p-2">No stored data for this step.</p>;
}

export function Details({ title, document }: { title: string; document?: InspectionDocument }) {
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

export function ConnectorCalls({ calls, mock }: { calls?: ConnectorCall[]; mock: boolean }) {
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
