import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listAllBooksByGenre } from "@/lib/notion";

// GET /api/books?genre=回忆录 — 返回某分类下所有书的列表
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const genre = req.nextUrl.searchParams.get("genre");
  if (!genre) {
    return NextResponse.json({ error: "缺少 genre 参数" }, { status: 400 });
  }

  try {
    const books = await listAllBooksByGenre(genre);
    return NextResponse.json(books);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
