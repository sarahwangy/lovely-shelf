import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { NOTION_FIELDS } from "@/lib/notion-fields";
import { createManualQuote, appendManualQuote, fetchManualPageQuotes, updateManualQuote } from "@/lib/notion";
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
      // "手动语录"页面正文用 Block 存语句，不走属性字段；单独处理，这里排除
      filter: {
        and: [
          { property: NOTION_FIELDS.quotes, rich_text: { is_not_empty: true } },
          { property: NOTION_FIELDS.title,  title:     { does_not_equal: "手动语录" } },
        ],
      },
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
      // rich_text 可能被分成多段（超过 2000 字符时），合并所有段
      const rawText = (props[NOTION_FIELDS.quotes]?.rich_text ?? [])
        .map((r) => r.plain_text).join("");
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

  // 单独查"手动语录"页面，从正文 Block 读语句
  try {
    const manualRes = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { property: NOTION_FIELDS.title, title: { equals: "手动语录" } },
        page_size: 1,
      }),
    });
    if (manualRes.ok) {
      const manualData = (await manualRes.json()) as {
        results: {
          id: string;
          properties: Record<string, {
            url?: string | null;
            files?: { file?: { url: string }; external?: { url: string } }[];
          }>;
        }[];
      };
      if (manualData.results?.length > 0) {
        const page     = manualData.results[0];
        const quotes   = await fetchManualPageQuotes(page.id);
        if (quotes.length > 0) {
          const props    = page.properties;
          const coverFile = props[NOTION_FIELDS.cover]?.files?.[0];
          books.unshift({          // 手动语录排在最前面
            pageId:    page.id,
            notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
            bookTitle: "手动语录",
            author:    "",
            coverUrl:  coverFile?.file?.url ?? coverFile?.external?.url ?? null,
            quotes,
            musicUrl:  props[NOTION_FIELDS.music]?.url ?? null,
            videoUrl:  props[NOTION_FIELDS.video]?.url ?? null,
          });
        }
      }
    }
  } catch (e) {
    console.warn("[api/quotes] 手动语录 block 读取失败:", e);
  }

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

  // 无书名 → 追加到 Notion "手动语录" 固定页面
  if (!bookTitle?.trim()) {
    const { pageId, pageUrl, allQuotes } = await appendManualQuote(text.trim(), {
      musicUrl: musicUrl ?? undefined,
      videoUrl: videoUrl ?? undefined,
    });
    const book: QuoteBook = {
      pageId,
      notionUrl: pageUrl,
      bookTitle: "手动语录",
      author:    "",
      coverUrl:  null,
      quotes:    allQuotes,
      musicUrl:  musicUrl?.trim() || null,
      videoUrl:  videoUrl?.trim() || null,
    };
    return NextResponse.json({ book });
  }

  // 有书名 → 创建新书页面（原有逻辑）
  let coverBuffer: Buffer | undefined;
  if (imageFile && imageFile.size > 0) {
    const raw       = Buffer.from(await imageFile.arrayBuffer());
    const processed = await preprocessImage(raw);
    coverBuffer = processed.jpegBuffer;
  }

  const { pageId, pageUrl } = await createManualQuote(text, {
    bookTitle:        bookTitle,
    author:           author ?? undefined,
    coverBuffer,
    coverExternalUrl: (!coverBuffer && imageUrl) ? imageUrl : undefined,
    musicUrl:         musicUrl ?? undefined,
    videoUrl:         videoUrl ?? undefined,
  });

  const book: QuoteBook = {
    pageId,
    notionUrl: pageUrl,
    bookTitle: bookTitle.trim(),
    author:    author?.trim() || "",
    coverUrl:  coverBuffer ? null : (imageUrl ?? null),
    quotes:    [text.trim()],
    musicUrl:  musicUrl?.trim() || null,
    videoUrl:  videoUrl?.trim() || null,
  };

  return NextResponse.json({ book });
}

// PATCH：更新"手动语录"页面中某条语录的文字
// body: { pageId, quoteIdx, newText }
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { pageId, quoteIdx, newText } = (await request.json()) as {
    pageId:    string;
    quoteIdx:  number;
    newText:   string;
  };

  if (!pageId || typeof quoteIdx !== "number" || !newText?.trim()) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  try {
    await updateManualQuote(pageId, quoteIdx, newText);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/quotes PATCH]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
