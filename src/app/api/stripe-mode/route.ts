import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  const { mode } = await req.json();
  if (mode !== "live" && mode !== "test") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const root = path.resolve(process.cwd());
  const script = mode === "live" ? "switch-to-live.sh" : "switch-to-test.sh";

  try {
    const { stdout, stderr } = await execAsync(`bash ${script}`, {
      cwd: root,
      timeout: 120_000, // 2 min — deploy can be slow
    });
    return NextResponse.json({ ok: true, log: stdout + stderr });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, log: e.stdout + e.stderr },
      { status: 500 }
    );
  }
}
