import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnsV2RoleResult } from "@atlas/schemas";
import type { ApiResult } from "@/api/types";
import { atlasClient } from "@/api/atlasClient";
import { EnsV2PermissionPanel } from "./EnsV2PermissionPanel";

const authorizedAccount = "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3";

function proof(authorized: boolean): ApiResult<EnsV2RoleResult> {
  return {
    kind: "ok",
    data: {
      kind: "ensv2-eac-role",
      chainId: 11155111,
      registry: "0xd4ebcbbdf463c9c45784603db0ddd499bc44a8b4" as EnsV2RoleResult["registry"],
      account: (authorized
        ? authorizedAccount
        : "0xad797f58afd3265c00504382171ec0818262d3ca") as EnsV2RoleResult["account"],
      resource: "0",
      requiredRoles: "1",
      roleBitmap: authorized ? "1" : "0",
      authorized,
      blockNumber: "12345",
      warnings: ["Read-only registry evidence at block 12345."],
      ...(authorized
        ? {
            publisher: {
              name: "atlas.eth",
              owner: authorizedAccount as EnsV2RoleResult["account"],
              resolver: null,
            },
          }
        : {}),
    },
  };
}

function renderPanel() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<EnsV2PermissionPanel />));
  return { container, root };
}

function field(container: HTMLElement, id: string): HTMLInputElement | HTMLSelectElement {
  const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
  if (!element) throw new Error(`Missing form field: ${id}`);
  return element;
}

