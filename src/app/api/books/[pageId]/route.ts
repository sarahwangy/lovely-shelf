import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBookByPageId, updateBookPage } from "@/lib/notion";
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

  // Next.js 16 breaking change：params 现在是 Promise，必须 await
  const { pageId } = await params;

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
