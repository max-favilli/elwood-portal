import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PipelineEditorPage from "@/app/pipelines/[id]/page";
import * as api from "@/lib/api";

const session = vi.hoisted(() => ({ name: "maintainer", permissions: ["READ", "WRITE", "TEST", "DEPLOY"], pipelines: ["ORDERS"] }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "orders" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/ManagementAccess", () => ({ useManagementSession: () => session }));
// Monaco depends on browser workers/layout; keep only its editor value boundary.
// The page, file tree, run panel, buttons, permissions and response UI are real.
vi.mock("next/dynamic", () => ({ default: () => function Editor(props: { value: string; onChange?: (value: string) => void; language?: string; path?: string; options?: { readOnly?: boolean } }) {
  return <textarea aria-label={props.path ?? props.language ?? "editor"} value={props.value} readOnly={props.options?.readOnly} onChange={event => props.onChange?.(event.target.value)} />;
} }));
vi.mock("@/lib/api", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  getPipeline: vi.fn(), savePipeline: vi.fn(), validatePipeline: vi.fn(), deployPipeline: vi.fn(),
  executePipeline: vi.fn(), getMockTemplate: vi.fn(), triggerViaEndpoint: vi.fn(),
}));

const saved = { id: "orders", content: { yaml: "name: orders\nmode: async\nsources: []\noutputs: []", scripts: { "map.elwood": "return $" } },
  draftRevisionId: "draft-old", activeRevisionId: "live-old", migrationRequired: false, lastModified: "2026-10-07T00:00:00Z" };
const edited = { yaml: saved.content.yaml + "\ndescription: editor changes", scripts: { "map.elwood": "return { changed: true }" } };

beforeEach(() => {
  vi.resetAllMocks();
  session.permissions = ["READ", "WRITE", "TEST", "DEPLOY"];
  vi.mocked(api.getPipeline).mockResolvedValue(structuredClone(saved));
  vi.mocked(api.validatePipeline).mockResolvedValue({ valid: true, errors: [], revisionId: "validated-snapshot" });
  vi.mocked(api.executePipeline).mockResolvedValue({ statusCode: 200, body: "{}", durationMs: 1 });
});
afterEach(cleanup);

async function openEditor(edit = false) {
  render(<PipelineEditorPage />);
  await screen.findByRole("button", { name: "Validate" });
  if (edit) {
    fireEvent.change(screen.getByRole("textbox", { name: "yaml" }), { target: { value: edited.yaml } });
    fireEvent.click(screen.getByText("map.elwood"));
    fireEvent.change(screen.getByRole("textbox", { name: "elwood" }), { target: { value: edited.scripts["map.elwood"] } });
  }
}

test("Validate uses the unsaved YAML and scripts without saving or deploying", async () => {
  await openEditor(true);
  fireEvent.click(screen.getByRole("button", { name: "Validate" }));
  await screen.findByText("Valid", { exact: true });
  expect(api.validatePipeline).toHaveBeenCalledExactlyOnceWith("orders", edited);
  expect(api.savePipeline).not.toHaveBeenCalled();
  expect(api.deployPipeline).not.toHaveBeenCalled();
  expect(screen.getByText("(unsaved)")).toBeDefined();
});

test.each(["real", "mock"] as const)("Test draft requires explicit %s mode and sends the exact unsaved snapshot", async testMode => {
  await openEditor(true);
  fireEvent.click(screen.getByRole("button", { name: "Test draft" }));
  const run = screen.getByRole("button", { name: "Run" }) as HTMLButtonElement;
  expect(run.disabled).toBe(true);
  fireEvent.click(run);
  expect(api.executePipeline).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Test connectors"), { target: { value: testMode } });
  fireEvent.change(screen.getByRole("textbox", { name: "test-input.json" }), { target: { value: '{"order":42}' } });
  const mocks = { sources: { remote: { body: { id: 7 } } }, outputs: {} };
  if (testMode === "mock") {
    fireEvent.click(screen.getByRole("button", { name: "Mock fixtures (JSON)" }));
    fireEvent.change(screen.getByRole("textbox", { name: "test-mocks.json" }), { target: { value: JSON.stringify(mocks) } });
  }
  expect(run.disabled).toBe(false);
  fireEvent.click(run);
  await screen.findByText(/Succeeded/);
  expect(api.executePipeline).toHaveBeenCalledExactlyOnceWith("orders", '{"order":42}',
    { testMode, ...(testMode === "mock" ? { mocks } : {}) }, edited, "draft-old");
  expect(api.savePipeline).not.toHaveBeenCalled();
  expect(api.deployPipeline).not.toHaveBeenCalled();
  expect(api.triggerViaEndpoint).not.toHaveBeenCalled();
});

test("Deploy waits for Save draft and sends the newly saved revision", async () => {
  await openEditor(true);
  const deploy = screen.getByRole("button", { name: "Deploy" }) as HTMLButtonElement;
  expect(deploy.disabled).toBe(true);
  fireEvent.click(deploy);
  expect(api.deployPipeline).not.toHaveBeenCalled();
  const updated = { ...saved, content: edited, draftRevisionId: "draft-new" };
  vi.mocked(api.savePipeline).mockResolvedValue(updated);
  vi.mocked(api.deployPipeline).mockResolvedValue({ ...updated, activeRevisionId: "draft-new" });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(deploy.disabled).toBe(false));
  expect(api.savePipeline).toHaveBeenCalledExactlyOnceWith("orders", edited, "draft-old");
  expect(api.deployPipeline).not.toHaveBeenCalled();
  fireEvent.click(deploy);
  await screen.findByText("Deployed: draft-new");
  expect(api.deployPipeline).toHaveBeenCalledExactlyOnceWith("orders", "draft-new");
});

test("Deploy displays a failed request without pretending publication succeeded", async () => {
  await openEditor();
  vi.mocked(api.deployPipeline).mockRejectedValue(new Error("The draft changed. Reload before deploying."));
  fireEvent.click(screen.getByRole("button", { name: "Deploy" }));
  await screen.findByText("The draft changed. Reload before deploying.");
  expect(screen.getByText("Deployed: live-old")).toBeDefined();
});

test("Read-only maintainers cannot save, validate, test or deploy", async () => {
  session.permissions = ["read"];
  await openEditor();
  for (const name of ["Save draft", "Validate", "Test draft", "Deploy"]) {
    const button = screen.getByRole("button", { name }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(api.savePipeline).not.toHaveBeenCalled(); expect(api.validatePipeline).not.toHaveBeenCalled();
  expect(api.executePipeline).not.toHaveBeenCalled(); expect(api.deployPipeline).not.toHaveBeenCalled();
});
