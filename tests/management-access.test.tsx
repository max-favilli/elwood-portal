import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ManagementAccess from "@/components/ManagementAccess";
import * as api from "@/lib/api";

vi.mock("next/navigation", () => ({ usePathname: () => "/pipelines" }));
vi.mock("@/lib/api", async original => ({ ...await original<typeof import("@/lib/api")>(), getManagementSession: vi.fn() }));
afterEach(() => { cleanup(); sessionStorage.clear(); vi.resetAllMocks(); });

test.each([401, 403, 503])("restoring a saved token with HTTP %i only clears it on 401", async status => {
  sessionStorage.setItem("elwood-management-token", "saved-token");
  vi.mocked(api.getManagementSession).mockRejectedValue({ isAxiosError: true, response: { status, data: { error: "Unavailable" } } });
  render(<ManagementAccess><div>Private content</div></ManagementAccess>);
  await screen.findByRole("alert");
  expect(sessionStorage.getItem("elwood-management-token")).toBe(status === 401 ? null : "saved-token");
  expect(screen.queryByText("Private content")).toBeNull();
});