function changeField(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  if (!setter) throw new Error("Unable to set form field value.");
  setter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function setField(
  container: HTMLElement,
  id: string,
  value: string,
): Promise<HTMLInputElement | HTMLSelectElement> {
  const element = field(container, id);
  await act(async () => changeField(element, value));
  return element;
}

async function click(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing control: ${selector}`);
  await act(async () => element.click());
}

async function submit(container: HTMLElement) {
  const form = container.querySelector("form");
  if (!form) throw new Error("Missing permission form.");
  await act(async () =>
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

let mounted: { container: HTMLElement; root: Root }[] = [];

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  for (const { container, root } of mounted) {
    act(() => root.unmount());
    container.remove();
  }
  mounted = [];
  vi.restoreAllMocks();
});

describe("ENSv2 permission explorer", () => {
  it("validates account addresses before enabling a request", async () => {
    const { container, root } = renderPanel();
    mounted.push({ container, root });

    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitButton?.disabled).toBe(true);

    const account = await setField(container, "ensv2-account", "0x1234");
    expect(account.getAttribute("aria-invalid")).toBe("true");
    expect(submitButton?.disabled).toBe(true);

    await setField(container, "ensv2-account", authorizedAccount);
    expect(field(container, "ensv2-account").getAttribute("aria-invalid")).toBe("false");
    expect(submitButton?.disabled).toBe(false);
  });

  it("validates custom roles and advanced resources as decimal uint256 values", async () => {
    const { container, root } = renderPanel();
    mounted.push({ container, root });
    await setField(container, "ensv2-account", authorizedAccount);
    await setField(container, "ensv2-role", "custom");
    const customRole = await setField(container, "ensv2-custom-role", "1e3");
    const submitButton = container.querySelector<HTMLButtonElement>('button[type="submit"]');

    expect(customRole.getAttribute("aria-invalid")).toBe("true");
    expect(submitButton?.disabled).toBe(true);

    await setField(container, "ensv2-custom-role", "1");
    const resourceScope = container.querySelector<HTMLInputElement>(
      'input[name="ensv2-scope"][value="resource"]',
    );
    if (!resourceScope) throw new Error("Missing advanced resource scope option.");
    await act(async () => resourceScope.click());
    const resource = await setField(container, "ensv2-resource", "01");

    expect(resource.getAttribute("aria-invalid")).toBe("true");
    expect(submitButton?.disabled).toBe(true);
  });

  it("submits a root permission request and renders authorized registry evidence", async () => {
    const check = vi.spyOn(atlasClient, "checkEnsV2Role").mockResolvedValue(proof(true));
    const { container, root } = renderPanel();
    mounted.push({ container, root });
    await setField(container, "ensv2-account", authorizedAccount);
    await submit(container);

    expect(check).toHaveBeenCalledWith({
      account: authorizedAccount,
      resource: "0",
      role: "1",
    });
    expect(container.textContent).toContain("Authorized");
    expect(container.textContent).toContain("11155111");
    expect(container.textContent).toContain("12345");
    expect(container.textContent).toContain("Read-only registry evidence at block 12345.");
    expect(container.textContent).toContain("Publisher owner");
    expect(container.querySelector('a[href*="sepolia.etherscan.io/address/"]')).not.toBeNull();
  });

  it("renders a denied result without implying ownership", async () => {
    const check = vi.spyOn(atlasClient, "checkEnsV2Role").mockResolvedValue(proof(false));
    const { container, root } = renderPanel();
    mounted.push({ container, root });
    await click(container, 'button[type="button"]');

    expect(check).toHaveBeenCalledWith({
      account: authorizedAccount,
      resource: "0",
      role: "1",
    });
    expect(container.textContent).toContain("Denied");
    expect(container.textContent).toContain("root registrar role does not prove");
  });

  it("sends a name or resource, never both", async () => {
    const check = vi.spyOn(atlasClient, "checkEnsV2Role").mockResolvedValue(proof(true));
    const { container, root } = renderPanel();
    mounted.push({ container, root });
    await setField(container, "ensv2-account", authorizedAccount);
    const nameScope = container.querySelector<HTMLInputElement>(
      'input[name="ensv2-scope"][value="name"]',
    );
    if (!nameScope) throw new Error("Missing ENS name scope option.");
    await act(async () => nameScope.click());
    await setField(container, "ensv2-name", "atlas.eth");
    await submit(container);

    expect(check).toHaveBeenLastCalledWith({
      account: authorizedAccount,
      name: "atlas.eth",
      role: "1",
    });
    expect(check.mock.calls.at(-1)?.[0]).not.toHaveProperty("resource");

    const resourceScope = container.querySelector<HTMLInputElement>(
      'input[name="ensv2-scope"][value="resource"]',
    );
    if (!resourceScope) throw new Error("Missing advanced resource scope option.");
    await act(async () => resourceScope.click());
    await setField(container, "ensv2-resource", "42");
    await submit(container);

    expect(check).toHaveBeenLastCalledWith({
      account: authorizedAccount,
      resource: "42",
      role: "1",
    });
    expect(check.mock.calls.at(-1)?.[0]).not.toHaveProperty("name");
  });

  it("labels examples as real requests and queries the API instead of rendering fixture results", async () => {
    const check = vi
      .spyOn(atlasClient, "checkEnsV2Role")
      .mockResolvedValueOnce(proof(true))
      .mockResolvedValueOnce(proof(false));
    const { container, root } = renderPanel();
    mounted.push({ container, root });

    const exampleButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
      button.textContent?.includes("real on-chain request"),
    );
    expect(exampleButtons).toHaveLength(2);
    await act(async () => exampleButtons[0]?.click());
    expect(check).toHaveBeenNthCalledWith(1, {
      account: "0xf633e7fc17e2bbe0d0965d18ec1821dcb754a3d3",
      resource: "0",
      role: "1",
    });
    expect(container.textContent).toContain("Authorized");

    await act(async () => exampleButtons[1]?.click());
    expect(check).toHaveBeenNthCalledWith(2, {
      account: "0xAd797f58aFD3265C00504382171eC0818262D3ca",
      resource: "0",
      role: "1",
    });
    expect(container.textContent).toContain("Denied");
  });

  it("surfaces unconfigured, rate-limited and network error states", async () => {
    const check = vi
      .spyOn(atlasClient, "checkEnsV2Role")
      .mockResolvedValueOnce({ kind: "unconfigured" })
      .mockResolvedValueOnce({
        kind: "http-error",
        status: 429,
        code: "RATE_LIMITED",
        message: "Too many requests.",
      })
      .mockResolvedValueOnce({
        kind: "network-error",
        message: "The API could not be reached.",
      });
    const { container, root } = renderPanel();
    mounted.push({ container, root });

    await setField(container, "ensv2-account", authorizedAccount);
    await submit(container);
    expect(container.textContent).toContain("not configured");

    await submit(container);
    expect(container.textContent).toContain("Rate limited:");

    await submit(container);
    expect(container.textContent).toContain("Network error:");
    expect(check).toHaveBeenCalledTimes(3);
  });
});
