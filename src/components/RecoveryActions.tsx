"use client";

import { useEffect, useState } from "react";
import { apiError, canManage, getPipelineRevisions, getRecoveryOptions, replayExecution, resumeExecution, type DistributedReplay, type ExecutionState, type PipelineRevision } from "@/lib/api";
import { useManagementSession } from "@/components/ManagementAccess";

type RecoveryProps = { execution: ExecutionState; onRecovered: (id: string) => void };
export default function RecoveryActions(props: RecoveryProps) {
  return <RecoveryForm key={`${props.execution.executionId}:${props.execution.status}`} {...props} />;
}

function RecoveryForm({ execution, onRecovered }: RecoveryProps) {
  const session = useManagementSession();
  const [revisions, setRevisions] = useState<PipelineRevision[]>([]);
  const [revision, setRevision] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [replayReviewed, setReplayReviewed] = useState(false);
  const [forceProcessing, setForceProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicatesReviewed, setDuplicatesReviewed] = useState(false);
  const [replayRequest, setReplayRequest] = useState<DistributedReplay>();
  const [replayEnabled, setReplayEnabled] = useState(!execution.workProfile);
  const locked = busy || !!replayRequest;
  const terminal = [2, 3, 5, 6, "Completed", "Failed", "AwaitingReview", "Skipped"].includes(execution.status);
  const canRecover = execution.durable && !execution.isTest && terminal && canManage(session, "recover", execution.pipelineId);
  // A deadline can settle a parent before every in-flight child reports its outcome.
  const uncertain = !!execution.workProfile || [...Object.values(execution.sources), ...Object.values(execution.outputs)].some(step => step.outcomeUncertain);
  const failed = [3, 5, "Failed", "AwaitingReview"].includes(execution.status);

  useEffect(() => {
    if (!canRecover || !execution.pipelineId) return;
    let active = true;
    getPipelineRevisions(execution.pipelineId).then(data => { if (active) setRevisions(data); })
      .catch(() => { if (active) setRevisions([]); });
    if (execution.workProfile) getRecoveryOptions(execution.executionId).then(data => { if (active) setReplayEnabled(data.replayEnabled); })
      .catch(e => { if (active) setError(apiError(e)); });
    return () => { active = false; };
  }, [canRecover, execution.pipelineId, execution.executionId, execution.workProfile]);

  if (!canRecover) return null;
  async function recover(action: "resume" | "replay") {
    setBusy(true); setError("");
    try {
      const command = action === "replay" && execution.workProfile ? replayRequest ?? {
        requestId: crypto.randomUUID(), scope: "whole-execution" as const, acknowledgeDuplicates: duplicatesReviewed,
      } : undefined;
      if (command) setReplayRequest(command);
      const result = action === "resume" ? await resumeExecution(execution.executionId, reviewed)
        : command ? await replayExecution(execution.executionId, revision || undefined, replayReviewed, forceProcessing, command)
        : await replayExecution(execution.executionId, revision || undefined, replayReviewed, forceProcessing);
      onRecovered(result.executionId); setConfirmed(false); setReviewed(false); setReplayReviewed(false); setForceProcessing(false);
      setReplayRequest(undefined); setDuplicatesReviewed(false);
    } catch (error) { setError(`${apiError(error)}${execution.workProfile ? " Resend the same replay request to reconcile its outcome." : ""}`); }
    finally { setBusy(false); }
  }
  return <div className="border border-[var(--color-border)] rounded p-3 mb-5 space-y-3 text-xs">
    <h3 className="font-semibold">Recovery</h3>
    {execution.supersededByForcedReplay && <p>This execution was superseded by a forced replay and cannot resume.</p>}
    {execution.workProfile && <p>Use item recovery in Steps and data to retry selected failures while preserving completed deliveries. Replay runs the whole pipeline again.</p>}
    {execution.workProfile && !replayEnabled && <p>Distributed replay is not enabled in this installation.</p>}
    {!execution.workProfile && failed && !execution.supersededByForcedReplay && <div className="space-y-2">
      <p>Resume reuses completed results and deliveries, continuing with the original pipeline revision.</p>
      {uncertain && <label className="flex gap-2 items-start">
        <input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} />
        I reviewed the uncertain external write and authorize another attempt, which may duplicate it.
      </label>}
      <button disabled={busy || (uncertain && !reviewed)} onClick={() => recover("resume")}
        className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-white disabled:opacity-40">Resume failed steps</button>
    </div>}
    <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
      <p>Replay creates a new execution from the original input. The pipeline&apos;s duplicate policy still applies unless you explicitly override it.</p>
      <label className="flex gap-2 items-center">Replay revision
        <select value={revision} disabled={locked} onChange={e => { setRevision(e.target.value); setConfirmed(false); setReplayReviewed(false); setDuplicatesReviewed(false); setForceProcessing(false); }}
          className="bg-[var(--color-bg-tertiary)] rounded border border-[var(--color-border)] p-1">
          <option value="">Original ({execution.revisionId?.slice(0, 12) ?? "saved snapshot"})</option>
          {revisions.filter(r => r.revisionId !== execution.revisionId).map(r => <option key={r.revisionId} value={r.revisionId}>
            {r.revisionId.slice(0, 12)} — {new Date(r.timestamp).toLocaleString()}
          </option>)}
        </select>
      </label>
      <label className="flex gap-2 items-start"><input type="checkbox" checked={confirmed} disabled={locked} onChange={e => setConfirmed(e.target.checked)} />
        Run all steps again using real systems and the selected revision.</label>
      {execution.workProfile && <label className="flex gap-2 items-start"><input type="checkbox" checked={duplicatesReviewed} disabled={locked} onChange={e => setDuplicatesReviewed(e.target.checked)} />
        I authorize repeating completed deliveries in this whole-execution replay.</label>}
      <label className="flex gap-2 items-start"><input type="checkbox" checked={forceProcessing} disabled={locked} onChange={e => setForceProcessing(e.target.checked)} />
        Force processing of identical file content. This may repeat completed deliveries and prevents resuming this original execution.</label>
      {uncertain && <label className="flex gap-2 items-start">
        <input type="checkbox" checked={replayReviewed} disabled={locked} onChange={e => setReplayReviewed(e.target.checked)} />
        I reviewed the uncertain external write and authorize a full replay, which may duplicate it.
      </label>}
      <button disabled={busy || !replayEnabled || !confirmed || (uncertain && !replayReviewed) || (!!execution.workProfile && !duplicatesReviewed)} onClick={() => recover("replay")}
        className="px-3 py-1.5 rounded border border-[var(--color-border)] disabled:opacity-40">{replayRequest ? "Resend replay request" : "Start fresh replay"}</button>
    </div>
    {busy && <p>Submitting recovery request...</p>}
    {error && <p role="alert" className="text-[var(--color-error)]">{error}</p>}
  </div>;
}
