import { NOTION_FIELDS } from "@/lib/notion-fields";
import {
  notion,
  DATABASE_ID,
  notionHeaders,
  notionReadHeaders,
  notionUrl,
} from "./client";
import { attachCoverToPage } from "./books";

// 找到或创建 "手动语录" 页面，返回 pageId
async function findOrCreateManualPage(): Promise<string> {
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: notionHeaders,
    body: JSON.stringify({
      filter: { property: NOTION_FIELDS.title, title: { equals: "手动语录" } },
      page_size: 1,
    }),
  });
  const data = (await res.json()) as { results: { id: string }[] };

  if (data.results?.length > 0) return data.results[0].id;

  const newPage = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: { [NOTION_FIELDS.title]: { title: [{ text: { content: "手动语录" } }] } } as any,
  });
  return newPage.id;
}

// 读取页面正文中所有 paragraph / callout block 的文本
export async function fetchManualPageQuotes(pageId: string): Promise<string[]> {
  const quotes: string[] = [];
  let cursor: string | undefined;

  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const res = await fetch(url, { headers: notionReadHeaders });
    const data = (await res.json()) as {
      results: {
        type:      string;
        paragraph?: { rich_text: { plain_text: string }[] };
        callout?:   { rich_text: { plain_text: string }[] };
      }[];
      has_more:    boolean;
      next_cursor: string | null;
    };

    for (const block of data.results) {
      const richText =
        block.type === "callout"   ? block.callout?.rich_text :
        block.type === "paragraph" ? block.paragraph?.rich_text : undefined;
      if (richText?.length) {
        const text = richText.map((r) => r.plain_text).join("").trim();
        if (text) quotes.push(text);
      }
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return quotes;
}

// 读取所有 quote block 的 id + type，供 updateManualQuote 定位用
async function fetchManualPageBlockInfo(
  pageId: string,
): Promise<{ id: string; type: "callout" | "paragraph" }[]> {
  const blocks: { id: string; type: "callout" | "paragraph" }[] = [];
  let cursor: string | undefined;

  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const res = await fetch(url, { headers: notionReadHeaders });
    const data = (await res.json()) as {
      results: {
        id:        string;
        type:      string;
        paragraph?: { rich_text: { plain_text: string }[] };
        callout?:   { rich_text: { plain_text: string }[] };
      }[];
      has_more:    boolean;
      next_cursor: string | null;
    };

    for (const block of data.results) {
      if (block.type !== "callout" && block.type !== "paragraph") continue;
      const richText = block.type === "callout" ? block.callout?.rich_text : block.paragraph?.rich_text;
      if (richText?.some((r) => r.plain_text.trim())) {
        blocks.push({ id: block.id, type: block.type });
      }
    }
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return blocks;
}

export async function updateManualQuote(
  pageId: string,
  quoteIdx: number,
  newText: string,
): Promise<void> {
  const blocks = await fetchManualPageBlockInfo(pageId);
  const block  = blocks[quoteIdx];
  if (!block) throw new Error(`找不到第 ${quoteIdx} 条语录 block`);

  const body = block.type === "callout"
    ? { callout:   { rich_text: [{ type: "text", text: { content: newText.trim() } }], icon: { type: "emoji", emoji: "✨" }, color: "blue_background" } }
    : { paragraph: { rich_text: [{ type: "text", text: { content: newText.trim() } }] } };

  const res = await fetch(`https://api.notion.com/v1/blocks/${block.id}`, {
    method: "PATCH",
    headers: notionHeaders,
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`更新语录失败：${await res.text()}`);
}

export async function appendManualQuote(
  text: string,
  opts: { musicUrl?: string; videoUrl?: string } = {},
): Promise<{ pageId: string; pageUrl: string; allQuotes: string[] }> {
  const { musicUrl, videoUrl } = opts;
  const pageId = await findOrCreateManualPage();

  await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
    method: "PATCH",
    headers: notionHeaders,
    body: JSON.stringify({
      children: [{
        object: "block",
        type:   "callout",
        callout: {
          rich_text: [{ type: "text", text: { content: text.trim() } }],
          icon:  { type: "emoji", emoji: "✨" },
          color: "blue_background",
        },
      }],
    }),
  });

  if (musicUrl || videoUrl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props: Record<string, any> = {};
    if (musicUrl) props[NOTION_FIELDS.music] = { url: musicUrl };
    if (videoUrl) props[NOTION_FIELDS.video] = { url: videoUrl };
    await notion.pages.update({ page_id: pageId, properties: props });
  }

  const allQuotes = await fetchManualPageQuotes(pageId);
  return { pageId, pageUrl: notionUrl(pageId), allQuotes };
}

export async function createManualQuote(
  text: string,
  opts: {
    bookTitle?:        string;
    author?:           string;
    coverBuffer?:      Buffer;
    coverExternalUrl?: string;
    musicUrl?:         string;
    videoUrl?:         string;
  } = {},
): Promise<{ pageId: string; pageUrl: string }> {
  const { bookTitle, author, musicUrl, videoUrl } = opts;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [NOTION_FIELDS.title]:       { title:        [{ text: { content: bookTitle?.trim() || "📝 手动语录" } }] },
    [NOTION_FIELDS.author]:      { rich_text:    [{ text: { content: author?.trim() || "" } }] },
    [NOTION_FIELDS.genres]:      { multi_select: [] },
    [NOTION_FIELDS.description]: { rich_text:    [{ text: { content: "" } }] },
    [NOTION_FIELDS.quotes]:      { rich_text:    [{ text: { content: text.trim() } }] },
  };

  if (musicUrl) properties[NOTION_FIELDS.music] = { url: musicUrl };
  if (videoUrl) properties[NOTION_FIELDS.video] = { url: videoUrl };

  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties,
  });

  await attachCoverToPage(page.id, opts);

  return { pageId: page.id, pageUrl: notionUrl(page.id) };
}
