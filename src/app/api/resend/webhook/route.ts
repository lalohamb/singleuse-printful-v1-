import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const type: string = payload.type;
    const data = payload.data;
    if (!type || !data) return NextResponse.json({ received: true });

    await supabase.from("email_events").insert({
      resend_id: data.email_id || data.id || "",
      to_email: Array.isArray(data.to) ? data.to[0] : (data.to || ""),
      subject: data.subject || "",
      event_type: type.replace("email.", ""),
    });

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
