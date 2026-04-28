import { NextRequest, NextResponse } from "next/server";
import { readSeedList, writeSeedList } from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ seeds: readSeedList() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { seeds?: string[]; seedText?: string };
  const seeds = Array.isArray(body.seeds)
    ? body.seeds.map((item) => String(item).trim()).filter(Boolean)
    : String(body.seedText || "")
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter(Boolean);

  writeSeedList(seeds);
  return NextResponse.json({ ok: true, seeds });
}
