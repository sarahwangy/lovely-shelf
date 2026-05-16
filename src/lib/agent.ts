import Anthropic from "@anthropic-ai/sdk";
import type { BookInfo } from "@/types/book";
import { recognizeBook } from "@/lib/ai";
import { uploadFileToNotion, createBookPage, findDuplicateBook } from "@/lib/notion";

// 只初始化一次，和 ai.ts 里的约定一样
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Tool Use 的工具定义：告诉 Claude "你有哪些工具、每个工具的参数是什么"
// input_schema 就是标准 JSON Schema，Claude 会按这个格式填参数
const AGENT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "recognize_book_from_image",
    description: "从已提供的书封面图片中提取书籍信息（书名、作者、类型等）",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "check_duplicate_in_notion",
    description: "检查 Notion 数据库中是否已有同名同作者的书，避免重复入库",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "书名" },
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
      properties: {
        filename: { type: "string", description: "文件名（如 cover.jpg）" },
      },
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

// System prompt：明确告诉 Agent 做什么、顺序是什么
// Tool Use 里 system prompt 很重要——它决定 Agent 的行为策略
const SYSTEM_PROMPT = `你是一个书籍入库 Agent。用户会给你一张书封面图片，按以下步骤完成入库：

1. 调用 recognize_book_from_image 识别封面上的书籍信息
2. 调用 check_duplicate_in_notion 检查这本书是否已入库（用识别出的书名和作者）
3. 如果已入库（exists=true），直接说明"已存在"并报告链接，不再继续后续步骤
4. 如果未重复，调用 upload_cover_to_notion 上传封面图片
5. 调用 create_notion_page 把书籍信息和封面 ID 写入 Notion
6. 简短报告入库结果

请严格按以上顺序执行，不要跳步骤。`;

// Agent 的返回结果类型
export type AgentResult = {
  bookInfo:     BookInfo | null;
  pageUrl:      string | null;
  isDuplicate:  boolean;
  duplicateUrl: string | null;
};

// 结构化日志：[时间戳] [agent] step N: 工具名 状态 耗时ms
function log(step: number, tool: string, status: "ok" | "err", ms: number) {
  console.log(`[${new Date().toISOString()}] [agent] step ${step}: ${tool} ${status} ${ms}ms`);
}

// Agent 主函数：接收预处理好的图片，跑完整个入库流程
// base64 给 Claude 看图用，jpegBuffer 给 Notion 上传用
export async function runBookAgent(
  base64: string,
  jpegBuffer: Buffer,
  filename: string,
): Promise<AgentResult> {
  // result 对象会在工具执行过程中被逐步填充
  const result: AgentResult = {
    bookInfo:     null,
    pageUrl:      null,
    isDuplicate:  false,
    duplicateUrl: null,
  };

  // messages 数组是 Agent 的"对话历史"：用户 → Claude → 工具结果 → Claude → ...
  // 行业里叫 "conversation history"，每轮都把历史带上，Claude 才知道上下文
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: [
        // 把图片作为 vision 内容传给 Claude，Claude 能"看"这张图
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: base64 },
        },
        {
          type: "text",
          text: `请处理这张书封面图片，完成入库流程。原始文件名：${filename}`,
        },
      ],
    },
  ];

  let step = 0;

  // Agent 循环：只要 Claude 还在调工具就继续
  // stop_reason === "tool_use"  → Claude 想调工具，我们执行后把结果塞回去
  // stop_reason === "end_turn"  → Claude 说"我做完了"，退出循环
  while (true) {
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      tools:      AGENT_TOOLS,
      messages,
    });

    // Claude 的回复加入历史，下一轮它才能"记住"自己说过什么
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") break;

    // 找出这一轮里所有 tool_use 类型的 content block
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );

    // 把每个工具的执行结果打包成 tool_result，作为下一条 user 消息发回去
    // 这是 Anthropic Tool Use 的标准协议
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      step++;
      const t = Date.now();
      let content: string;

      try {
        const output = await executeTool(
          block.name,
          block.input as Record<string, unknown>,
          { base64, jpegBuffer, filename, result },
        );
        content = JSON.stringify(output);
        log(step, block.name, "ok", Date.now() - t);
      } catch (err) {
        content = JSON.stringify({ error: (err as Error).message });
        log(step, block.name, "err", Date.now() - t);
      }

      toolResults.push({ type: "tool_result", tool_use_id: block.id, content });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return result;
}

// executeTool：根据工具名分发到对应的实现函数
// 每个 case 对应一个工具，调用已有的 lib 函数，并把结果写入 result（共享状态）
type ToolContext = {
  base64:     string;
  jpegBuffer: Buffer;
  filename:   string;
  result:     AgentResult;
};

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  switch (name) {
    case "recognize_book_from_image": {
      // 调用现有的 recognizeBook 函数（ai.ts），用 base64 图片识别书籍信息
      const bookInfo = await recognizeBook(ctx.base64);
      ctx.result.bookInfo = bookInfo;
      return bookInfo;
    }

    case "check_duplicate_in_notion": {
      const { title, author } = input as { title: string; author: string };
      const url = await findDuplicateBook(title, author);
      ctx.result.isDuplicate  = url !== null;
      ctx.result.duplicateUrl = url;
      return { exists: url !== null, url };
    }

    case "upload_cover_to_notion": {
      const { filename } = input as { filename: string };
      // jpegBuffer 是预处理后的图片二进制，从 context 里拿
      const fileUploadId = await uploadFileToNotion(ctx.jpegBuffer, filename);
      return { fileUploadId };
    }

    case "create_notion_page": {
      const { bookInfo, fileUploadId, filename } = input as {
        bookInfo:     BookInfo;
        fileUploadId: string | null;
        filename:     string;
      };
      const { pageUrl } = await createBookPage(bookInfo, fileUploadId ?? null, filename);
      ctx.result.pageUrl  = pageUrl;
      ctx.result.bookInfo = bookInfo;
      return { pageUrl };
    }

    default:
      throw new Error(`未知工具：${name}`);
  }
}
