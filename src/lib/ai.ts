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

请严格按以下 JSON 格式返回，不要输出任何其他文字，不要加代码块标记：
{
  "title": "书名主标题",
  "subtitle": "副标题或null",
  "author": "作者名，多作者用 & 分隔",
  "gender": "男 或 女 或 null",
  "country": "只能从以下选项选一个，或填 null：澳大利亚、英国、美国、新西兰、南非、加拿大、中国、日本",
  "genres": ["类型1", "类型2"],
  "description": "一句话描述这本书的主题"
}

重要规则：
1. 所有字符串值内部不能出现英文双引号 "，书名、人名等专有名词改用单引号 ' 或直接不加引号
2. 不要在 JSON 外面加任何文字或代码块（不要输出 \`\`\`json）

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

  // 用贪婪匹配直接抓 { ... } 块，比正则替换代码块标记更可靠
  // 能处理：纯 JSON、```json\n{...}\n```、前后有多余文字等所有情况
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude 没有返回 JSON 格式：${rawText}`);
  }

  try {
    return JSON.parse(jsonMatch[0]) as BookInfo;
  } catch {
    throw new Error(`Claude 返回了无法解析的内容：${rawText}`);
  }
}
