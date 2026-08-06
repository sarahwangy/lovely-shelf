// Lovely Shelf 的 MCP Server
// 作用：让 Claude Desktop / Claude Code 这类支持 MCP 的客户端，
// 能直接查询你 Notion 书架里的书，不用自己写 prompt 拼 API 调用。
//
// 跟网页版 lovely-shelf 是两个独立进程：
// 网页版用 Next.js 跑在浏览器里，这个 server 用 stdio（标准输入输出）跟 MCP 客户端通信，
// 两者都是"调同一个 Notion 数据库"，逻辑复用但进程分开。

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { NOTION_FIELDS } from "./notion-fields.js";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN || !DATABASE_ID) {
  // MCP server 是被客户端（比如 Claude Desktop）启动的子进程，
  // 这里直接 throw 会让客户端那边看到清晰的报错，而不是静默失败
  throw new Error("缺少 NOTION_TOKEN 或 NOTION_DATABASE_ID 环境变量");
}

// 统一封装调用 Notion REST API 的逻辑，跟主项目 notion.ts 里的写法保持一致
async function notionFetch(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Notion API 出错：${await res.text()}`);
  }
  return res.json();
}

// Notion 页面 properties 的类型比较复杂，这里只取我们需要的几个字段
type NotionPage = {
  id: string;
  properties: Record<
    string,
    {
      title?: { plain_text: string }[];
      rich_text?: { plain_text: string }[];
      multi_select?: { name: string }[];
      files?: { file?: { url: string }; external?: { url: string } }[];
    }
  >;
};

function pageToBookSummary(page: NotionPage) {
  const props = page.properties;
  const coverFile = props[NOTION_FIELDS.cover]?.files?.[0];
  return {
    pageId: page.id,
    title: props[NOTION_FIELDS.title]?.title?.[0]?.plain_text ?? "(未知书名)",
    author: props[NOTION_FIELDS.author]?.rich_text?.[0]?.plain_text ?? "",
    genres: props[NOTION_FIELDS.genres]?.multi_select?.map((g) => g.name) ?? [],
    description: props[NOTION_FIELDS.description]?.rich_text?.[0]?.plain_text ?? "",
    coverUrl: coverFile?.file?.url ?? coverFile?.external?.url ?? null,
    notionUrl: `https://notion.so/${page.id.replace(/-/g, "")}`,
  };
}

const server = new McpServer({
  name: "lovely-shelf",
  version: "1.0.0",
});

// Tool 1：按书名/作者关键词搜索书架
server.registerTool(
  "search_books",
  {
    title: "搜索书架",
    description: "按书名或作者关键词搜索 Lovely Shelf 书架里的书",
    inputSchema: {
      query: z.string().describe("书名或作者的关键词，支持模糊匹配"),
    },
  },
  async ({ query }) => {
    // Notion 的 rich_text/title filter 支持 "contains"，等价于模糊搜索
    // 书名和作者各查一次，然后按 pageId 去重合并
    const data = (await notionFetch(`/databases/${DATABASE_ID}/query`, {
      filter: {
        or: [
          { property: NOTION_FIELDS.title, title: { contains: query } },
          { property: NOTION_FIELDS.author, rich_text: { contains: query } },
        ],
      },
      page_size: 20,
    })) as { results: NotionPage[] };

    const books = data.results.map(pageToBookSummary);

    return {
      content: [
        {
          type: "text",
          text:
            books.length > 0
              ? JSON.stringify(books, null, 2)
              : `没有找到匹配"${query}"的书`,
        },
      ],
    };
  }
);

// Tool 2：按 pageId 查单本书的详细信息
server.registerTool(
  "get_book_by_id",
  {
    title: "查询书籍详情",
    description: "按 Notion pageId 获取一本书的完整详情（简介、优美语句等）",
    inputSchema: {
      pageId: z.string().describe("书籍在 Notion 里的 page ID"),
    },
  },
  async ({ pageId }) => {
    const page = (await (
      await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
        },
      })
    ).json()) as NotionPage;

    const props = page.properties;
    const quotesRaw = props[NOTION_FIELDS.quotes]?.rich_text?.[0]?.plain_text ?? "";

    const book = {
      ...pageToBookSummary(page),
      quotes: quotesRaw ? quotesRaw.split("\n").filter(Boolean) : [],
    };

    return {
      content: [{ type: "text", text: JSON.stringify(book, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Lovely Shelf MCP server 已启动"); // 用 console.error 而不是 console.log：
  // stdout 被 MCP 协议占用做数据通信，日志只能打到 stderr，否则会污染协议数据
}

main().catch((err) => {
  console.error("MCP server 启动失败：", err);
  process.exit(1);
});
