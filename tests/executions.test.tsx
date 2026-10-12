import { afterEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import ExecutionsPage from "@/app/executions/page";
import * as api from "@/lib/api";

vi.mock("@/components/ExecutionInspector", () => ({ default: () => <div>Inspector</div> }));
vi.mock("@/components/RecoveryActions", () => ({ default: ({ onRecovered }: { onRecovered: (id: string) => void }) => <button onClick={() => onRecovered("run")}>Resume test</button> }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("@/lib/api")>(), listExecutions: vi.fn(), getExecution: vi.fn() }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });

test.each(["Completed", "Failed", "AwaitingReview", "Skipped"] as const)("polling stops on %s and restarts after explicit recovery", async status => {
  vi.useFakeTimers();
  const execution: api.ExecutionState = { executionId: "run", pipelineName: "orders", status: "Running", startedAt: "2026-10-12T00:00:00Z", durationMs: 0, errors: [], sources: {}, outputs: {} };
  vi.mocked(api.listExecutions).mockResolvedValue([execution]);
  vi.mocked(api.getExecution).mockResolvedValue({ ...execution, status });
  await act(async () => { render(<ExecutionsPage />); });
  fireEvent.click(screen.getByText("orders"));
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(api.getExecution).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(api.getExecution).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resume test" })); });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(api.getExecution).toHaveBeenCalledTimes(2);
});
