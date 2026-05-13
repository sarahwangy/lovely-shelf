import Anthropic from "@anthropic-ai/sdk";

// BookInfo 是这个项目的核心数据结构，贯穿整条链路
export type BookInfo = {
  title: string;           // 书名（主标）
  subtitle: string | null; // 副标题，识别不出时为 null
  author: string;          // 作者，多人用 " & " 分隔
  gender: string | null;   // 作者性别，识别不出时为 null
  country: string | null;  // 作者国籍，识别不出时为 null
  genre: string[];         // 类型标签数组，如 ["心理", "励志"]
  description: string;     // 一句话内容描述
};

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
  "genre": ["类型1", "类型2"],
  "description": "一句话描述这本书的主题"
}

类型标签从以下选择（可多选）：
小说、非虚构、回忆录、心理、励志、儿童、科普、历史、哲学、商业、传记、艺术`;

export async function recognizeBook(base64Image: string): Promise<BookInfo> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6", // 视觉识别能力强，中文支持好
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
              data: base64Image, // 把图片以 base64 字符串形式发给 Claude
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

  // response.content[0] 是 Claude 返回的文字块
  const rawText = response.content[0].type === "text" ? response.content[0].text : "";

  // Claude 有时会在 JSON 外面包一层 ```json ... ```，这里把它剥掉
  const jsonText = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const parsed = JSON.parse(jsonText) as BookInfo;
    return parsed;
  } catch {
    // JSON 解析失败时，抛出带原始内容的错误，方便调试
    throw new Error(`Claude 返回了无法解析的内容：${rawText}`);
  }
}
