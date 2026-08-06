// 跟主项目 src/lib/notion-fields.ts 保持一致 —— 改 Notion 字段名时两边都要改
// （MCP server 是独立进程，不能直接 import 主项目的 @/ 路径别名，所以复制一份）
export const NOTION_FIELDS = {
  title: "书名",
  author: "作者",
  genres: "类型 Label",
  description: "描述",
  cover: "封面",
  quotes: "优美语句",
} as const;
