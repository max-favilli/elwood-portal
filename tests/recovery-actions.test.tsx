import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RecoveryActions from "@/components/RecoveryActions";
import * as api from "@/lib/api";

vi.mock("@/components/ManagementAccess", () => ({ useManagementSession: () => ({ permissions: ["recover"], pipelines: ["orders"] }) }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("@/lib/api")>(), getRecoveryOptions: vi.fn(), getPipelineRevisions: vi.fn(), replayExecution: vi.fn(), resumeExecution: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getPipelineRevisions).mockResolvedValue([]);
  vi.mocked(api.getRecoveryOptions).mockResolvedValue({ replayEnabled: true });
  vi.mocked(api.replayExecution).mockResolvedValue({ executionId: "replayed", replayOf: "original" });
});

test("distributed replay keeps its request after a lost response and requires both separate acknowledgements", async () => {
  vi.mocked(api.replayExecution).mockRejectedValueOnce(new Error("Lost response")).mockResolvedValueOnce({ executionId: "replayed", replayOf: "original" });
  const execution: api.ExecutionState = { pipelineName: "orders", startedAt: "2026-11-06T00:00:00Z", durationMs: 0, errors: [], executionId: "original", pipelineId: "orders",
    status: "Failed", durable: true, workProfile: "distributed-v1", sources: {}, outputs: {} };
  render(<RecoveryActions execution={execution} onRecovered={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Resume failed steps" })).toBeNull();
  fireEvent.click(screen.getByLabelText("Run all steps again using real systems and the selected revision."));
  fireEvent.click(screen.getByLabelText("I reviewed the uncertain external write and authorize a full replay, which may duplicate it."));
  expect((screen.getByRole("button", { name: "Start fresh replay" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("I authorize repeating completed deliveries in this whole-execution replay."));
  await waitFor(() => expect((screen.getByRole("button", { name: "Start fresh replay" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Start fresh replay" }));
  await screen.findByRole("alert");
  expect((screen.getByLabelText("Replay revision") as HTMLSelectElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Resend replay request" }));
  await waitFor(() => expect(api.replayExecution).toHaveBeenCalledTimes(2));
  const first = vi.mocked(api.replayExecution).mock.calls[0];
  expect(first).toEqual(vi.mocked(api.replayExecution).mock.calls[1]);
  expect(first[4]).toEqual({ requestId: expect.any(String), scope: "whole-execution", acknowledgeDuplicates: true });
});

test("distributed replay stays disabled when the host has not activated its profile", async () => {
  vi.mocked(api.getRecoveryOptions).mockResolvedValue({ replayEnabled: false });
  const execution: api.ExecutionState = { pipelineName: "orders", startedAt: "2026-11-06T00:00:00Z", durationMs: 0, errors: [], executionId: "original", pipelineId: "orders",
    status: "Completed", durable: true, workProfile: "distributed-v1", sources: {}, outputs: {} };
  render(<RecoveryActions execution={execution} onRecovered={vi.fn()} />);
  await waitFor(() => expect(api.getRecoveryOptions).toHaveBeenCalledWith("original"));
  expect(screen.getByText("Distributed replay is not enabled in this installation.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Start fresh replay" }) as HTMLButtonElement).disabled).toBe(true);
});
afterEach(cleanup);

test.each([false, true])("replay requires a separate uncertain-write acknowledgement when uncertain=%s", async uncertain => {
  const recovered = vi.fn();
  const execution: api.ExecutionState = { pipelineName: "orders", startedAt: "2026-10-07T00:00:00Z", durationMs: 0, errors: [], executionId: "original", pipelineId: "orders", status: "AwaitingReview", durable: true, isTest: false,
    sources: { remote: { sourceName: "remote", status: "AwaitingReview", errors: [], outcomeUncertain: uncertain } }, outputs: {} };
  render(<RecoveryActions execution={execution} onRecovered={recovered} />);
  const replay = screen.getByRole("button", { name: "Start fresh replay" }) as HTMLButtonElement;
  expect(replay.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("Run all steps again using real systems and the selected revision."));
  expect(replay.disabled).toBe(uncertain);
  if (uncertain) {
    fireEvent.click(replay);
    expect(api.replayExecution).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("I reviewed the uncertain external write and authorize a full replay, which may duplicate it."));
  }
  fireEvent.click(replay);
  await waitFor(() => expect(recovered).toHaveBeenCalledWith("replayed"));
  expect(api.replayExecution).toHaveBeenCalledExactlyOnceWith("original", undefined, uncertain, false);
});

test("skipped execution can explicitly force replay without enabling resume", async () => {
  const execution: api.ExecutionState = { pipelineName: "orders", startedAt: "2026-10-08T00:00:00Z", durationMs: 0, errors: [], executionId: "duplicate", pipelineId: "orders", status: "Skipped", durable: true, sources: {}, outputs: {} };
  render(<RecoveryActions execution={execution} onRecovered={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Resume failed steps" })).toBeNull();
  fireEvent.click(screen.getByLabelText("Run all steps again using real systems and the selected revision."));
  fireEvent.click(screen.getByLabelText(/Force processing of identical file content/));
  fireEvent.click(screen.getByRole("button", { name: "Start fresh replay" }));
  await waitFor(() => expect(api.replayExecution).toHaveBeenCalledExactlyOnceWith("duplicate", undefined, false, true));
});
