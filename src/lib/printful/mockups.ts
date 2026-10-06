import { printfulGet, printfulPost } from "./client";
import { PrintfulApiError } from "./errors";
import type {
  PrintfulMockupTask,
  PrintfulMockupTaskRequest,
  V2MockupTask,
} from "./types";

// ── V2 mockup task types ──────────────────────────────────────────────────────

export interface V2MockupTaskLayer {
  type: "file";
  url: string;
}

export interface V2MockupTaskPlacement {
  placement: string;
  technique: string;
  layers: V2MockupTaskLayer[];
  style_id?: number;
}

export interface V2MockupTaskProduct {
  source: "catalog";
  catalog_product_id: number;
  catalog_variant_ids: number[];        // MUST be explicitly supplied — do not omit
  placements: V2MockupTaskPlacement[];
}

export interface V2MockupTaskRequest {
  products: V2MockupTaskProduct[];
}

// ── V2 helpers ────────────────────────────────────────────────────────────────
// V2 mockup-tasks uses { data: [...] } envelope, not V1 { code, result }.
// printfulPost() unwraps V1 envelopes and cannot be used here.
// printfulGetV2() handles GET but not POST.
// These helpers replicate the minimal fetch logic for V2 POST/GET.

const BASE_URL = "https://api.printful.com";

function getToken(): string {
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) throw new PrintfulApiError(500, "missing_token", "PRINTFUL_API_TOKEN is not set");
  return token;
}

function buildHeaders(token: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const storeId = process.env.PRINTFUL_STORE_ID;
  if (storeId) headers["X-PF-Store-Id"] = storeId;
  return headers;
}

async function parseV2Error(res: Response): Promise<PrintfulApiError> {
  let code = "api_error";
  let message = `Printful API error ${res.status}`;
  try {
    const body = await res.json();
    if (body?.error?.message) message = body.error.message;
    if (body?.error?.reason) code = body.error.reason;
  } catch { /* ignore */ }
  return new PrintfulApiError(res.status, code, message);
}

// ── V2 mockup task creation ───────────────────────────────────────────────────
// POST /v2/mockup-tasks
// Live-proven: accepts catalog_product_id + catalog_variant_ids (V2 namespace).
// catalog_variant_ids MUST be explicitly supplied — do not rely on auto-selection.
// Returns V2MockupTask with numeric id (not a string task_key).
export async function createMockupTaskV2(request: V2MockupTaskRequest): Promise<V2MockupTask> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/v2/mockup-tasks`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(request),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw await parseV2Error(res);
  const json = await res.json() as { data: V2MockupTask[] };
  const task = json.data?.[0];
  if (!task) throw new PrintfulApiError(500, "empty_response", "V2 mockup-tasks returned empty data array");
  return task;
}

// ── V2 mockup task polling ────────────────────────────────────────────────────
// GET /v2/mockup-tasks?id={numeric_task_id}
// Live-proven: returns { data: [task], paging, extra, _links }
// Task id is a number, not a string task_key.
// Terminal states: "completed", "failed".
// failure_reasons[] contains error details when status === "failed".
export async function getMockupTaskV2(taskId: number): Promise<V2MockupTask> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/v2/mockup-tasks?id=${taskId}`, {
    headers: buildHeaders(token),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw await parseV2Error(res);
  const json = await res.json() as { data: V2MockupTask[] };
  const task = json.data?.[0];
  if (!task) throw new PrintfulApiError(404, "not_found", `V2 mockup task ${taskId} not found`);
  return task;
}

// ── LEGACY V1 ONLY ────────────────────────────────────────────────────────────
// Retained for ProductDesigner and printful_sync callers.
// Do NOT use for new Catalog Builder development.

export async function createMockupTask(
  productId: number,
  request: PrintfulMockupTaskRequest
): Promise<PrintfulMockupTask> {
  return printfulPost<PrintfulMockupTask>(
    `/mockup-generator/create-task/${productId}`,
    request
  );
}

export async function getMockupTask(taskKey: string): Promise<PrintfulMockupTask> {
  return printfulGet<PrintfulMockupTask>(
    `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`
  );
}
