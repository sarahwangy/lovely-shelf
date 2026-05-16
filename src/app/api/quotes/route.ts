import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { NOTION_FIELDS } from "@/lib/notion-fields";

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;
const NOTION_TOKEN = process.env.NOTION_TOKEN!;

// 单本书的语录数据结构
export type QuoteBook = {
  pageId:    string;
  notionUrl: string;
  bookTitle: string;
  author:    string;
  coverUrl:  string | null;
  quotes:    string[];
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const books: QuoteBook[] = [];
  let cursor: string | undefined;

  // 分页查询所有"优美语句"不为空的书
  do {
    const body: Record<string, unknown> = {
      filter: {
        property: NOTION_FIELDS.quotes,
        // Notion rich_text 的 is_not_empty 过滤：只返回有内容的记录
        rich_text: { is_not_empty: true },
      },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
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

    if (!res.ok) {
      console.error("[api/quotes]", await res.text());
      break;
    }

    const data = (await res.json()) as {
      results: {
        id: string;
        properties: Record<string, {
          title?:     { plain_text: string }[];
          rich_text?: { plain_text: string }[];
          files?:     { file?: { url: string }; external?: { url: string } }[];
        }>;
      }[];
      has_more:    boolean;
      next_cursor: string | null;
    };

    for (const page of data.results) {
      const props    = page.properties;
      const rawText  = props[NOTION_FIELDS.quotes]?.rich_text?.[0]?.plain_text ?? "";
      const quotes   = rawText ? rawText.split("\n").filter(Boolean) : [];
      if (quotes.length === 0) continue;

      const coverFile = props[NOTION_FIELDS.cover]?.files?.[0];
      books.push({
        pageId:    page.id,
        notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
        bookTitle: props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "(未知书名)",
        author:    props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
        coverUrl:  coverFile?.file?.url ?? coverFile?.external?.url ?? null,
        quotes,
      });
    }

    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return NextResponse.json({ books });
}
