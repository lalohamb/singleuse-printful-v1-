import { NextRequest, NextResponse } from "next/server";

const BASE = "https://connect.mailerlite.com/api";
const key = process.env.MAILER_LITE_API_KEY;

function headers() {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" };
}

export async function GET(req: NextRequest) {
  if (!key) return NextResponse.json({ error: "MAILER_LITE_API_KEY not set" }, { status: 500 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "account") {
      const res = await fetch(`${BASE}/me`, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "stats") {
      const [accountRes, groupsRes, campaignsRes, automationsRes, formsRes] = await Promise.all([
        fetch(`${BASE}/me`, { headers: headers() }),
        fetch(`${BASE}/groups?limit=25`, { headers: headers() }),
        fetch(`${BASE}/campaigns?limit=25&sort=-created_at`, { headers: headers() }),
        fetch(`${BASE}/automations?limit=10`, { headers: headers() }),
        fetch(`${BASE}/forms/popup?limit=10`, { headers: headers() }),
      ]);
      const [accountData, groupsData, campaignsData, automationsData, formsData] = await Promise.all([
        accountRes.json(), groupsRes.json(), campaignsRes.json(), automationsRes.json(), formsRes.json(),
      ]);
      return NextResponse.json({ account: accountData, groups: groupsData, campaigns: campaignsData, automations: automationsData, forms: formsData });
    }
    if (action === "subscribers") {
      const limit = searchParams.get("limit") || "25";
      const cursor = searchParams.get("cursor") || "";
      const search = searchParams.get("search") || "";
      const filter = searchParams.get("filter") || "";
      let url = `${BASE}/subscribers?limit=${limit}`;
      if (cursor) url += `&cursor=${cursor}`;
      if (search) url += `&filter[email]=${encodeURIComponent(search)}`;
      if (filter) url += `&filter[status]=${filter}`;
      const res = await fetch(url, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "subscriber") {
      const id = searchParams.get("id");
      const res = await fetch(`${BASE}/subscribers/${id}`, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "groups") {
      const res = await fetch(`${BASE}/groups?limit=25`, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "group_subscribers") {
      const id = searchParams.get("id");
      const res = await fetch(`${BASE}/groups/${id}/subscribers?limit=25`, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "campaigns") {
      const res = await fetch(`${BASE}/campaigns?limit=25&sort=-created_at`, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "campaign") {
      const id = searchParams.get("id");
      const res = await fetch(`${BASE}/campaigns/${id}`, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "automations") {
      const res = await fetch(`${BASE}/automations?limit=25`, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "forms") {
      const res = await fetch(`${BASE}/forms/popup?limit=25`, { headers: headers() });
      return NextResponse.json(await res.json(), { status: res.status });
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
        body: JSON.stringify({ email: body.email, fields: { name: body.name || "" }, groups: body.groups || [], status: "active" }),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "update_subscriber") {
      const res = await fetch(`${BASE}/subscribers/${body.id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ fields: body.fields, status: body.status, groups: body.groups }),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "delete_subscriber") {
      const res = await fetch(`${BASE}/subscribers/${body.id}`, { method: "DELETE", headers: headers() });
      return NextResponse.json({ success: res.ok }, { status: res.status });
    }
    if (action === "unsubscribe") {
      const res = await fetch(`${BASE}/subscribers/${body.id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ status: "unsubscribed" }),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "create_group") {
      const res = await fetch(`${BASE}/groups`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: body.name }),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "rename_group") {
      const res = await fetch(`${BASE}/groups/${body.id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ name: body.name }),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "delete_group") {
      const res = await fetch(`${BASE}/groups/${body.id}`, { method: "DELETE", headers: headers() });
      return NextResponse.json({ success: res.ok }, { status: res.status });
    }
    if (action === "assign_group") {
      const res = await fetch(`${BASE}/subscribers/${body.subscriber_id}/groups/${body.group_id}`, {
        method: "POST", headers: headers(),
      });
      return NextResponse.json(await res.json(), { status: res.status });
    }
    if (action === "remove_from_group") {
      const res = await fetch(`${BASE}/subscribers/${body.subscriber_id}/groups/${body.group_id}`, {
        method: "DELETE", headers: headers(),
      });
      return NextResponse.json({ success: res.ok }, { status: res.status });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
