import fs from "fs";
import path from "path";

/**
 * Resolves the application root — the directory containing .env.local.
 * Priority: APP_ROOT env var → process.cwd() → walk up from __dirname.
 * Used consistently everywhere so hasKeys and active_mode always agree.
 */
export function appRoot(): string {
  if (process.env.APP_ROOT && fs.existsSync(path.join(process.env.APP_ROOT, ".env.local")))
    return process.env.APP_ROOT;
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, ".env.local"))) return cwd;
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, ".env.local"))) return dir;
    dir = path.dirname(dir);
  }
  return cwd;
}

function assertWithinRoot(filePath: string): void {
  const root = path.resolve(appRoot());
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root)
    throw new Error(`Path traversal blocked: ${resolved} is outside app root`);
}

export function parseEnvFile(filePath: string): Record<string, string> {
  assertWithinRoot(filePath);
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8").split("\n").reduce((acc, line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {} as Record<string, string>);
}

export function writeEnvFile(filePath: string, env: Record<string, string>) {
  assertWithinRoot(filePath);
  fs.writeFileSync(filePath, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", "utf8");
}
