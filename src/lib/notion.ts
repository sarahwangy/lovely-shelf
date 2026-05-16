import { Client } from "@notionhq/client";
import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import type { BookInfo, BookSummary, BookDetail } from "@/types/book";
import { NOTION_FIELDS } from "@/lib/notion-fields";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID!;
const NOTION_TOKEN = process.env.NOTION_TOKEN!;

// 把图片 Buffer 上传到 Notion，返回 file_upload_id
// Notion SDK 还没有 TypeScript 类型支持文件上传，所以用 fetch 直接调 REST API
export async function uploadFileToNotion(
  buffer: Buffer,
  filename: string
): Promise<string> {
  // 第一步：告诉 Notion "我要上传一个文件"，拿到上传地址
  const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename, content_type: "image/jpeg" }),
  });

  if (!createRes.ok) {
    throw new Error(`创建上传任务失败：${await createRes.text()}`);
  }

  const { id, upload_url } = (await createRes.json()) as {
    id: string;
    upload_url: string;
  };

  // 第二步：用 multipart/form-data 把图片发到 Notion 的 /send 端点
  // Blob 是浏览器和 Node.js 18+ 都支持的二进制对象，FormData 需要它
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), filename);

  const uploadRes = await fetch(upload_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      // 注意：不要手动设 Content-Type，fetch 会自动加 boundary
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`上传图片失败：${await uploadRes.text()}`);
  }

  return id;
}

// properties 的类型直接从 SDK 导入，避免手写复杂的类型
type PageProperties = CreatePageParameters["properties"];

export async function createBookPage(
  info: BookInfo,
  fileUploadId: string | null,
  sourceFilename: string = "", // 保留参数避免改所有调用处，但不再写入 Notion
): Promise<{ pageId: string; pageUrl: string }> {
  // [NOTION_FIELDS.xxx] 是计算属性名：运行时把变量值当作 key
  // 好处：改字段名只改 notion-fields.ts，这里自动跟着变
  const properties: PageProperties = {
    [NOTION_FIELDS.title]: {
      title: [{ text: { content: info.title } }],
    },
    // 普通文本字段用 rich_text（不是 text）
    [NOTION_FIELDS.subtitle]: {
      rich_text: [{ text: { content: info.subtitle ?? "" } }],
    },
    [NOTION_FIELDS.author]: {
      rich_text: [{ text: { content: info.author } }],
    },
    [NOTION_FIELDS.gender]: {
      rich_text: [{ text: { content: info.gender ?? "" } }],
    },
    // Select 为 null 时显式传 null，不能省略
    [NOTION_FIELDS.country]: {
      select: info.country ? { name: info.country } : null,
    },
    // Multi-select：每个标签包成 { name: "标签名" }
    [NOTION_FIELDS.genres]: {
      multi_select: info.genres.map((g) => ({ name: g })),
    },
    [NOTION_FIELDS.description]: {
      rich_text: [{ text: { content: info.description } }],
    },
    // quotes 数组用换行拼成一段文字存入 rich_text
    // 读取时再按换行切割回数组
    [NOTION_FIELDS.quotes]: {
      rich_text: [{ text: { content: (info.quotes ?? []).join("\n") } }],
    },
  };

  if (fileUploadId) {
    properties[NOTION_FIELDS.cover] = {
      files: [
        {
          name: sourceFilename || "cover.jpg",
          type: "file_upload",
          file_upload: { id: fileUploadId },
        },
      ],
    };
  }

  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties,
  });

  const pageUrl = `https://notion.so/${page.id.replace(/-/g, "")}`;
  return { pageId: page.id, pageUrl };
}

// 统计某类型下的书籍总数，给"第 X 本 XX 类"成就感提示用
// Notion API 没有直接返回 total count，需要分页累加 results.length
export async function countBooksByGenre(genre: string): Promise<number> {
  let count = 0;
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filter: {
        property: NOTION_FIELDS.genres,
        // multi_select contains：只要这本书的类型标签包含 genre 就算
        multi_select: { contains: genre },
      },
      page_size: 100, // 单次最多 100 条，有 has_more 就继续翻页
    };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      // 查询失败时不抛错，返回已累计的数量（可能不完整，但不阻断主流程）
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

