import { NextRequest, NextResponse } from "next/server";
import { normalizeKeywordRow, readKeywordRows, scanDrafts, writeKeywordRows } from "../../../../lib/local-brain-core";

export const runtime = "nodejs";

function withArticleStatus() {
  const drafts = scanDrafts();
  const draftMap = new Map(drafts.map((draft) => [draft.slug, draft]));
  return readKeywordRows().map((row) => {
    const draft = draftMap.get(row.slug);
    if (draft?.published) {
      return {
        ...row,
        articleStatus: "published",
        articleStatusLabel: "已发布",
        articleUrl: draft.expectedUrl,
        generated: true,
      };
    }
    if (draft) {
      return {
        ...row,
        articleStatus: "draft",
        articleStatusLabel: "已有草稿",
        articleUrl: null,
        generated: true,
      };
    }
    return {
      ...row,
      articleStatus: "not-generated",
      articleStatusLabel: "未生成",
      articleUrl: null,
      generated: false,
    };
  });
}

export async function GET() {
  return NextResponse.json({ rows: withArticleStatus() });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { rows?: unknown[] } & Record<string, unknown>;
    const incoming = Array.isArray(body.rows) ? body.rows : [body];
    const additions = incoming.map((item) => normalizeKeywordRow(item as Record<string, unknown>));
    const existing = readKeywordRows();
    const existingMap = new Map(existing.map((row) => [row.slug, row]));
    for (const row of additions) {
      existingMap.set(row.slug, row);
    }
    writeKeywordRows(Array.from(existingMap.values()));
    return NextResponse.json({ ok: true, rows: withArticleStatus() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "保存关键词失败" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const originalSlug = String(body.originalSlug || body.slug || "").trim();
    if (!originalSlug) {
      return NextResponse.json({ message: "originalSlug 不能为空" }, { status: 400 });
    }

    const rows = readKeywordRows();
    const index = rows.findIndex((row) => row.slug === originalSlug);
    if (index < 0) {
      return NextResponse.json({ message: `没有找到 slug：${originalSlug}` }, { status: 404 });
    }

    const nextRow = normalizeKeywordRow({
      ...rows[index],
      ...body,
    });
    if (nextRow.slug !== originalSlug && rows.some((row) => row.slug === nextRow.slug)) {
      return NextResponse.json({ message: `slug 已存在：${nextRow.slug}` }, { status: 409 });
    }

    const nextRows = rows.map((row, rowIndex) => (rowIndex === index ? nextRow : row));
    writeKeywordRows(nextRows);
    return NextResponse.json({ ok: true, rows: withArticleStatus() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "更新关键词失败" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  const slug = String(body.slug || "").trim();
  if (!slug) {
    return NextResponse.json({ message: "slug 不能为空" }, { status: 400 });
  }

  const rows = readKeywordRows();
  const nextRows = rows.filter((row) => row.slug !== slug);
  if (nextRows.length === rows.length) {
    return NextResponse.json({ message: `没有找到 slug：${slug}` }, { status: 404 });
  }

  writeKeywordRows(nextRows);
  return NextResponse.json({ ok: true, rows: withArticleStatus() });
}
