import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import type { BookInfo, BookSummary, BookDetail } from "@/types/book";
import { NOTION_FIELDS } from "@/lib/notion-fields";
import {
  notion,
  DATABASE_ID,
  notionHeaders,
  notionReadHeaders,
  notionUrl,
  parseCoverUrl,
} from "./client";
import { uploadFileToNotion } from "./upload";

type PageProperties = CreatePageParameters["properties"];

export async function createBookPage(
  info: BookInfo,
  fileUploadId: string | null,
  sourceFilename: string = "",
): Promise<{ pageId: string; pageUrl: string }> {
  const properties: PageProperties = {
    [NOTION_FIELDS.title]:       { title:        [{ text: { content: info.title } }] },
    [NOTION_FIELDS.subtitle]:    { rich_text:    [{ text: { content: info.subtitle ?? "" } }] },
    [NOTION_FIELDS.author]:      { rich_text:    [{ text: { content: info.author } }] },
    [NOTION_FIELDS.gender]:      { rich_text:    [{ text: { content: info.gender ?? "" } }] },
    [NOTION_FIELDS.country]:     { select:       info.country ? { name: info.country } : null },
    [NOTION_FIELDS.genres]:      { multi_select: info.genres.map((g) => ({ name: g })) },
    [NOTION_FIELDS.description]: { rich_text:    [{ text: { content: info.description } }] },
    [NOTION_FIELDS.quotes]:      { rich_text:    [{ text: { content: (info.quotes ?? []).join("\n") } }] },
  };

  if (fileUploadId) {
    properties[NOTION_FIELDS.cover] = {
      files: [{ name: sourceFilename || "cover.jpg", type: "file_upload", file_upload: { id: fileUploadId } }],
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties,
  });

  return { pageId: page.id, pageUrl: notionUrl(page.id) };
}

export async function countBooksByGenre(genre: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filter: { property: NOTION_FIELDS.genres, multi_select: { contains: genre } },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: notionHeaders,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("[countBooksByGenre]", await res.text());
      return count;
    }

    const data = (await res.json()) as {
      results: unknown[];
      has_more: boolean;
      next_cursor: string | null;
    };
    count += data.results.length;
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return count;
}

// 查同类书推荐：按类型找最近入库的书，排除刚入库的那本
export async function listBooksByGenre(
  genre: string,
  excludePageId: string,
  limit = 5
): Promise<BookSummary[]> {
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: notionHeaders,
    body: JSON.stringify({
      filter: { property: NOTION_FIELDS.genres, multi_select: { contains: genre } },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: limit + 1,
    }),
  });

  if (!res.ok) {
    console.error("[listBooksByGenre]", await res.text());
    return [];
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
  };

  return data.results
    .filter((page) => page.id.replace(/-/g, "") !== excludePageId.replace(/-/g, ""))
    .slice(0, limit)
    .map((page) => {
      const props = page.properties;
      const quotesRaw = props[NOTION_FIELDS.quotes]?.rich_text?.[0]?.plain_text ?? "";
      return {
        pageId:    page.id,
        title:     props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "(未知书名)",
        author:    props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
        coverUrl:  parseCoverUrl(props[NOTION_FIELDS.cover]?.files?.[0]),
        notionUrl: notionUrl(page.id),
        quotes:    quotesRaw ? quotesRaw.split("\n").filter(Boolean) : [],
      };
    });
}

export async function getBookByPageId(pageId: string): Promise<BookDetail> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: notionReadHeaders,
  });

  if (!res.ok) throw new Error(`获取书籍详情失败：${await res.text()}`);

  const page = (await res.json()) as {
    id: string;
    properties: Record<string, {
      type:         string;
      title?:       { plain_text: string }[];
      rich_text?:   { plain_text: string }[];
      select?:      { name: string } | null;
      multi_select?: { name: string }[];
      files?:       { file?: { url: string }; external?: { url: string } }[];
    }>;
  };

  const props = page.properties;
  const quotesRaw = props[NOTION_FIELDS.quotes]?.rich_text?.[0]?.plain_text ?? "";

  return {
    pageId:      page.id,
    pageUrl:     notionUrl(page.id),
    title:       props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "",
    subtitle:    props[NOTION_FIELDS.subtitle]?.rich_text?.[0]?.plain_text || null,
    author:      props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
    gender:      props[NOTION_FIELDS.gender]?.rich_text?.[0]?.plain_text || null,
    country:     (props[NOTION_FIELDS.country]?.select?.name ?? null) as BookDetail["country"],
    genres:      (props[NOTION_FIELDS.genres]?.multi_select?.map((g) => g.name) ?? []) as BookDetail["genres"],
    description: props[NOTION_FIELDS.description]?.rich_text?.[0]?.plain_text ?? "",
    coverUrl:    parseCoverUrl(props[NOTION_FIELDS.cover]?.files?.[0]),
    quotes:      quotesRaw ? quotesRaw.split("\n").filter(Boolean) : [],
  };
}