// 查同类书推荐：按类型找最近入库的书，排除刚入库的那本，最多返回 limit 本
export async function listBooksByGenre(
  genre: string,
  excludePageId: string,
  limit = 5
): Promise<BookSummary[]> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: NOTION_FIELDS.genres,
          multi_select: { contains: genre },
        },
        // created_time 降序：最近入库的排前面
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        // 多取一本，过滤掉刚入库的那本后还能凑够 limit 本
        page_size: limit + 1,
      }),
    }
  );

  if (!res.ok) {
    console.error("[listBooksByGenre]", await res.text());
    return [];
  }

  // Notion 页面 properties 的类型比较复杂，用 unknown 再按需取值
  const data = (await res.json()) as {
    results: {
      id: string;
      properties: Record<string, unknown>;
    }[];
  };

  return data.results
    .filter((page) => page.id.replace(/-/g, "") !== excludePageId.replace(/-/g, ""))
    .slice(0, limit)
    .map((page) => {
      const props = page.properties as Record<string, {
        title?: { plain_text: string }[];
        rich_text?: { plain_text: string }[];
        files?: { file?: { url: string }; external?: { url: string } }[];
      }>;

      // 从 title 属性取书名（数组里第一个文本块）
      const title = props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "(未知书名)";
      const author = props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "";
      // 封面是 Files 属性：自己上传的是 file.url，外链是 external.url
      const coverFile = props[NOTION_FIELDS.cover]?.files?.[0];
      const coverUrl = coverFile?.file?.url ?? coverFile?.external?.url ?? null;
      const quotesRaw = props[NOTION_FIELDS.quotes]?.rich_text?.[0]?.plain_text ?? "";
      const quotes = quotesRaw ? quotesRaw.split("\n").filter(Boolean) : [];

      return {
        pageId: page.id,
        title,
        author,
        coverUrl,
        notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
        quotes,
      };
    });
}

// 按 pageId 取单本书的完整信息，给书籍详情 modal 用
export async function getBookByPageId(pageId: string): Promise<BookDetail> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!res.ok) {
    throw new Error(`获取书籍详情失败：${await res.text()}`);
  }

  const page = (await res.json()) as {
    id: string;
    properties: Record<string, {
      type: string;
      title?: { plain_text: string }[];
      rich_text?: { plain_text: string }[];
      select?: { name: string } | null;
      multi_select?: { name: string }[];
      files?: { file?: { url: string }; external?: { url: string } }[];
    }>;
  };

  const props = page.properties;
  const coverFile = props[NOTION_FIELDS.cover]?.files?.[0];
  const quotesRaw = props[NOTION_FIELDS.quotes]?.rich_text?.[0]?.plain_text ?? "";

  return {
    pageId: page.id,
    pageUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
    title: props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "",
    subtitle: props[NOTION_FIELDS.subtitle]?.rich_text?.[0]?.plain_text || null,
    author: props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
    gender: props[NOTION_FIELDS.gender]?.rich_text?.[0]?.plain_text || null,
    country: (props[NOTION_FIELDS.country]?.select?.name ?? null) as BookDetail["country"],
    genres: (props[NOTION_FIELDS.genres]?.multi_select?.map((g) => g.name) ?? []) as BookDetail["genres"],
    description: props[NOTION_FIELDS.description]?.rich_text?.[0]?.plain_text ?? "",
    coverUrl: coverFile?.file?.url ?? coverFile?.external?.url ?? null,
    quotes: quotesRaw ? quotesRaw.split("\n").filter(Boolean) : [],
  };
}

