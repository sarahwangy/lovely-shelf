import type { Genre, Country } from "@/lib/notion-fields";

// 这是整个项目的核心数据类型，从 AI 识别到 Notion 写入都用这一个
export type BookInfo = {
  title: string;
  subtitle: string | null;
  author: string;
  gender: string | null;
  country: Country | null;
  genres: Genre[];
  description: string;
  quotes: string[];          // 优美语句，2-3 句，存入 Notion「优美语句」列
};

// 书籍详情 modal 用的完整类型（包含所有字段 + Notion 元信息）
export type BookDetail = {
  pageId: string;
  pageUrl: string;
  title: string;
  subtitle: string | null;
  author: string;
  gender: string | null;
  country: Country | null;
  genres: Genre[];
  description: string;
  coverUrl: string | null;
  quotes: string[];
};

// 同类书推荐卡片用的精简类型（只需要展示够用的字段）
export type BookSummary = {
  pageId: string;
  title: string;
  author: string;
  coverUrl: string | null; // Notion 文件 URL（临时 S3 链接，约 1 小时有效）
  notionUrl: string;
  quotes?: string[];       // 优美语句，可选（部分调用场景不需要）
};
