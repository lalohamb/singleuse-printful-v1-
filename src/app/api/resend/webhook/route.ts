import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    const rawBody = await req.text();

    if (secret) {
      const sig = req.headers.get("svix-signature") ?? "";
      const ts = req.headers.get("svix-timestamp") ?? "";
      const msgId = req.headers.get("svix-id") ?? "";
      const toSign = `${msgId}.${ts}.${rawBody}`;
      const expected = createHmac("sha256", secret).update(toSign).digest("base64");
      const signatures = sig.split(" ").map((s) => s.replace(/^v1,/, ""));
      const valid = signatures.some((s) => {
        try { return timingSafeEqual(Buffer.from(s, "base64"), Buffer.from(expected, "base64")); } catch { return false; }
      });
      if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const payload = JSON.parse(rawBody);
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
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
