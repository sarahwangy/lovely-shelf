import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new Anthropic();

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  // demo 用户返回固定语录，不消耗 AI 配额
  if (session.user.email === "demo@lovely-shelf.com") {
    return NextResponse.json({
      zh: "慢下来，感受此刻的美好。",
      en: "Slow down and feel the beauty of this moment.",
    });
  }

  const rl = checkRateLimit(session.user.email!, "daily-quote", 10);
  if (!rl.allowed) {
    return NextResponse.json({ error: "今日语录生成次数已达上限" }, { status: 429 });
  }

  // 每次随机抽一个风格，让 Claude 定向生成，避免总出同类句子
  const STYLES = [
    "爱自己·自我接纳",
    "爱自己·放下完美主义",
    "爱自己·身体与休息",
    "爱自己·设立边界",
    "爱自己·情绪允许",
    "成长·慢慢来",
    "成长·从失败中学习",
    "阅读与书籍",
    "勇气与行动",
    "平静与当下",
    "善意与连接",
    "自然与季节",
    "创意与好奇心",
    "坚韧与复原力",
    "轻盈·幽默看待生活",
  ];
  const style = STYLES[Math.floor(Math.random() * STYLES.length)];

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `生成一条风格为「${style}」的原创正能量语录。
要求：
- 返回纯 JSON，格式：{"zh": "中文语录", "en": "English quote"}
- 中英文表达同一个核心思想，自然改写，不逐字翻译
- 每条不超过 25 个字（中文）/ 20 个单词（英文）
- 语气温柔、真实，有诗意，避免陈词滥调和说教感
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