// 局部更新书籍字段，给 modal 编辑保存用
// Partial<BookInfo> 表示 BookInfo 里所有字段都变成可选，只传要改的那几个
export async function updateBookPage(
  pageId: string,
  patch: Partial<BookInfo>
): Promise<void> {
  const properties: PageProperties = {};

  // 只把 patch 里有的字段塞进 properties，没传的字段不改
  if (patch.title !== undefined)
    properties[NOTION_FIELDS.title] = { title: [{ text: { content: patch.title } }] };
  if (patch.subtitle !== undefined)
    properties[NOTION_FIELDS.subtitle] = { rich_text: [{ text: { content: patch.subtitle ?? "" } }] };
  if (patch.author !== undefined)
    properties[NOTION_FIELDS.author] = { rich_text: [{ text: { content: patch.author } }] };
  if (patch.gender !== undefined)
    properties[NOTION_FIELDS.gender] = { rich_text: [{ text: { content: patch.gender ?? "" } }] };
  if (patch.country !== undefined)
    properties[NOTION_FIELDS.country] = { select: patch.country ? { name: patch.country } : null };
  if (patch.genres !== undefined)
    properties[NOTION_FIELDS.genres] = { multi_select: patch.genres.map((g) => ({ name: g })) };
  if (patch.description !== undefined)
    properties[NOTION_FIELDS.description] = { rich_text: [{ text: { content: patch.description } }] };

  await notion.pages.update({ page_id: pageId, properties });
}

// 按类型查该分类所有书（分页，无数量限制），给分类封面墙用
export async function listAllBooksByGenre(genre: string): Promise<BookSummary[]> {
  const books: BookSummary[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filter: { property: NOTION_FIELDS.genres, multi_select: { contains: genre } },
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

    if (!res.ok) { console.error("[listAllBooksByGenre]", await res.text()); return books; }

    const data = (await res.json()) as {
      results: { id: string; properties: Record<string, {
        title?: { plain_text: string }[];
        rich_text?: { plain_text: string }[];
        files?: { file?: { url: string }; external?: { url: string } }[];
      }> }[];
      has_more: boolean;
      next_cursor: string | null;
    };

    for (const page of data.results) {
      const props = page.properties;
      const coverFile = props[NOTION_FIELDS.cover]?.files?.[0];
      books.push({
        pageId: page.id,
        title: props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "(未知书名)",
        author: props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
        coverUrl: coverFile?.file?.url ?? coverFile?.external?.url ?? null,
        notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
      });
    }

    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined;
  } while (cursor);

  return books;
}

// 把文字按 1900 字符分段（Notion rich_text 单段上限 2000 字符）
function toRichTextSegments(text: string) {
  const segs: { text: { content: string } }[] = [];
  for (let i = 0; i < text.length; i += 1900) {
    segs.push({ text: { content: text.slice(i, i + 1900) } });
  }
  return segs.length ? segs : [{ text: { content: "" } }];
}

