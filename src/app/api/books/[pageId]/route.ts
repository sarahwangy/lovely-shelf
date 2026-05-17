import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBookByPageId, updateBookPage } from "@/lib/notion";
import { getDemoBookDetail } from "@/lib/demo-data";
import type { BookInfo } from "@/types/book";

// GET /api/books/[pageId] — 取单本书的完整详情
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { pageId } = await params;

  // Demo 模式：pageId 以 "demo-b" 开头时直接从种子数据取
  if (session.user.email === "demo@lovely-shelf.com" || pageId.startsWith("demo-b")) {
    const book = getDemoBookDetail(pageId);
    if (!book) return NextResponse.json({ error: "书籍不存在" }, { status: 404 });
    return NextResponse.json(book);
  }

  try {
    const book = await getBookByPageId(pageId);
    return NextResponse.json(book);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// PATCH /api/books/[pageId] — 局部更新书籍字段（只改传入的字段）
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { pageId } = await params;

  // Demo 模式：不写 Notion
  if (session.user.email === "demo@lovely-shelf.com" || pageId.startsWith("demo-")) {
    return NextResponse.json({ success: true });
  }

  try {
    const patch = (await req.json()) as Partial<BookInfo>;

    // 书名是必填字段，不能改成空字符串
    if (patch.title !== undefined && !patch.title.trim()) {
      return NextResponse.json({ error: "书名不能为空" }, { status: 400 });
    }

    await updateBookPage(pageId, patch);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
