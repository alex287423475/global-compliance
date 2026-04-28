import { NextResponse } from "next/server";
import { scanDrafts } from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ drafts: scanDrafts() });
}
