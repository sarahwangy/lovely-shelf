import { Client } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_TOKEN });
export const DATABASE_ID = process.env.NOTION_DATABASE_ID!;
export const NOTION_TOKEN = process.env.NOTION_TOKEN!;

// 每次调 Notion REST API 都要带这三个头，提取成常量避免重复
export const notionHeaders = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
} as const;

// 只读文件头（不带 Content-Type，用于 GET 请求）
export const notionReadHeaders = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Notion-Version": "2022-06-28",
} as const;

// Notion 页面 URL：把带连字符的 UUID 转成 Notion 接受的格式
export function notionUrl(pageId: string): string {
  return `https://notion.so/${pageId.replace(/-/g, "")}`;
}

// 从 Notion Files 属性里取 URL：自己上传的是 file.url，外链是 external.url
export function parseCoverUrl(
  file: { file?: { url: string }; external?: { url: string } } | undefined
): string | null {
  return file?.file?.url ?? file?.external?.url ?? null;
}
