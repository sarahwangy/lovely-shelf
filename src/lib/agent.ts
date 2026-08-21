import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import type { BookInfo } from "@/types/book";
import { recognizeBook } from "@/lib/ai";
import { uploadFileToNotion, createBookPage, findDuplicateBook } from "@/lib/notion";

// System prompt：跟原来手写版一致——顺序是 Agent 行为策略，不能省
const SYSTEM_PROMPT = `你是一个书籍入库 Agent。用户会给你一张书封面图片，按以下步骤完成入库：

1. 调用 recognize_book_from_image 识别封面上的书籍信息
2. 调用 check_duplicate_in_notion 检查这本书是否已入库（用识别出的书名和作者）
3. 如果已入库（exists=true），直接说明"已存在"并报告链接，不再继续后续步骤
4. 如果未重复，调用 upload_cover_to_notion 上传封面图片
5. 调用 create_notion_page 把书籍信息和封面 ID 写入 Notion
6. 简短报告入库结果

请严格按以上顺序执行，不要跳步骤。`;

// Agent 的返回结果类型——外部调用方（api/agent/route.ts）不变，签名保持一致
export type AgentResult = {
  bookInfo: BookInfo | null;
  pageUrl: string | null;
  isDuplicate: boolean;
  duplicateUrl: string | null;
};

// 结构化日志：[时间戳] [agent] step N: 工具名 状态 耗时ms
function log(step: number, toolName: string, status: "ok" | "err", ms: number) {
  console.log(`[${new Date().toISOString()}] [agent] step ${step}: ${toolName} ${status} ${ms}ms`);
}

// Agent 主函数：接收预处理好的图片，跑完整个入库流程
// base64 给 Claude 看图用，jpegBuffer 给 Notion 上传用
export async function runBookAgent(
  base64: string,
  jpegBuffer: Buffer,
  filename: string,
): Promise<AgentResult> {
  // result 对象在工具执行过程中被逐步填充，跟原来手写版一样——
  // LangGraph 的工具循环本身不关心"业务结果"，只关心"消息历史"，
  // 所以业务状态仍然靠闭包里的这个可变对象收集，跟原实现的设计保持一致
  const result: AgentResult = {
    bookInfo: null,
    pageUrl: null,
    isDuplicate: false,
    duplicateUrl: null,
  };

  let step = 0;
  // 给每个工具包一层计时+日志，格式跟原来手写版完全一致
  async function withLogging<T>(name: string, fn: () => Promise<T>): Promise<T> {
    step++;
    const t = Date.now();
    try {
      const out = await fn();
      log(step, name, "ok", Date.now() - t);
      return out;
    } catch (err) {
      log(step, name, "err", Date.now() - t);
      throw err;
    }
  }

  // 四个工具：跟原来 AGENT_TOOLS + executeTool 是同一套业务逻辑，
  // 区别是 schema 用 zod 描述（类型安全、自动生成JSON Schema），
  // 不用像原来那样手写 input_schema 对象 + 手写 switch-case 分发
  const recognizeBookFromImage = tool(
    async () =>
      withLogging("recognize_book_from_image", async () => {
        const bookInfo = await recognizeBook(base64);
        result.bookInfo = bookInfo;
        return bookInfo;
      }),
    {
      name: "recognize_book_from_image",
      description: "从已提供的书封面图片中提取书籍信息（书名、作者、类型等）",
      schema: z.object({}),
    },
  );

  const checkDuplicateInNotion = tool(
    async ({ title, author }: { title: string; author: string }) =>
      withLogging("check_duplicate_in_notion", async () => {
        const url = await findDuplicateBook(title, author);
        result.isDuplicate = url !== null;
        result.duplicateUrl = url;
        return { exists: url !== null, url };
      }),
    {
      name: "check_duplicate_in_notion",
      description: "检查 Notion 数据库中是否已有同名同作者的书，避免重复入库",
      schema: z.object({
        title: z.string().describe("书名"),
        author: z.string().describe("作者名"),
      }),
    },
  );

  const uploadCoverToNotion = tool(
    async ({ filename: uploadFilename }: { filename: string }) =>
      withLogging("upload_cover_to_notion", async () => {
        const fileUploadId = await uploadFileToNotion(jpegBuffer, uploadFilename);
        return { fileUploadId };
      }),
    {
      name: "upload_cover_to_notion",
      description: "将封面图片上传到 Notion 文件存储，返回上传 ID",
      schema: z.object({
        filename: z.string().describe("文件名（如 cover.jpg）"),
      }),
    },
  );

  const bookInfoSchema = z.object({
    title: z.string(),
    subtitle: z.string().nullable().optional(),
    author: z.string(),
    gender: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    genres: z.array(z.string()),
    description: z.string(),
    quotes: z.array(z.string()).optional().describe("2-3句优美语句"),
  });

  const createNotionPage = tool(
    async ({
      bookInfo,
      fileUploadId,
      filename: pageFilename,
    }: {
      bookInfo: z.infer<typeof bookInfoSchema>;
      fileUploadId?: string | null;
      filename: string;
    }) =>
      withLogging("create_notion_page", async () => {
        // zod 推导出的类型跟 BookInfo 结构一致，做一次归一化（optional字段补null/[]）
        const normalized: BookInfo = {
          title: bookInfo.title,
          subtitle: bookInfo.subtitle ?? null,
          author: bookInfo.author,
          gender: bookInfo.gender ?? null,
          country: (bookInfo.country ?? null) as BookInfo["country"],
          genres: bookInfo.genres as BookInfo["genres"],
          description: bookInfo.description,
          quotes: bookInfo.quotes ?? [],
        };
        const { pageUrl } = await createBookPage(normalized, fileUploadId ?? null, pageFilename);
        result.pageUrl = pageUrl;
        result.bookInfo = normalized;
        return { pageUrl };
      }),
    {
      name: "create_notion_page",
      description: "在 Notion 数据库中创建书籍记录，完成入库",
      schema: z.object({
        bookInfo: bookInfoSchema.describe("书籍信息"),
        fileUploadId: z.string().nullable().optional().describe("upload_cover_to_notion 返回的 ID"),
        filename: z.string().describe("原始文件名"),
      }),
    },
  );

  const model = new ChatAnthropic({
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // createReactAgent 就是替换掉原来那个手写 while(true) 循环的地方：
  // "模型要调工具→执行→把结果喂回去→再问模型→直到模型说完成" 这套状态机
  // 由 LangGraph 内部维护，不用再手动拼 messages 数组、手动判断 stop_reason
  const agent = createReactAgent({
    llm: model,
    tools: [recognizeBookFromImage, checkDuplicateInNotion, uploadCoverToNotion, createNotionPage],
    prompt: SYSTEM_PROMPT,
  });

  await agent.invoke(
    {
      messages: [
        new HumanMessage({
          content: [
            { type: "image", data: base64, mimeType: "image/jpeg" },
            { type: "text", text: `请处理这张书封面图片，完成入库流程。原始文件名：${filename}` },
          ],
        }),
      ],
    },
    // 原来手写版没有循环上限保护——LangGraph 默认给了一个（25），这里显式设小一点，
    // 这个流程正常只需要4-5轮，设15足够，同时避免模型异常卡死循环导致费用失控
    { recursionLimit: 15 },
  );

  // 业务结果全程通过工具闭包写入 result，不需要从最终消息里解析
  return result;
}
