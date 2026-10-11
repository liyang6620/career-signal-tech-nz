import { afterEach, describe, expect, it, vi } from "vitest";
import { apiError, apiPayload, fetchWithRecovery, type ServiceState } from "./client";

afterEach(() => vi.restoreAllMocks());

describe("API client", () => {
  it("normalises FastAPI validation errors", () => {
    expect(apiError({ detail: [{ msg: "Email is invalid" }, { msg: "Password is too short" }] }, "Fallback"))
      .toBe("Email is invalid; Password is too short");
    expect(apiError({ detail: "Email already exists" }, "Fallback")).toBe("Email already exists");
    expect(apiError(null, "Fallback")).toBe("Fallback");
  });

  it("preserves a plain-text server error", async () => {
    const payload = await apiPayload(new Response("Service temporarily unavailable", { status: 503 }));
    expect(payload).toEqual({ detail: "Service temporarily unavailable" });
  });

  it("retries a transient gateway response and reports recovery", async () => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") callback();
      return 1;
    }) as typeof setTimeout);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined);
    const request = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const states: ServiceState[] = [];

    const response = await fetchWithRecovery("https://example.test/health", undefined, (state) => states.push(state));

    expect(response.ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(states).toContain("waking");
    expect(states.at(-1)).toBe("ready");
  });

  it("surfaces an unavailable state after repeated network failures", async () => {
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") callback();
      return 1;
    }) as typeof setTimeout);
    vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network unavailable"));
    const states: ServiceState[] = [];

    await expect(fetchWithRecovery("https://example.test/health", undefined, (state) => states.push(state)))
      .rejects.toThrow("Network unavailable");
    expect(states.at(-1)).toBe("unavailable");
  });
});
