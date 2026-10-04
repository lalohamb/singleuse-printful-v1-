import { PrintfulApiError } from "./errors";
import type { PrintfulApiResponse } from "./types";

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

async function parseError(res: Response): Promise<PrintfulApiError> {
  let code = "api_error";
  let message = `Printful API error ${res.status}`;
  try {
    const body = await res.json();
    if (body?.error?.message) message = body.error.message;
    if (body?.error?.reason) code = body.error.reason;
  } catch {
    // ignore parse failure
  }
  return new PrintfulApiError(res.status, code, message);
}

export async function printfulGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: buildHeaders(token),
    next: { revalidate: 0 },
  });

  if (!res.ok) throw await parseError(res);

  const json: PrintfulApiResponse<T> = await res.json();
  return json.result;
}

// V2 envelope: { data: T, paging?: {...}, extra?: unknown, _links?: unknown }
// Distinct from V1 which uses { code, result }.
// printfulGet() must NOT be used for V2 endpoints.
export interface PrintfulV2Envelope<T> {
  data: T;
  paging?: { total: number; limit: number; offset: number };
  extra?: unknown;
  _links?: unknown;
}

export async function printfulGetV2<T>(path: string): Promise<PrintfulV2Envelope<T>> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: buildHeaders(token),
    next: { revalidate: 0 },
  });

  if (!res.ok) throw await parseError(res);

  const json = await res.json() as PrintfulV2Envelope<T>;
  return json;
}

export async function printfulPost<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) throw await parseError(res);

  const json: PrintfulApiResponse<T> = await res.json();
  return json.result;
}

/** Extract Retry-After seconds from a 429 response header (default 60s) */
export function getRetryAfter(headers: Headers): number {
  const val = headers.get("Retry-After");
  if (!val) return 60;
  const n = parseInt(val, 10);
  return isNaN(n) ? 60 : n;
}
