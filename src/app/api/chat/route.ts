import { NextRequest } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { preprocessImage } from "@/lib/image";
import { recognizeBook } from "@/lib/ai";
import {
  uploadFileToNotion,
  createBookPage,
  findDuplicateBook,
  listBooksByGenre,
} from "@/lib/notion";
import type { BookInfo } from "@/types/book";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// SSE 格式：每条消息都是 "data: {...}\n\n"
// 这是 Server-Sent Events 协议的规定，浏览器原生支持
function encodeSSE(data: object, encoder: TextEncoder): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

const SYSTEM = `你是 Lovely Shelf 的 AI 书架助手，帮用户管理他们的 Notion 书库。

你可以：
1. 识别用户上传的书封面，将书籍入库
2. 查询用户书架上某类型的书，并展示这些书的优美语句（quotes 字段）
3. 回答关于书架的问题

有图片时，按以下顺序入库：
1. recognize_book_from_image 识别封面
2. check_duplicate_in_notion 检查重复（用识别出的书名和作者）
3. 如果已存在：告知用户，不继续
4. 如果未重复：upload_cover_to_notion → create_notion_page
5. 报告入库结果（书名、类型、Notion 链接）
6. 入库成功后，告诉用户这本书有几句优美语句，问他"要去语录页看看吗？"并给出链接 [去看语录](/quotes)

回复用中文，语气轻松自然。

格式规则（严格遵守）：
- 禁止使用 Markdown 表格（| --- |）
- 禁止使用代码块（\`\`\`）
- 可以用 **粗体** 强调书名或关键词
- 可以用 [链接文字](url) 格式插入链接
- 用普通换行和数字列表组织内容`;

// 聊天 Agent 的工具集：比 T23 多了 list_books_by_genre（用于回答"给我看看我的 XX 类书"）
const CHAT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "recognize_book_from_image",
    description: "从用户上传的书封面图片中提取书籍信息",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "check_duplicate_in_notion",
    description: "检查 Notion 书库中是否已有这本书",
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
    description: "上传封面图片到 Notion 文件存储",
    input_schema: {
      type: "object",
      properties: { filename: { type: "string" } },
      required: ["filename"],
    },
  },
  {
    name: "create_notion_page",
    description: "在 Notion 书库创建书籍记录",
    input_schema: {
      type: "object",
      properties: {
        bookInfo: {
          type: "object",
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
        fileUploadId: { type: "string", description: "upload_cover_to_notion 返回的 ID" },
        filename:     { type: "string" },
      },
      required: ["bookInfo", "filename"],
    },
  },
  {
    name: "list_books_by_genre",
    description: "查询书架上某个类型的书籍",
    input_schema: {
      type: "object",
      properties: {
        genre: {
          type: "string",
          description: "必须是：回忆录、传记、喜剧、冒险、心理相关、励志、身心健康、育儿、科普、园艺、体育、历史、儿童读物、旅行、其他 之一",
        },
        limit: { type: "number", description: "返回数量，默认 5" },
      },
      required: ["genre"],
    },
  },
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "未登录" }), { status: 401 });
  }

  const formData    = await request.formData();
  const messagesRaw = formData.get("messages") as string;
  const imageFile   = formData.get("image") as File | null;

  // 对话历史：前端每次把完整历史发过来，API 才能理解上下文
  // 这是"无状态 API"的标准设计：服务端不存 session，历史由前端维护
  let apiMessages: Anthropic.Messages.MessageParam[] = JSON.parse(messagesRaw || "[]");

  // 图片预处理：这一步在 Agent 循环外做，工具调用时直接从闭包拿
  let jpegBuffer: Buffer | null = null;
  let base64 = "";
  let filename = "";

  if (imageFile) {
    filename = imageFile.name;
    const raw = Buffer.from(await imageFile.arrayBuffer());
    const processed = await preprocessImage(raw);
    jpegBuffer = processed.jpegBuffer;
    base64 = processed.base64;

    // 把图片注入最后一条用户消息的 content（Anthropic vision 格式）
    const lastMsg = apiMessages[apiMessages.length - 1];
    if (lastMsg?.role === "user") {
      const textContent =
        typeof lastMsg.content === "string"
          ? lastMsg.content
          : (lastMsg.content as { type: string; text?: string }[])
              .find((b) => b.type === "text")?.text ?? "";

      apiMessages = [
        ...apiMessages.slice(0, -1),
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
            { type: "text", text: textContent || "请处理这张书封面" },
          ],
        },
      ];
    }
  }

  const encoder = new TextEncoder();
  // newMessages 收集这轮新增的消息，最后随 done 事件发给前端存入历史
  const newMessages: Anthropic.Messages.MessageParam[] = [];

  // ReadableStream + SSE：Next.js App Router 的标准流式响应写法
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encodeSSE(data, encoder));

      try {
        let step = 0;
        const currentMessages = [...apiMessages];

        // Agent 循环：和 T23 一样，只是每轮调用换成了流式版本
        while (true) {
          // client.messages.stream() 返回 MessageStream，支持 .on("text") 事件
          const msgStream = client.messages.stream({
            model:    "claude-sonnet-4-6",
            max_tokens: 4096,
            system:   SYSTEM,
            tools:    CHAT_TOOLS,
            messages: currentMessages,
          });

          // 每个 text token 到来时立刻发给前端——这就是"打字机效果"的来源
          msgStream.on("text", (delta) => send({ type: "text_delta", delta }));

          // 等整条 assistant 消息完整接收（包括所有 tool_use 块）
          const finalMsg = await msgStream.finalMessage();

          const assistantMsg: Anthropic.Messages.MessageParam = {
            role: "assistant",
            content: finalMsg.content,
          };
          currentMessages.push(assistantMsg);
          newMessages.push(assistantMsg);

          // end_turn = Claude 说"我做完了"，退出循环
          if (finalMsg.stop_reason !== "tool_use") break;

          // 找出所有工具调用指令
          const toolBlocks = finalMsg.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
          );

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

          for (const block of toolBlocks) {
            step++;
            send({ type: "tool_start", name: block.name, step });

            let result: unknown;
            try {
              result = await executeTool(block.name, block.input as Record<string, unknown>, {
                base64,
                jpegBuffer,
                filename,
              });
            } catch (err) {
              result = { error: (err as Error).message };
            }

            send({ type: "tool_end", name: block.name, step, result });
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
          }

          const toolResultMsg: Anthropic.Messages.MessageParam = { role: "user", content: toolResults };
          currentMessages.push(toolResultMsg);
          newMessages.push(toolResultMsg);
        }

        // done 事件带上新增的消息，前端把它们追加到 apiMessages 完成历史同步
        send({ type: "done", newMessages });
        controller.close();

      } catch (err) {
        send({ type: "error", message: (err as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}

// 工具执行函数：根据工具名调对应的 lib 函数
type ToolCtx = { base64: string; jpegBuffer: Buffer | null; filename: string };

async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
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

    case "list_books_by_genre": {
      const { genre, limit = 5 } = input as { genre: string; limit?: number };
      // excludePageId 传 ""：chat 场景不需要排除任何书，展示完整列表
      const books = await listBooksByGenre(genre, "", limit);
      return { books };
    }

    default:
      throw new Error(`未知工具：${name}`);
  }
}
