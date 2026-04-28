import path from "node:path";
import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { currentStatus, ensureDir, nowIso, requestsDir, runtimeDir, writeJsonFile } from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

const supportedActions = new Set(["generate", "images", "visuals", "review", "rewrite", "validate", "approve", "publish"]);

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Local Brain 工作台只允许在本地运行。" }, { status: 403 });
  }

  const status = currentStatus();
  if (status.isRunning) {
    return NextResponse.json({ message: `已有任务正在运行：${status.currentStep || "unknown"}` }, { status: 409 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "").trim();
  if (!supportedActions.has(action)) {
    return NextResponse.json({ message: "不支持的流程动作。" }, { status: 400 });
  }

  ensureDir(requestsDir);
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const requestPath = path.join(requestsDir, `${requestId}.json`);
  writeJsonFile(requestPath, body);

  const scriptPath = path.join(process.cwd(), "scripts", "local-brain", "orchestrate.mjs");
  const child = spawn(process.execPath, [scriptPath, requestPath], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  writeJsonFile(path.join(runtimeDir, "status.json"), {
    updatedAt: nowIso(),
    isRunning: true,
    currentStep: action,
    lock: { pid: child.pid || null, step: action, startedAt: nowIso() },
    log: [{ time: nowIso(), step: action, message: `任务已入队：${action}` }],
    counts: status.counts,
  });

  return NextResponse.json({ ok: true, requestId, pid: child.pid || null });
}