// 追加语句到 Notion 中固定的"手动语录"页面
// 若该页面不存在则自动创建；返回更新后的全部语句
export async function appendManualQuote(
  text: string,
  opts: { musicUrl?: string; videoUrl?: string } = {},
): Promise<{ pageId: string; pageUrl: string; allQuotes: string[] }> {
  const { musicUrl, videoUrl } = opts;

  // 搜索书名 = "手动语录" 的页面
  const searchRes = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
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

  const searchData = (await searchRes.json()) as {
    results: {
      id: string;
      properties: Record<string, { rich_text?: { plain_text: string }[] }>;
    }[];
  };

  let pageId: string;
  let currentQuotes: string[] = [];

  if (searchData.results?.length > 0) {
    // 找到页面：读出当前所有语句
    const page = searchData.results[0];
    pageId = page.id;
    const rawText = (page.properties[NOTION_FIELDS.quotes]?.rich_text ?? [])
      .map((r) => r.plain_text)
      .join("");
    currentQuotes = rawText ? rawText.split("\n").filter(Boolean) : [];
  } else {
    // 不存在则新建一个空的"手动语录"页
    const newPage = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: {
        [NOTION_FIELDS.title]:       { title:     [{ text: { content: "手动语录" } }] },
        [NOTION_FIELDS.author]:      { rich_text: [{ text: { content: "" } }] },
        [NOTION_FIELDS.genres]:      { multi_select: [] },
        [NOTION_FIELDS.description]: { rich_text: [{ text: { content: "" } }] },
        [NOTION_FIELDS.quotes]:      { rich_text: [{ text: { content: "" } }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    pageId = newPage.id;
  }

  // 拼接新语句，按 1900 字符分段更新 Notion
  const allQuotes = [...currentQuotes, text.trim()];
  const fullText  = allQuotes.join("\n");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [NOTION_FIELDS.quotes]: { rich_text: toRichTextSegments(fullText) },
  };
  if (musicUrl) properties[NOTION_FIELDS.music] = { url: musicUrl };
  if (videoUrl) properties[NOTION_FIELDS.video] = { url: videoUrl };

  await notion.pages.update({ page_id: pageId, properties });

  return {
    pageId,
    pageUrl: `https://notion.so/${pageId.replace(/-/g, "")}`,
    allQuotes,
  };
}

// 手动添加一条语录，支持图片封面（本地上传或外链）、音乐/视频 URL
export async function createManualQuote(
  text: string,
  opts: {
    bookTitle?:        string;
    author?:           string;
    coverBuffer?:      Buffer;  // 本地上传的图片 Buffer
    coverExternalUrl?: string;  // Pexels/Pixabay 图片 URL（外链）
    musicUrl?:         string;
    videoUrl?:         string;
  } = {},
): Promise<{ pageId: string; pageUrl: string }> {
  const { bookTitle, author, coverBuffer, coverExternalUrl, musicUrl, videoUrl } = opts;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [NOTION_FIELDS.title]:       { title:     [{ text: { content: bookTitle?.trim() || "📝 手动语录" } }] },
    [NOTION_FIELDS.author]:      { rich_text: [{ text: { content: author?.trim() || "" } }] },
    [NOTION_FIELDS.genres]:      { multi_select: [] },
    [NOTION_FIELDS.description]: { rich_text: [{ text: { content: "" } }] },
    [NOTION_FIELDS.quotes]:      { rich_text: [{ text: { content: text.trim() } }] },
  };

  // Notion URL 属性类型：直接存链接，null = 清空
  if (musicUrl) properties[NOTION_FIELDS.music] = { url: musicUrl };
  if (videoUrl) properties[NOTION_FIELDS.video] = { url: videoUrl };

  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties,
  });

  const pageId  = page.id;
  const pageUrl = `https://notion.so/${pageId.replace(/-/g, "")}`;

  // 封面：本地上传走 file_upload，外链走 external
  if (coverBuffer) {
    const fileUploadId = await uploadFileToNotion(coverBuffer, "cover.jpg");
    await notion.pages.update({
      page_id: pageId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: { [NOTION_FIELDS.cover]: { files: [{ name: "cover.jpg", type: "file_upload", file_upload: { id: fileUploadId } }] } } as any,
    });
  } else if (coverExternalUrl) {
    await notion.pages.update({
      page_id: pageId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties: { [NOTION_FIELDS.cover]: { files: [{ name: "image.jpg", type: "external", external: { url: coverExternalUrl } }] } } as any,
    });
  }

  return { pageId, pageUrl };
}

// 按书名 + 作者查重，返回已有页面的 URL，找不到返回 null
// SDK v5 的 dataSources.query 需要 data_source_id（不同于 database_id），
// 直接调 REST API /v1/databases/{id}/query 更稳，和文件上传用同一模式
export async function findDuplicateBook(
  title: string,
  author: string
): Promise<string | null> {
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: {
        and: [
          { property: NOTION_FIELDS.title, title: { equals: title } },
          { property: NOTION_FIELDS.author, rich_text: { equals: author } },
        ],
      },
      page_size: 1,
    }),
  });

  if (!res.ok) {
    // 查重失败不阻断主流程，打日志后当作"未重复"处理
    console.error("[findDuplicateBook]", await res.text());
    return null;
  }

  const data = await res.json() as { results: { id: string }[] };
  if (data.results.length === 0) return null;
  return `https://notion.so/${data.results[0].id.replace(/-/g, "")}`;
}