export async function updateBookPage(
  pageId: string,
  patch: Partial<BookInfo>
): Promise<void> {
  const properties: PageProperties = {};

  if (patch.title       !== undefined) properties[NOTION_FIELDS.title]       = { title:        [{ text: { content: patch.title } }] };
  if (patch.subtitle    !== undefined) properties[NOTION_FIELDS.subtitle]    = { rich_text:    [{ text: { content: patch.subtitle ?? "" } }] };
  if (patch.author      !== undefined) properties[NOTION_FIELDS.author]      = { rich_text:    [{ text: { content: patch.author } }] };
  if (patch.gender      !== undefined) properties[NOTION_FIELDS.gender]      = { rich_text:    [{ text: { content: patch.gender ?? "" } }] };
  if (patch.country     !== undefined) properties[NOTION_FIELDS.country]     = { select: patch.country ? { name: patch.country } : null };
  if (patch.genres      !== undefined) properties[NOTION_FIELDS.genres]      = { multi_select: patch.genres.map((g) => ({ name: g })) };
  if (patch.description !== undefined) properties[NOTION_FIELDS.description] = { rich_text:    [{ text: { content: patch.description } }] };

  await notion.pages.update({ page_id: pageId, properties });
}

// 按类型查该分类所有书（分页无数量限制），给分类封面墙用
export async function listAllBooksByGenre(genre: string): Promise<BookSummary[]> {
  const books: BookSummary[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filter: { property: NOTION_FIELDS.genres, multi_select: { contains: genre } },
      sorts:  [{ timestamp: "created_time", direction: "descending" }],
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: "POST",
      headers: notionHeaders,
      body: JSON.stringify(body),
    });

    if (!res.ok) { console.error("[listAllBooksByGenre]", await res.text()); return books; }

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
      const props = page.properties;
      books.push({
        pageId:    page.id,
        title:     props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "(未知书名)",
        author:    props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
        coverUrl:  parseCoverUrl(props[NOTION_FIELDS.cover]?.files?.[0]),
        notionUrl: notionUrl(page.id),
      });
    }

    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return books;
}

// 按书名 + 作者查重，返回已有页面 URL，找不到返回 null
export async function findDuplicateBook(
  title: string,
  author: string
): Promise<string | null> {
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: notionHeaders,
    body: JSON.stringify({
      filter: {
        and: [
          { property: NOTION_FIELDS.title,  title:     { equals: title } },
          { property: NOTION_FIELDS.author, rich_text: { equals: author } },
        ],
      },
      page_size: 1,
    }),
  });

  if (!res.ok) {
    console.error("[findDuplicateBook]", await res.text());
    return null;
  }

  const data = (await res.json()) as { results: { id: string }[] };
  if (data.results.length === 0) return null;
  return notionUrl(data.results[0].id);
}

// 给 createManualQuote 用：上传封面图并写入 cover 属性
export async function attachCoverToPage(
  pageId: string,
  opts: { coverBuffer?: Buffer; coverExternalUrl?: string }
): Promise<void> {
  if (opts.coverBuffer) {
    const fileUploadId = await uploadFileToNotion(opts.coverBuffer, "cover.jpg");
    await notion.pages.update({
      page_id: pageId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: { [NOTION_FIELDS.cover]: { files: [{ name: "cover.jpg", type: "file_upload", file_upload: { id: fileUploadId } }] } } as any,
    });
  } else if (opts.coverExternalUrl) {
    await notion.pages.update({
      page_id: pageId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: { [NOTION_FIELDS.cover]: { files: [{ name: "image.jpg", type: "external", external: { url: opts.coverExternalUrl } }] } } as any,
    });
  }
}
