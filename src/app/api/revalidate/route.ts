import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const paths: string[] = body.paths ?? ["/"];
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ revalidated: true, paths });
}
