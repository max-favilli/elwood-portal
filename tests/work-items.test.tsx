import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkItems from "@/components/WorkItems";
import * as work from "@/lib/work-items";
import type { ExecutionState } from "@/lib/api";

vi.mock("@/components/ManagementAccess", () => ({ useManagementSession: () => ({ permissions: ["read", "recover"], pipelines: ["orders"] }) }));
vi.mock("@/lib/work-items", () => ({ getWorkStages: vi.fn(), getWorkItems: vi.fn(), getWorkItem: vi.fn(), inspectWorkItem: vi.fn(), retryWorkItems: vi.fn() }));
const execution: ExecutionState = { executionId: "execution", pipelineId: "orders", pipelineName: "orders", revisionId: "revision", status: "AwaitingReview",
  startedAt: "2026-11-03T12:00:00Z", durationMs: 1, sources: {}, outputs: {}, errors: [], durable: true, workProfile: "distributed-v1" };
const stage: work.WorkStage = { stageId: "output", stepName: "orders", stepType: "output", generation: "generation", revisionId: "revision", status: "AwaitingReview",
  itemCount: 3, aggregatedItems: 0, admitted: true, deadline: "2026-11-04T12:00:00Z", expiresAt: "2026-12-04T12:00:00Z" };
const done: work.WorkItem = { ordinal: 0, status: "Completed", attempt: 1, version: 2, uncertain: false, canRetry: false };
const review: work.WorkItem = { ordinal: 1, status: "AwaitingReview", attempt: 2, version: 4, uncertain: true, canRetry: true };
const page: work.WorkPage = { generation: "generation", observedAt: "2026-11-03T12:00:00Z", scanned: 2, items: [done, review] };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(work.getWorkStages).mockResolvedValue([stage]);
  vi.mocked(work.getWorkItems).mockResolvedValue(page);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

test("completed items cannot be selected; uncertain retries require a separate acknowledgement", async () => {
  vi.mocked(work.retryWorkItems).mockResolvedValue({ requestId: "id", generation: "generation", revisionId: "revision", items: [{ ordinal: 1, expectedAttempt: 2, status: "accepted" }] });
  render(<WorkItems execution={execution} />);
  expect((await screen.findByLabelText("Select item 0") as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("Select item 1"));
  const retry = screen.getByRole("button", { name: "Retry selected items" }) as HTMLButtonElement;
  fireEvent.click(screen.getByLabelText("I confirm these selected items and attempts."));
  expect(retry.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("I reviewed the uncertain writes and authorize retries that may duplicate them."));
  fireEvent.click(retry);
  await waitFor(() => expect(work.retryWorkItems).toHaveBeenCalledOnce());
  const body = vi.mocked(work.retryWorkItems).mock.calls[0][2];
  expect(body.generation).toBe("generation");
  expect(body.items).toEqual([{ ordinal: 1, expectedAttempt: 2, acknowledgeUncertain: true }]);
  expect(await screen.findByText("Item 1: accepted")).toBeTruthy();
});

test("lost retry response preserves request ID and selection until reconciliation", async () => {
  vi.mocked(work.retryWorkItems).mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce({ requestId: "id", generation: "generation", revisionId: "revision", items: [{ ordinal: 1, expectedAttempt: 2, status: "conflict", reason: "Attempt changed" }] });
  render(<WorkItems execution={execution} />);
  fireEvent.click(await screen.findByLabelText("Select item 1"));
  fireEvent.click(screen.getByLabelText("I confirm these selected items and attempts."));
  fireEvent.click(screen.getByLabelText("I reviewed the uncertain writes and authorize retries that may duplicate them."));
  fireEvent.click(screen.getByRole("button", { name: "Retry selected items" }));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Select item 1") as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Resend retry request" }));
  await screen.findByText("Item 1: conflict — Attempt changed");
  expect(vi.mocked(work.retryWorkItems).mock.calls[0][2]).toEqual(vi.mocked(work.retryWorkItems).mock.calls[1][2]);
  expect((screen.getByLabelText("Select item 1") as HTMLInputElement).checked).toBe(true);
});

test("empty filtered pages retain continuation and data loads only when requested", async () => {
  vi.mocked(work.getWorkItems).mockResolvedValueOnce({ ...page, items: [], nextCursor: "next" }).mockResolvedValue(page);
  vi.mocked(work.getWorkItem).mockResolvedValue({ item: done, generation: "generation", revisionId: "revision", attemptCount: 1, completedDestinations: [0],
    diagnostics: [{ severity: "warning", reference: "map", message: "Repeated scan" }],
    attempts: [{ number: 1, attemptId: "attempt", status: "Completed", startedAt: "2026-11-03T12:00:00Z", diagnostics: [], calls: [] }] });
  vi.mocked(work.inspectWorkItem).mockResolvedValue({ attempt: 1, input: { available: true, value: { id: 0 } }, output: { available: true, value: null, omitted: true, bytes: 1_000_000 }, receipts: {} });
  render(<WorkItems execution={execution} />);
  expect(await screen.findByText(/Continue to the next page/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  fireEvent.click(await screen.findByRole("button", { name: "Inspect item 0" }));
  expect(await screen.findByText("warning: map: Repeated scan")).toBeTruthy();
  expect(work.inspectWorkItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Load data for attempt 1"));
  expect(await screen.findByText(/Stored data exceeds the preview limit/)).toBeTruthy();
  expect(work.getWorkItems).toHaveBeenLastCalledWith("execution", "output", "", "next");
});

test("terminal executions do not poll item pages", async () => {
  render(<WorkItems execution={execution} />);
  await screen.findByLabelText("Select item 1");
  vi.useFakeTimers(); await vi.advanceTimersByTimeAsync(15_000);
  expect(work.getWorkItems).toHaveBeenCalledOnce();
});
