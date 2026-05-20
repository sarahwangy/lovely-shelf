import type Anthropic from "@anthropic-ai/sdk";
import type { BookInfo } from "@/types/book";
import { anthropic as client } from "@/lib/anthropic";
import { BOOK_TOOLS, executeBookTool } from "@/lib/book-tools";

// System prompt：明确告诉 Agent 做什么、顺序是什么
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
  const result: AgentResult = {
    bookInfo:     null,
    pageUrl:      null,
    isDuplicate:  false,
    duplicateUrl: null,
  };

  // messages 数组是 Agent 的"对话历史"：每轮都把历史带上，Claude 才知道上下文
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
        { type: "text", text: `请处理这张书封面图片，完成入库流程。原始文件名：${filename}` },
      ],
    },
  ];

  let step = 0;

  // Agent 循环：stop_reason === "tool_use" 时继续，"end_turn" 时退出
  while (true) {
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      tools:      BOOK_TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") break;

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      step++;
      const t = Date.now();
      let content: string;

      try {
        const output = await executeBookTool(
          block.name,
          block.input as Record<string, unknown>,
          { base64, jpegBuffer, filename },
        );

        // agent.ts 特有：把关键结果同步到 AgentResult，供 route 层读取
        if (block.name === "recognize_book_from_image") {
          result.bookInfo = output as BookInfo;
        } else if (block.name === "check_duplicate_in_notion") {
          const { exists, url } = output as { exists: boolean; url: string | null };
          result.isDuplicate  = exists;
          result.duplicateUrl = url;
        } else if (block.name === "create_notion_page") {
          result.pageUrl  = (output as { pageUrl: string }).pageUrl;
        }

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
