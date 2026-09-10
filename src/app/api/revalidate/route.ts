import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const paths: string[] = body.paths ?? ["/"];
  for (const p of paths) revalidatePath(p);
  return NextResponse.json({ revalidated: true, paths });
}
