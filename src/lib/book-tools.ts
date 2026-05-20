import type Anthropic from "@anthropic-ai/sdk";
import type { BookInfo } from "@/types/book";
import { recognizeBook } from "@/lib/ai";
import { uploadFileToNotion, createBookPage, findDuplicateBook } from "@/lib/notion";

// 书籍入库相关的 4 个工具定义，agent.ts 和 chat/route.ts 都用这同一份
// chat/route.ts 在此基础上追加 list_books_by_genre
export const BOOK_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "recognize_book_from_image",
    description: "从已提供的书封面图片中提取书籍信息（书名、作者、类型等）",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "check_duplicate_in_notion",
    description: "检查 Notion 数据库中是否已有同名同作者的书，避免重复入库",
    input_schema: {
      type: "object",
      properties: {
        title:  { type: "string", description: "书名" },
        author: { type: "string", description: "作者名" },
      },
      required: ["title", "author"],
    },
  },
  {
    name: "upload_cover_to_notion",
    description: "将封面图片上传到 Notion 文件存储，返回上传 ID",
    input_schema: {
      type: "object",
      properties: { filename: { type: "string", description: "文件名（如 cover.jpg）" } },
      required: ["filename"],
    },
  },
  {
    name: "create_notion_page",
    description: "在 Notion 数据库中创建书籍记录，完成入库",
    input_schema: {
      type: "object",
      properties: {
        bookInfo: {
          type: "object",
          description: "书籍信息",
          properties: {
            title:       { type: "string" },
            subtitle:    { type: "string" },
            author:      { type: "string" },
            gender:      { type: "string" },
            country:     { type: "string" },
            genres:      { type: "array", items: { type: "string" } },
            description: { type: "string" },
            quotes:      { type: "array", items: { type: "string" }, description: "2-3句优美语句" },
          },
          required: ["title", "author", "genres", "description"],
        },
        fileUploadId: { type: "string",  description: "upload_cover_to_notion 返回的 ID" },
        filename:     { type: "string",  description: "原始文件名" },
      },
      required: ["bookInfo", "filename"],
    },
  },
];

export type BookToolCtx = {
  base64:     string;
  jpegBuffer: Buffer | null;
  filename:   string;
};

// 4 个入库工具的共享执行逻辑，返回原始结果
// agent.ts 调用后自行处理 AgentResult 的更新，chat/route.ts 直接把结果发给 Claude
export async function executeBookTool(
  name: string,
  input: Record<string, unknown>,
  ctx: BookToolCtx,
): Promise<unknown> {
  switch (name) {
    case "recognize_book_from_image":
      return await recognizeBook(ctx.base64);

    case "check_duplicate_in_notion": {
      const { title, author } = input as { title: string; author: string };
      const url = await findDuplicateBook(title, author);
      return { exists: url !== null, url };
    }

    case "upload_cover_to_notion": {
      if (!ctx.jpegBuffer) return { error: "没有图片可上传" };
      const { filename } = input as { filename: string };
      const fileUploadId = await uploadFileToNotion(ctx.jpegBuffer, filename || ctx.filename);
      return { fileUploadId };
    }

    case "create_notion_page": {
      const { bookInfo, fileUploadId, filename } = input as {
        bookInfo: BookInfo; fileUploadId: string | null; filename: string;
      };
      const { pageUrl } = await createBookPage(bookInfo, fileUploadId ?? null, filename || ctx.filename);
      return { pageUrl };
    }

    default:
      throw new Error(`未知工具：${name}`);
  }
}
