"use client";

import { useEffect, useRef, useState } from "react";
import { apiError, canManage, type ExecutionState, type InspectionDocument } from "@/lib/api";
import { getWorkStages, getWorkItems, getWorkItem, inspectWorkItem, retryWorkItems,
  type WorkStage, type WorkItem, type WorkPage, type WorkDetail, type WorkInspection, type RetryRequest } from "@/lib/work-items";
import { useManagementSession } from "@/components/ManagementAccess";
import { ConnectorCalls } from "@/components/InspectionParts";

const control = "border border-[var(--color-border)] bg-[var(--color-bg-primary)] rounded px-2 py-1 disabled:opacity-40";
export default function WorkItems({ execution }: { execution: ExecutionState }) {
  const [stages, setStages] = useState<WorkStage[]>([]);
  const [chosen, setChosen] = useState("");
  const [error, setError] = useState("");
  const [refreshStages, setRefreshStages] = useState(0);
  const active = [0, 1, 4, "Pending", "Running", "Retrying"].includes(execution.status);
  useEffect(() => {
    let valid = true;
    const load = () => getWorkStages(execution.executionId).then(rows => { if (valid) { setStages(rows); setError(""); } })
      .catch(e => { if (valid) setError(apiError(e)); });
    void load();
    const timer = active ? setInterval(() => { void load(); }, 5000) : undefined;
    return () => { valid = false; if (timer) clearInterval(timer); };
  }, [execution.executionId, execution.status, active, refreshStages]);
  const stage = stages.find(s => s.stageId === chosen) ?? stages[0];
  return <section aria-label="Work items" className="border border-[var(--color-border)] rounded p-3 space-y-2 text-xs">
    <h3 className="font-semibold">Work items</h3>
    <button className={control} onClick={() => setRefreshStages(v => v + 1)}>Refresh stage counts</button>
    {error && <p role="alert">{error}</p>}
    {!!stages.length && <label>Stage <select className={control} value={stage?.stageId ?? ""} onChange={e => setChosen(e.target.value)}>
      {stages.map(s => <option key={s.stageId} value={s.stageId}>{s.stepType}: {s.stepName} ({s.itemCount} items)</option>)}
    </select></label>}
    {stage && <ItemTable key={`${execution.executionId}:${stage.stageId}:${stage.generation}`} execution={execution} stage={stage} />}
  </section>;
}

