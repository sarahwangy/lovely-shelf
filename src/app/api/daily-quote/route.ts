import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const msg = await client.messages.create({
    // Haiku：速度快、费用低，适合轻量生成任务
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `生成一条原创正能量语录。
要求：
- 返回纯 JSON，格式：{"zh": "中文语录", "en": "English quote"}
- 中英文表达同一个核心思想，但可自然改写，不要逐字翻译
- 每条不超过 25 个字（中文）/ 20 个单词（英文）
- 主题自由发挥：阅读、成长、勇气、善意、自然、创意、坚韧、智慧、生活、书籍…
- 有诗意，避免陈词滥调
- 只输出 JSON，不要任何其他文字`,
      },
    ],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  // Claude 偶尔会在 JSON 外加 markdown 代码块，去掉它
  const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();

  try {
    const quote = JSON.parse(cleaned) as { zh: string; en: string };
    if (!quote.zh || !quote.en) throw new Error("字段缺失");
    return NextResponse.json(quote);
  } catch {
    console.error("[daily-quote] 解析失败：", raw);
    return NextResponse.json({ error: "生成失败，请重试" }, { status: 500 });
  }
}
