import { NextResponse } from "next/server";
import {
  currentStatus,
  dashboardMetrics,
  insightsIndexUrl,
  projectInfo,
  readSeedList,
  scanAudits,
  scanMaterialPackages,
} from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

export async function GET() {
  const status = currentStatus();
  return NextResponse.json({
    ...status,
    siteUrl: insightsIndexUrl(),
    project: projectInfo(),
    packages: scanMaterialPackages().slice(0, 12),
    audits: scanAudits().slice(0, 24),
    seeds: readSeedList(),
    metrics: dashboardMetrics(),
  });
}
