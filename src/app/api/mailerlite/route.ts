import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const BASE = "https://connect.mailerlite.com/api";
const key = process.env.MAILER_LITE_API_KEY;

function headers() {
  return { "Authorization": `Bearer ${key}`, "Content-Type": "application/json", "Accept": "application/json" };
}

async function ml(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: headers() });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// Normalize v3 subscriber to the shape the page expects
function normSub(s: Record<string, unknown>) {
  const fields = s.fields as Record<string, { value: string }> | null;
  return {
    id: String(s.id),
    email: s.email,
    status: s.status,
    type: s.status, // page uses both .type and .status
    date_created: s.created_at,
    fields: fields ? Object.entries(fields).map(([key, f]) => ({ key, value: f.value })) : [],
  };
}

// Normalize v3 group
function normGroup(g: Record<string, unknown>) {
  return { id: String(g.id), name: g.name, total: g.total ?? 0, active: g.active_count ?? g.total ?? 0 };
}

// Normalize v3 campaign
function normCampaign(c: Record<string, unknown>) {
  const stats = c.stats as Record<string, unknown> | null;
  return {
    id: String(c.id),
    name: c.name,
    status: c.status,
    date_created: c.created_at,
    sent: stats?.delivered ?? 0,
    opened: stats?.opened ?? 0,
    clicked: stats?.clicked ?? 0,
    unsubscribed: stats?.unsubscribed ?? 0,
    open_rate: stats?.open_rate ? Number((stats.open_rate as Record<string,unknown>).float ?? stats.open_rate) : 0,
    click_rate: stats?.click_rate ? Number((stats.click_rate as Record<string,unknown>).float ?? stats.click_rate) : 0,
  };
}

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;
  if (!key) return NextResponse.json({ error: "MAILER_LITE_API_KEY not set" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "stats") {
      const [userRes, groupsRes, campaignsRes, automationsRes, formsRes] = await Promise.all([
        ml("/user"),
        ml("/groups?limit=25"),
        ml("/campaigns?limit=25"),
        ml("/automations?limit=25"),
        ml("/forms/popup?limit=25"),
      ]);
      const userData = userRes.json.data ?? {};
      return NextResponse.json({
        account: { account: { name: userData.current_account_name || userData.name || "", email: userData.email || "" } },
        groups: (groupsRes.json.data ?? []).map(normGroup),
        campaigns: (campaignsRes.json.data ?? []).map(normCampaign),
        automations: (automationsRes.json.data ?? []).map((a: Record<string, unknown>) => {
          const stats = a.stats as Record<string, unknown> | null;
          const triggers = a.triggers as Array<Record<string, unknown>> | null;
          const trigger = triggers?.[0];
          const triggerGroups = trigger?.groups as Array<Record<string, unknown>> | null;
          return {
            id: String(a.id),
            name: a.name,
            enabled: a.enabled,
            steps_count: a.emails_count ?? 0,
            trigger_type: trigger?.type ?? null,
            trigger_group: triggerGroups?.[0]?.name ?? null,
            sent: stats?.sent ?? 0,
            open_rate: stats?.open_rate ? Number((stats.open_rate as Record<string,unknown>).float ?? 0) : 0,
            completed: stats?.completed_subscribers_count ?? 0,
            in_queue: stats?.subscribers_in_queue_count ?? 0,
            screenshot_url: a.first_email_screenshot_url ?? null,
          };
        }),
        forms: (formsRes.json.data ?? []).map((f: Record<string, unknown>) => ({
          id: String(f.id), name: f.name, type: f.type ?? "popup", conversions_count: f.conversions_count ?? 0,
        })),
      });
    }

    if (action === "subscribers") {
      const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "25", 10), 1), 100);
      const search = searchParams.get("search") || "";
      const ALLOWED_FILTERS = new Set(["active", "unsubscribed", "bounced", "junk", "unconfirmed"]);
      const filter = ALLOWED_FILTERS.has(searchParams.get("filter") ?? "") ? searchParams.get("filter") : "";
      const cursor = searchParams.get("cursor") || "";
      let url = `/subscribers?limit=${limit}`;
      if (search) url += `&filter[email]=${encodeURIComponent(search)}`;
      if (filter) url += `&filter[status]=${filter}`;
      if (cursor) url += `&cursor=${cursor}`;
      const { json } = await ml(url);
      return NextResponse.json({
        data: (json.data ?? []).map(normSub),
        meta: {
          total: json.meta?.total ?? 0,
          next_cursor: json.meta?.cursor?.next ?? null,
          prev_cursor: json.meta?.cursor?.prev ?? null,
        },
      });
    }

    if (action === "groups") {
      const { json } = await ml("/groups?limit=25");
      return NextResponse.json((json.data ?? []).map(normGroup));
    }

    if (action === "campaigns") {
      const { json } = await ml("/campaigns?limit=25");
      return NextResponse.json((json.data ?? []).map(normCampaign));
    }

    if (action === "automations") {
      const { json } = await ml("/automations?limit=25");
      return NextResponse.json((json.data ?? []).map((a: Record<string, unknown>) => {
        const stats = a.stats as Record<string, unknown> | null;
        const triggers = a.triggers as Array<Record<string, unknown>> | null;
        const trigger = triggers?.[0];
        const triggerGroups = trigger?.groups as Array<Record<string, unknown>> | null;
        return {
          id: String(a.id), name: a.name, enabled: a.enabled, steps_count: a.emails_count ?? 0,
          trigger_type: trigger?.type ?? null, trigger_group: triggerGroups?.[0]?.name ?? null,
          sent: stats?.sent ?? 0, open_rate: stats?.open_rate ? Number((stats.open_rate as Record<string,unknown>).float ?? 0) : 0,
          completed: stats?.completed_subscribers_count ?? 0, in_queue: stats?.subscribers_in_queue_count ?? 0,
          screenshot_url: a.first_email_screenshot_url ?? null,
        };
      }));
    }

    if (action === "forms") {
      const { json } = await ml("/forms/popup?limit=25");
      return NextResponse.json((json.data ?? []).map((f: Record<string, unknown>) => ({
        id: String(f.id), name: f.name, type: f.type ?? "popup", conversions_count: f.conversions_count ?? 0,
      })));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!key) return NextResponse.json({ error: "MAILER_LITE_API_KEY not set" }, { status: 500 });
  const body = await req.json();
  const { action } = body;

  if (action !== "add_subscriber") {
    const authError = await requireAdmin();
    if (authError) return authError;
  }

  try {
    if (action === "add_subscriber") {
      const payload: Record<string, unknown> = { email: body.email };
      if (body.name) payload.fields = { name: body.name };
      if (body.groups?.length) payload.groups = body.groups.map((id: string) => ({ id }));
      const { json, status } = await ml("/subscribers", { method: "POST", body: JSON.stringify(payload) });
      return NextResponse.json(json, { status });
    }

    if (action === "update_subscriber") {
      if (!body.id || !/^[\w-]{1,64}$/.test(String(body.id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      const name = body.fields?.find((f: { key: string }) => f.key === "name")?.value;
      const payload: Record<string, unknown> = { status: body.status };
      if (name !== undefined) payload.fields = { name };
      const { json, status } = await ml(`/subscribers/${body.id}`, { method: "PUT", body: JSON.stringify(payload) });
      return NextResponse.json(json, { status });
    }

    if (action === "delete_subscriber") {
      if (!body.id || !/^[\w-]{1,64}$/.test(String(body.id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      const { ok, status } = await ml(`/subscribers/${body.id}`, { method: "DELETE" });
      return NextResponse.json({ success: ok || status === 204 });
    }

    if (action === "unsubscribe") {
      if (!body.id || !/^[\w-]{1,64}$/.test(String(body.id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      const { json, status } = await ml(`/subscribers/${body.id}`, {
        method: "PUT", body: JSON.stringify({ status: "unsubscribed" }),
      });
      return NextResponse.json(json, { status });
    }

    if (action === "create_group") {
      const { json, status } = await ml("/groups", { method: "POST", body: JSON.stringify({ name: body.name }) });
      return NextResponse.json(json, { status });
    }

    if (action === "rename_group") {
      if (!body.id || !/^[\w-]{1,64}$/.test(String(body.id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      const { json, status } = await ml(`/groups/${body.id}`, { method: "PUT", body: JSON.stringify({ name: body.name }) });
      return NextResponse.json(json, { status });
    }

    if (action === "delete_group") {
      if (!body.id || !/^[\w-]{1,64}$/.test(String(body.id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      const { ok, status } = await ml(`/groups/${body.id}`, { method: "DELETE" });
      return NextResponse.json({ success: ok || status === 204 });
    }

    if (action === "create_campaign") {
      let groupIds: string[] = body.groups || [];
      if (groupIds.length === 0) {
        const { json } = await ml("/groups?limit=100");
        groupIds = (json.data ?? []).map((g: Record<string, unknown>) => String(g.id));
      }
      if (groupIds.length === 0) {
        return NextResponse.json({ error: "No groups found. Create at least one group first." }, { status: 422 });
      }
      // Step 1: create campaign
      const createPayload = {
        name: body.name,
        type: "regular",
        emails: [{
          subject: body.subject,
          from_name: body.from_name,
          from: body.from_email,
          content: body.html,
        }],
        groups: groupIds,
      };
      const { json: campaign, ok: createOk, status: createStatus } = await ml("/campaigns", {
        method: "POST", body: JSON.stringify(createPayload),
      });
      if (!createOk) return NextResponse.json(campaign, { status: createStatus });
      const campaignId = campaign.data?.id;
      if (!campaignId) return NextResponse.json({ error: "Campaign created but no ID returned" }, { status: 500 });

      // Step 2: schedule or save as draft
      if (body.send_now) {
        const { json: sendJson, status: sendStatus } = await ml(`/campaigns/${campaignId}/schedule`, {
          method: "POST", body: JSON.stringify({ delivery: "instant" }),
        });
        return NextResponse.json(sendJson, { status: sendStatus });
      }
      return NextResponse.json(campaign, { status: 201 });
    }

    if (action === "delete_campaign") {
      if (!body.id || !/^[\w-]{1,64}$/.test(String(body.id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      const { ok, status } = await ml(`/campaigns/${body.id}`, { method: "DELETE" });
      return NextResponse.json({ success: ok || status === 204 });
    }

    if (action === "assign_group") {
      if (!body.group_id || !/^[\w-]{1,64}$/.test(String(body.group_id))) return NextResponse.json({ error: "Invalid group_id" }, { status: 400 });
      const { json, status } = await ml(`/subscribers/${encodeURIComponent(body.email)}/groups/${body.group_id}`, { method: "POST", body: JSON.stringify({}) });
      return NextResponse.json(json, { status });
    }

    if (action === "remove_from_group") {
      if (!body.group_id || !/^[\w-]{1,64}$/.test(String(body.group_id))) return NextResponse.json({ error: "Invalid group_id" }, { status: 400 });
      if (!body.subscriber_id || !/^[\w-]{1,64}$/.test(String(body.subscriber_id))) return NextResponse.json({ error: "Invalid subscriber_id" }, { status: 400 });
      const { ok, status } = await ml(`/subscribers/${body.subscriber_id}/groups/${body.group_id}`, { method: "DELETE" });
      return NextResponse.json({ success: ok || status === 204 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
