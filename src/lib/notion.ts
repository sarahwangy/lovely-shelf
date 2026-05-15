import { Client } from "@notionhq/client";
import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import type { BookInfo, BookSummary } from "@/types/book";
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
  sourceFilename: string = ""
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
    [NOTION_FIELDS.status]: {
      select: { name: "草稿" },
    },
    [NOTION_FIELDS.sourceFilename]: {
      rich_text: [{ text: { content: sourceFilename } }],
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

      return {
        pageId: page.id,
        title,
        author,
        coverUrl,
        notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
      };
    });
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