function ItemTable({ execution, stage }: { execution: ExecutionState; stage: WorkStage }) {
  const session = useManagementSession();
  const permitted = canManage(session, "recover", execution.pipelineId);
  const [filter, setFilter] = useState(""); const [cursor, setCursor] = useState<string>();
  const [page, setPage] = useState<WorkPage>(); const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Record<number, WorkItem>>({});
  const [detail, setDetail] = useState<WorkDetail>(); const [inspection, setInspection] = useState<WorkInspection>();
  const [lookup, setLookup] = useState(""); const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false); const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false); const [request, setRequest] = useState<RetryRequest>();
  const [decisions, setDecisions] = useState<string[]>([]);
  const detailSequence = useRef(0);
  const active = [0, 1, 4, "Pending", "Running", "Retrying"].includes(execution.status);
  useEffect(() => {
    let valid = true;
    const load = () => getWorkItems(execution.executionId, stage.stageId, filter, cursor)
      .then(data => { if (valid) { setPage(data); setError(""); } })
      .catch(e => { if (valid) setError(apiError(e)); });
    void load();
    const timer = active ? setInterval(() => { void load(); }, 5000) : undefined;
    return () => { valid = false; if (timer) clearInterval(timer); };
  }, [execution.executionId, stage.stageId, filter, cursor, refresh, active]);
  const items = Object.values(selected).sort((a, b) => a.ordinal - b.ordinal);
  const uncertain = items.some(i => i.uncertain);
  const locked = busy || !!request;
  const eligible = items.length > 0 && items.length <= 100 && confirmed && (!uncertain || reviewed);
  function toggle(item: WorkItem) {
    setSelected(previous => { const next = { ...previous }; if (next[item.ordinal]) delete next[item.ordinal]; else next[item.ordinal] = item; return next; });
    setConfirmed(false); setReviewed(false); setDecisions([]);
  }
  async function inspect(ordinal: number, attemptCursor?: string) {
    const sequence = ++detailSequence.current;
    setInspection(undefined); setError("");
    try {
      const result = await getWorkItem(execution.executionId, stage.stageId, ordinal, attemptCursor);
      if (sequence === detailSequence.current) setDetail(result);
    } catch (e) { if (sequence === detailSequence.current) setError(apiError(e)); }
  }
  async function data(attempt: number) {
    if (!detail) return;
    const sequence = ++detailSequence.current;
    setInspection(undefined);
    try {
      const result = await inspectWorkItem(execution.executionId, stage.stageId, detail.item.ordinal, attempt);
      if (sequence === detailSequence.current) setInspection(result);
    } catch (e) { if (sequence === detailSequence.current) setError(apiError(e)); }
  }
  async function retry() {
    if (!permitted || busy || !eligible && !request) return;
    const command = request ?? { requestId: crypto.randomUUID(), generation: stage.generation,
      items: items.map(i => ({ ordinal: i.ordinal, expectedAttempt: i.attempt, acknowledgeUncertain: i.uncertain && reviewed })) };
    setRequest(command); setBusy(true); setError("");
    try {
      const result = await retryWorkItems(execution.executionId, stage.stageId, command);
      setDecisions(result.items.map(i => `Item ${i.ordinal}: ${i.status}${i.reason ? ` — ${i.reason}` : ""}`));
      setSelected(previous => Object.fromEntries(Object.entries(previous).filter(([ordinal]) =>
        !result.items.some(i => i.ordinal === Number(ordinal) && i.status === "accepted"))));
      setRequest(undefined); setConfirmed(false); setReviewed(false); setRefresh(v => v + 1);
    } catch (e) { setError(`${apiError(e)} Resend this request to reconcile its outcome; its request ID is preserved.`); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <p className="break-all">Revision {stage.revisionId}</p>
    <p>{stage.itemCount} items; {stage.aggregatedItems} aggregated. Retry deadline: {new Date(stage.deadline).toLocaleString()}. History expires: {new Date(stage.expiresAt).toLocaleString()}.</p>
    {stage.counts ? <div aria-label="Stage status counts">
      <p>{stage.counts.completed} completed; {stage.counts.failed} failed; {stage.counts.awaitingReview} awaiting review; {stage.counts.running} running; {stage.counts.pending} pending; {stage.counts.retrying} retrying; {stage.counts.unknown} unknown.</p>
      <p>{stage.counts.complete ? "Full scan" : "Partial scan"}: {stage.counts.scanned} of {stage.itemCount} items observed from {new Date(stage.counts.startedAt).toLocaleString()} to {new Date(stage.counts.observedAt).toLocaleString()}. Counts are journal observations over that interval, not a live snapshot.</p>
    </div> : <p>Stage counts have not been observed yet. Missing observations are unknown.</p>}
    {stage.recoveryIssue && <p role="alert">{stage.recoveryIssue}</p>}
    <div className="flex flex-wrap gap-2 items-center">
      <label>Status <select className={control} value={filter} onChange={e => { setFilter(e.target.value); setCursor(undefined); setPage(undefined); }}>
        {["", "Pending", "Running", "Completed", "Failed", "AwaitingReview", "Retrying"].map(s => <option key={s} value={s}>{s || "All"}</option>)}
      </select></label>
      <button className={control} onClick={() => setRefresh(v => v + 1)}>Refresh items</button>
      <label>Ordinal <input className={`${control} w-20`} type="number" min="0" max={stage.itemCount - 1} value={lookup} onChange={e => setLookup(e.target.value)} /></label>
      <button className={control} disabled={lookup === "" || !Number.isInteger(Number(lookup)) || Number(lookup) < 0 || Number(lookup) >= stage.itemCount} onClick={() => inspect(Number(lookup))}>Inspect ordinal</button>
    </div>
    {page && <><p>Observed {new Date(page.observedAt).toLocaleTimeString()}. Scanned {page.scanned} items on this page; these are not whole-stage status counts.</p>
      <table className="w-full text-left"><thead><tr><th>Select</th><th>Ordinal</th><th>Status</th><th>Attempt</th><th>Details</th></tr></thead>
        <tbody>{page.items.map(item => <tr key={item.ordinal}>
          <td><input aria-label={`Select item ${item.ordinal}`} type="checkbox" checked={!!selected[item.ordinal]}
            disabled={!permitted || locked || !selected[item.ordinal] && (!item.canRetry || items.length >= 100)} onChange={() => toggle(item)} /></td>
          <td>{item.ordinal}</td><td>{item.status}{item.uncertain && " (uncertain write)"}</td><td>{item.attempt}</td>
          <td><button className={control} onClick={() => inspect(item.ordinal)}>Inspect item {item.ordinal}</button></td>
        </tr>)}</tbody></table>
      {!page.items.length && <p>No matching items in this scanned page.{page.nextCursor && " Continue to the next page."}</p>}
      <button className={control} disabled={!cursor} onClick={() => { setCursor(undefined); setPage(undefined); }}>First page</button>{" "}
      <button className={control} disabled={!page.nextCursor} onClick={() => { setCursor(page.nextCursor); setPage(undefined); }}>Next page</button>
    </>}
    {permitted && items.length > 0 && <div className="space-y-2 border-t pt-2">
      <p>Retry {items.map(i => `item ${i.ordinal}, attempt ${i.attempt}`).join("; ")} using revision {stage.revisionId}. Completed deliveries remain recorded.</p>
      <label className="block"><input type="checkbox" checked={confirmed} disabled={locked} onChange={e => setConfirmed(e.target.checked)} /> I confirm these selected items and attempts.</label>
      {uncertain && <label className="block"><input type="checkbox" checked={reviewed} disabled={locked} onChange={e => setReviewed(e.target.checked)} /> I reviewed the uncertain writes and authorize retries that may duplicate them.</label>}
      <button className={control} disabled={busy || !eligible && !request} onClick={retry}>{request ? "Resend retry request" : "Retry selected items"}</button>
    </div>}
    {decisions.map((decision, i) => <p role="status" key={i}>{decision}</p>)}
    {error && <p role="alert">{error}</p>}
    {detail && <aside aria-label={`Item ${detail.item.ordinal} details`} className="border rounded p-3 space-y-2">
      <div className="flex justify-between"><h4>Item {detail.item.ordinal} / {detail.item.status}</h4><button className={control} onClick={() => { ++detailSequence.current; setDetail(undefined); setInspection(undefined); }}>Close item</button></div>
      {detail.item.diagnostic && <p>{detail.item.diagnostic}</p>}
      <p>Completed destinations: {detail.completedDestinations.length ? detail.completedDestinations.map(i => i + 1).join(", ") : "none recorded"}</p>
      {detail.diagnostics.map((d, i) => <p key={i}>{d.severity}: {d.reference}: {d.message}</p>)}
      <p>{detail.attemptCount} retained attempts</p>
      {detail.historyOmitted && <p>The checkpoint exceeds the inspection limit. Its full history is retained; attempt details and delivery receipts are omitted here.</p>}
      {detail.diagnosticsOmitted && <p>Some attempt diagnostics exceed the page preview limit. The full checkpoint remains retained.</p>}
      {detail.attempts.map(a => <details key={a.attemptId}><summary>Attempt {a.number} / {a.status}</summary>
        {a.error && <p>{a.error}</p>}{a.diagnostics.map((d, i) => <p key={i}>{d.severity}: {d.message}</p>)}
        {detail.omittedCallAttempts?.includes(a.number) && <p>Some call details exceed the page preview limit and are omitted. The full checkpoint remains retained.</p>}
        {(a.calls.length > 0 || !detail.omittedCallAttempts?.includes(a.number)) && <ConnectorCalls calls={a.calls} mock={false} />}
        <button className={control} onClick={() => data(a.number)}>Load data for attempt {a.number}</button>
      </details>)}
      {detail.nextAttemptCursor && <button className={control} onClick={() => inspect(detail.item.ordinal, detail.nextAttemptCursor)}>Next attempts</button>}
      {inspection && <><Preview title="Item input" document={inspection.input} /><Preview title="Item output" document={inspection.output} />
        {Object.entries(inspection.receipts).map(([destination, document]) => <Preview key={destination} title={`Receipt for destination ${Number(destination) + 1}`} document={document} />)}</>}
    </aside>}
  </div>;
}

function Preview({ title, document }: { title: string; document: InspectionDocument }) {
  return <details><summary>{title}</summary>{document.omitted ? <p>Stored data exceeds the preview limit ({document.bytes?.toLocaleString()} bytes).</p>
    : document.available ? <pre className="whitespace-pre-wrap break-all">{JSON.stringify(document.value, null, 2)}</pre> : <p>No retained data.</p>}</details>;
}
