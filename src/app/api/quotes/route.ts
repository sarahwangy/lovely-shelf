import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { NOTION_FIELDS } from "@/lib/notion-fields";
import { createManualQuote } from "@/lib/notion";
import { preprocessImage } from "@/lib/image";

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;
const NOTION_TOKEN = process.env.NOTION_TOKEN!;

export type QuoteBook = {
  pageId:    string;
  notionUrl: string;
  bookTitle: string;
  author:    string;
  coverUrl:  string | null;
  quotes:    string[];
  musicUrl:  string | null;
  videoUrl:  string | null;
};

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const books: QuoteBook[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filter: { property: NOTION_FIELDS.quotes, rich_text: { is_not_empty: true } },
      sorts:  [{ timestamp: "created_time", direction: "descending" }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) { console.error("[api/quotes]", await res.text()); break; }

    const data = (await res.json()) as {
      results: {
        id: string;
        properties: Record<string, {
          title?:     { plain_text: string }[];
          rich_text?: { plain_text: string }[];
          files?:     { file?: { url: string }; external?: { url: string } }[];
          url?:       string | null; // Notion URL 属性类型
        }>;
      }[];
      has_more:    boolean;
      next_cursor: string | null;
    };

    for (const page of data.results) {
      const props   = page.properties;
      const rawText = props[NOTION_FIELDS.quotes]?.rich_text?.[0]?.plain_text ?? "";
      const quotes  = rawText ? rawText.split("\n").filter(Boolean) : [];
      if (quotes.length === 0) continue;

      const coverFile = props[NOTION_FIELDS.cover]?.files?.[0];
      books.push({
        pageId:    page.id,
        notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
        bookTitle: props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "(未知书名)",
        author:    props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
        coverUrl:  coverFile?.file?.url ?? coverFile?.external?.url ?? null,
        quotes,
        musicUrl:  props[NOTION_FIELDS.music]?.url ?? null,
        videoUrl:  props[NOTION_FIELDS.video]?.url ?? null,
      });
    }

    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return NextResponse.json({ books });
}

// POST：手动添加语录，接受 FormData（支持图片文件上传）
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const fd         = await request.formData();
  const text       = fd.get("text") as string | null;
  const bookTitle  = fd.get("bookTitle") as string | null;
  const author     = fd.get("author") as string | null;
  const imageFile  = fd.get("imageFile") as File | null;
  const imageUrl   = fd.get("imageUrl") as string | null;  // Pexels/Pixabay URL
  const musicUrl   = fd.get("musicUrl") as string | null;
  const videoUrl   = fd.get("videoUrl") as string | null;

  if (!text?.trim()) return NextResponse.json({ error: "语句不能为空" }, { status: 400 });

  // 本地图片：先通过 sharp 压缩成 JPEG，再上传 Notion
  let coverBuffer: Buffer | undefined;
  if (imageFile && imageFile.size > 0) {
    const raw       = Buffer.from(await imageFile.arrayBuffer());
    const processed = await preprocessImage(raw);
    coverBuffer = processed.jpegBuffer;
  }

  const { pageId, pageUrl } = await createManualQuote(text, {
    bookTitle:        bookTitle ?? undefined,
    author:           author ?? undefined,
    coverBuffer,
    coverExternalUrl: (!coverBuffer && imageUrl) ? imageUrl : undefined,
    musicUrl:         musicUrl ?? undefined,
    videoUrl:         videoUrl ?? undefined,
  });

  const book: QuoteBook = {
    pageId,
    notionUrl: pageUrl,
    bookTitle: bookTitle?.trim() || "📝 手动语录",
    author:    author?.trim() || "",
    // 本地上传：文件已存 Notion，但临时 URL 需刷新才有；外链 URL 可直接用
    coverUrl:  coverBuffer ? null : (imageUrl ?? null),
    quotes:    [text.trim()],
    musicUrl:  musicUrl?.trim() || null,
    videoUrl:  videoUrl?.trim() || null,
  };

  return NextResponse.json({ book });
}
