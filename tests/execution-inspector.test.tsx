import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ExecutionInspector from "@/components/ExecutionInspector";
import type { ExecutionInspection } from "@/lib/api";

afterEach(cleanup);

test("omitted test context explains retained data without claiming calls were absent", () => {
  const missing = { available: false, value: null };
  const inspection: ExecutionInspection = {
    execution: { executionId: "large-test", pipelineName: "deldo", status: "Completed", startedAt: "2026-10-08T00:00:00Z", durationMs: 1,
      errors: [], sources: {}, outputs: {}, isTest: true, testMode: "real" },
    pipeline: missing, idm: missing, sources: {}, outputs: {},
    testContext: { available: true, value: null, omitted: true, bytes: 90_000_000 },
  };
  render(<ExecutionInspector inspection={inspection} />);
  expect(screen.getByText("Test context")).toBeTruthy();
  expect(screen.getByText(/exceeds the inspection preview limit/).textContent).toContain((90_000_000).toLocaleString());
  expect(screen.queryByText("No connector calls recorded.")).toBeNull();
  expect(screen.queryByText("Trigger input")).toBeNull();
});
