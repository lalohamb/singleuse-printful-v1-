import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BASE = "https://api.mailerlite.com/api/v2";
const key = process.env.MAILER_LITE_API_KEY;

function headers() {
  return { "X-MailerLite-ApiKey": key!, "Content-Type": "application/json", Accept: "application/json" };
}

// Classic API returns 64-bit integer IDs that lose precision in JS.
// Parse raw text and stringify all numeric IDs before JSON.parse.
async function safeJson(res: Response) {
  const text = await res.text();
  const safe = text.replace(/"id":\s*(\d{15,})/g, '"id":"$1"');
  try { return JSON.parse(safe); } catch { return JSON.parse(text); }
}

export async function GET(req: NextRequest) {
  if (!key) return NextResponse.json({ error: "MAILER_LITE_API_KEY not set" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "account") {
      const res = await fetch(`${BASE}/me`, { headers: headers() });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "stats") {
      const [accountRes, groupsRes, campaignsRes] = await Promise.all([
        fetch(`${BASE}/me`, { headers: headers() }),
        fetch(`${BASE}/groups?limit=25`, { headers: headers() }),
        fetch(`${BASE}/campaigns?limit=25`, { headers: headers() }),
      ]);
      const [accountData, groupsData, campaignsData] = await Promise.all([
        safeJson(accountRes), safeJson(groupsRes), safeJson(campaignsRes),
      ]);
      return NextResponse.json({ account: accountData, groups: groupsData, campaigns: campaignsData, automations: [], forms: [] });
    }
    if (action === "subscribers") {
      const limit = searchParams.get("limit") || "25";
      const search = searchParams.get("search") || "";
      const filter = searchParams.get("filter") || "";
      let url = `${BASE}/subscribers?limit=${limit}`;
      if (search) url += `&query=${encodeURIComponent(search)}`;
      if (filter) url += `&type=${filter}`;
      const res = await fetch(url, { headers: headers() });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "subscriber") {
      const id = searchParams.get("id");
      const res = await fetch(`${BASE}/subscribers/${id}`, { headers: headers() });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "groups") {
      const res = await fetch(`${BASE}/groups?limit=25`, { headers: headers() });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "group_subscribers") {
      const id = searchParams.get("id");
      const res = await fetch(`${BASE}/groups/${id}/subscribers?limit=25`, { headers: headers() });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "campaigns") {
      const res = await fetch(`${BASE}/campaigns?limit=25`, { headers: headers() });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "campaign") {
      const id = searchParams.get("id");
      const res = await fetch(`${BASE}/campaigns/${id}`, { headers: headers() });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "automations") {
      // Classic API does not have automations — return empty
      return NextResponse.json([]);
    }
    if (action === "forms") {
      // Classic API does not have forms — return empty
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!key) return NextResponse.json({ error: "MAILER_LITE_API_KEY not set" }, { status: 500 });
  const body = await req.json();
  const { action } = body;

  try {
    if (action === "add_subscriber") {
      const res = await fetch(`${BASE}/subscribers`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email: body.email, name: body.name || "", groups: body.groups || [] }),
      });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "update_subscriber") {
      const res = await fetch(`${BASE}/subscribers/${body.id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ name: body.fields?.name, type: body.status }),
      });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "delete_subscriber") {
      const res = await fetch(`${BASE}/subscribers/${body.id}`, { method: "DELETE", headers: headers() });
      return NextResponse.json({ success: res.ok || res.status === 204 });
    }
    if (action === "unsubscribe") {
      const res = await fetch(`${BASE}/subscribers/${body.id}/unsubscribe`, {
        method: "POST", headers: headers(),
      });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "create_group") {
      const res = await fetch(`${BASE}/groups`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: body.name }),
      });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "rename_group") {
      const res = await fetch(`${BASE}/groups/${body.id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ name: body.name }),
      });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "delete_group") {
      const res = await fetch(`${BASE}/groups/${body.id}`, { method: "DELETE", headers: headers() });
      return NextResponse.json({ success: res.ok || res.status === 204 });
    }
    if (action === "create_campaign") {
      // MailerLite Classic API requires at least one group.
      // If none selected, fetch all groups and use all their IDs.
      let groupIds: string[] = (body.groups || []);
      if (groupIds.length === 0) {
        const allGroupsRes = await fetch(`${BASE}/groups?limit=100`, { headers: headers() });
        const allGroups = await safeJson(allGroupsRes);
        groupIds = Array.isArray(allGroups) ? allGroups.map((g: any) => String(g.id)) : [];
      }
      if (groupIds.length === 0) {
        return NextResponse.json({ error: "No groups found in your MailerLite account. Create at least one group first." }, { status: 422 });
      }
      const createPayload = {
        subject: body.subject,
        from: body.from_email,
        from_name: body.from_name,
        groups: groupIds.map((id: string) => ({ id })),
        type: "regular",
      };
      console.log("[MailerLite] create_campaign payload:", JSON.stringify(createPayload));
      const createRes = await fetch(`${BASE}/campaigns`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(createPayload),
      });
      const campaign = await safeJson(createRes);
      if (!createRes.ok) {
        console.error("[MailerLite] create_campaign failed:", createRes.status, JSON.stringify(campaign));
        return NextResponse.json(campaign, { status: createRes.status });
      }
      const campaignId = campaign.id;
      if (!campaignId) return NextResponse.json({ error: "Campaign created but no ID returned" }, { status: 500 });
      await fetch(`${BASE}/campaigns/${campaignId}/content`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ html: body.html }),
      });
      if (body.send_now) {
        const sendRes = await fetch(`${BASE}/campaigns/${campaignId}/actions/send`, {
          method: "POST", headers: headers(),
        });
        return NextResponse.json(await safeJson(sendRes), { status: sendRes.status });
      }
      return NextResponse.json(campaign, { status: 201 });
    }
    if (action === "delete_campaign") {
      const res = await fetch(`${BASE}/campaigns/${body.id}`, { method: "DELETE", headers: headers() });
      return NextResponse.json({ success: res.ok || res.status === 204 });
    }
    if (action === "assign_group") {
      // Classic API: POST /groups/{group_id}/subscribers with email body
      const res = await fetch(`${BASE}/groups/${body.group_id}/subscribers`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email: body.email }),
      });
      return NextResponse.json(await safeJson(res), { status: res.status });
    }
    if (action === "remove_from_group") {
      const res = await fetch(`${BASE}/groups/${body.group_id}/subscribers/${body.subscriber_id}`, {
        method: "DELETE", headers: headers(),
      });
      return NextResponse.json({ success: res.ok || res.status === 204 });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
