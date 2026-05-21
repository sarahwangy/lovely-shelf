import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/rate-limit";
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

function buildSystem(lang: string) {
  const isEn = lang === "en";
  return isEn
    ? `You are Lovely Shelf's AI assistant, helping users manage their Notion book library.

You can:
1. Identify book covers from uploaded photos and add them to the library
2. Search the shelf for books by genre and share beautiful quotes from them
3. Answer questions about the shelf
4. Discuss any book's content, themes, key ideas, and give reading insights using your own knowledge — even if the book isn't in the library

When someone asks "what is this book about?" or "summarize this book" or "what are the main ideas?", answer directly from your own knowledge. Do NOT say you can only access Notion.

When an image is attached, follow this order:
1. recognize_book_from_image — identify the cover
2. check_duplicate_in_notion — check for duplicates (use the identified title and author)
3. If already exists: inform the user, stop
4. If not duplicate: upload_cover_to_notion → create_notion_page
5. Report the result (title, genre, Notion link)
6. After successful save, mention how many quotes are in the book and ask "Want to see them on the Quotes page?" with link [Go to Quotes](/quotes)

Note: genre names in the Notion database are stored in Chinese. When calling list_books_by_genre, always pass the Chinese genre name (e.g. "励志" for self-help, "心理相关" for psychology).

Reply in English. Keep the tone warm and friendly.

Formatting rules (strictly follow):
- No Markdown tables (| --- |)
- No code blocks (\`\`\`)
- Use **bold** to highlight titles or keywords
- Use [link text](url) format for links
- Use plain line breaks and numbered lists`
    : `你是 Lovely Shelf 的 AI 书架助手，帮用户管理他们的 Notion 书库。

你可以：
1. 识别用户上传的书封面，将书籍入库
2. 查询用户书架上某类型的书，并展示这些书的优美语句（quotes 字段）
3. 回答关于书架的问题
4. 用自己的训练知识讨论任何书的内容、主题、核心观点、读书建议——即使这本书不在书库里

当用户问"这本书讲什么"、"帮我分析一下这本书的内容"、"这本书的核心思想是什么"，直接用你自己的知识回答，不要说"我只能读取 Notion 的内容"。

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
}

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

  const isDemo = session.user.email === "demo@lovely-shelf.com";

  const rl = checkRateLimit(session.user.email!, "chat", 30);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "今日对话次数已达上限（30次），请明天再试" }),
      { status: 429 }
    );
  }

  const formData    = await request.formData();
  const messagesRaw = formData.get("messages") as string;
  const lang        = (formData.get("lang") as string | null) ?? "zh";
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
            system:   buildSystem(lang),
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
                isDemo,
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

// ── Demo 模式假数据 ────────────────────────────────────────────────
// 轮流返回不同的"识别结果"，让 demo 每次上传都感觉不一样
const DEMO_RECOGNIZE_POOL: BookInfo[] = [
  {
    title: "挪威的森林", subtitle: "", author: "村上春树", gender: "男",
    country: "日本", genres: ["其他"],
    description: "一部以1960年代末东京为背景的成长小说，讲述主人公渡边彻的青春与失落。",
    quotes: ["死并非生的对立面，而是作为生的一部分永存。", "哪里会有人喜欢孤独，不过是不喜欢失望。"],
  },
  {
    title: "小王子", subtitle: "", author: "圣·埃克苏佩里", gender: "男",
    country: null, genres: ["儿童读物"],
    description: "一个飞行员在沙漠中遇见小王子，听他讲述自己星球上的故事。",
    quotes: ["真正重要的东西，用眼睛是看不见的。", "你在你的玫瑰身上耗费的时间，使你的玫瑰变得如此重要。"],
  },
  {
    title: "被讨厌的勇气", subtitle: "自我启发之父阿德勒的哲学课", author: "岸见一郎 / 古贺史健", gender: "男",
    country: "日本", genres: ["心理相关", "励志"],
    description: "以哲人与青年的对话形式，阐述阿德勒心理学的核心思想。",
    quotes: ["决定我们自身的，不是过去的经历，而是我们自己赋予经历的意义。", "所谓自由，就是被别人讨厌。"],
  },
  {
    title: "瓦尔登湖", subtitle: "", author: "亨利·戴维·梭罗", gender: "男",
    country: "美国", genres: ["其他"],
    description: "梭罗独居瓦尔登湖畔两年的生活记录，探讨简朴生活与自然的意义。",
    quotes: ["我步入丛林，因为我希望生活得有意义。", "大多数人都生活在平静的绝望中。"],
  },
];

let _demoRecognizeIdx = 0;

// Demo 模式的书单（用于 list_books_by_genre）
const DEMO_GENRE_BOOKS = [
  { title: "活着",       author: "余华",           genres: ["小说"],       quotes: ["人是为了活着本身而活着。"] },
  { title: "小王子",     author: "圣·埃克苏佩里", genres: ["小说"],       quotes: ["真正重要的东西用眼睛看不见。"] },
  { title: "百年孤独",   author: "加西亚·马尔克斯", genres: ["小说"],     quotes: ["过去都是假的。"] },
  { title: "人间失格",   author: "太宰治",         genres: ["小说"],       quotes: ["我的不幸恰恰在于我缺乏拒绝的能力。"] },
  { title: "被讨厌的勇气", author: "岸见一郎",    genres: ["心理相关", "励志"], quotes: ["决定我们自身的不是过去的经历。"] },
  { title: "当下的力量", author: "埃克哈特·托利", genres: ["心理相关", "身心健康"], quotes: ["你无法在未来找到自己。"] },
  { title: "瓦尔登湖",   author: "梭罗",           genres: ["散文"],       quotes: ["我步入丛林，因为我希望生活得有意义。"] },
];

async function executeDemoTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "recognize_book_from_image": {
      // 轮流返回不同书，模拟每次上传都识别出不同内容
      const book = DEMO_RECOGNIZE_POOL[_demoRecognizeIdx % DEMO_RECOGNIZE_POOL.length];
      _demoRecognizeIdx++;
      return book;
    }
    case "check_duplicate_in_notion":
      return { exists: false, url: null };

    case "upload_cover_to_notion":
      return { fileUploadId: "demo-file-upload-id" };

    case "create_notion_page":
      return { pageUrl: "https://notion.so/demo" };

    case "list_books_by_genre": {
      const { genre, limit = 5 } = input as { genre: string; limit?: number };
      const filtered = DEMO_GENRE_BOOKS
        .filter((b) => genre === "其他" || b.genres.some((g) => g.includes(genre) || genre.includes(g)))
        .slice(0, limit);
      // 没有精确匹配时返回前几本，避免空列表
      return { books: filtered.length > 0 ? filtered : DEMO_GENRE_BOOKS.slice(0, limit) };
    }

    default:
      throw new Error(`未知工具：${name}`);
  }
}

// 工具执行函数：根据工具名调对应的 lib 函数
type ToolCtx = { base64: string; jpegBuffer: Buffer | null; filename: string; isDemo: boolean };

async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  // Demo 模式：不调用真实 Notion/AI，返回假数据
  if (ctx.isDemo) return executeDemoTool(name, input);

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
