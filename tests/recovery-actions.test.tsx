import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import RecoveryActions from "@/components/RecoveryActions";
import * as api from "@/lib/api";

vi.mock("@/components/ManagementAccess", () => ({ useManagementSession: () => ({ permissions: ["recover"], pipelines: ["orders"] }) }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("@/lib/api")>(), getPipelineRevisions: vi.fn(), replayExecution: vi.fn(), resumeExecution: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getPipelineRevisions).mockResolvedValue([]);
  vi.mocked(api.replayExecution).mockResolvedValue({ executionId: "replayed", replayOf: "original" });
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
  expect(api.replayExecution).toHaveBeenCalledExactlyOnceWith("original", undefined, uncertain);
});
