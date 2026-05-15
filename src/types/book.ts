import type { Genre, Country } from "@/lib/notion-fields";

// 这是整个项目的核心数据类型，从 AI 识别到 Notion 写入都用这一个
export type BookInfo = {
  title: string;
  subtitle: string | null;
  author: string;
  gender: string | null;     // 作者性别，识别不出时为 null
  country: Country | null;   // 必须是预设国家选项之一，或 null
  genres: Genre[];           // 必须是预设类型标签的子集
  description: string;
};

// 同类书推荐卡片用的精简类型（只需要展示够用的字段）
export type BookSummary = {
  pageId: string;
  title: string;
  author: string;
  coverUrl: string | null; // Notion 文件 URL（临时 S3 链接，约 1 小时有效）
  notionUrl: string;
};
