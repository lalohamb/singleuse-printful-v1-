import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.paths) ? body.paths : ["/"];
  const paths = raw
    .filter((p): p is string => typeof p === "string" && p.startsWith("/") && p.length <= 256)
    .slice(0, 20);
  if (paths.length === 0) return NextResponse.json({ error: "No valid paths" }, { status: 400 });
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ revalidated: true, paths });
}
