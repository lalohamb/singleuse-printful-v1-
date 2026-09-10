import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST() {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/about");
  return NextResponse.json({ revalidated: true });
}
