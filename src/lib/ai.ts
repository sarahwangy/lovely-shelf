import Anthropic from "@anthropic-ai/sdk";
import type { BookInfo } from "@/types/book";

export type { BookInfo };

// 只初始化一次客户端，行业惯例：避免每次调用都重新建连接
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// system prompt：告诉 Claude 它的角色和输出规则
const SYSTEM_PROMPT = `你是一个专业的图书信息识别助手。
用户会发给你一张书籍封面图片，你需要从封面中提取信息。

请严格按以下 JSON 格式返回，不要输出任何其他文字：
{
  "title": "书名主标题",
  "subtitle": "副标题或null",
  "author": "作者名，多作者用 & 分隔",
  "gender": "作者性别或null",
  "country": "作者国籍或null",
  "genres": ["类型1", "类型2"],
  "description": "一句话描述这本书的主题"
}

类型标签从以下选择（可多选）：
回忆录、传记、喜剧、冒险、心理相关、励志、身心健康、育儿、科普、园艺、体育、历史、儿童读物、旅行、其他`;

export async function recognizeBook(base64Image: string): Promise<BookInfo> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image,
            },
          },
          {
            type: "text",
            text: "请识别这本书的封面信息，按指定 JSON 格式返回。",
          },
        ],
      },
    ],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Claude 有时会在 JSON 外面包一层 ```json ... ```，这里把它剥掉
  const jsonText = rawText
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(jsonText) as BookInfo;
  } catch {
    throw new Error(`Claude 返回了无法解析的内容：${rawText}`);
  }
}
