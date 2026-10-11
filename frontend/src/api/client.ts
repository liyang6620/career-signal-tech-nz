export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001";

export type ServiceState = "ready" | "waking" | "unavailable";

const retryableStatus = new Set([502, 503, 504]);

export async function fetchWithRecovery(
  input: RequestInfo | URL,
  init?: RequestInit,
  onState?: (state: ServiceState) => void,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), 45_000);
    const waking = globalThis.setTimeout(() => onState?.("waking"), 1_200);
    try {
      const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;
      const response = await fetch(input, { ...init, signal });
      if (!retryableStatus.has(response.status) || attempt === 1) {
        onState?.(response.ok || response.status < 500 ? "ready" : "unavailable");
        return response;
      }
      lastError = new Error(`Service returned ${response.status}`);
    } catch (error) {
      if (init?.signal?.aborted) throw error;
      lastError = error;
      if (attempt === 1) {
        onState?.("unavailable");
        throw error;
      }
    } finally {
      globalThis.clearTimeout(timeout);
      globalThis.clearTimeout(waking);
    }
    onState?.("waking");
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1_500));
  }
  onState?.("unavailable");
  throw lastError instanceof Error ? lastError : new Error("Service unavailable");
}

export function apiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || !("detail" in payload)) return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item))
      .join("; ");
  }
  return fallback;
}

export async function apiPayload(response: Response): Promise<unknown> {
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return { detail: response.ok ? undefined : body };
  }
}
