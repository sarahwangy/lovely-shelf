import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST { quotes: string[] } → { translations: string[] }
// 一次 API call 翻译一批中文语录，返回顺序与输入一致
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { quotes } = (await request.json()) as { quotes: string[] };
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return NextResponse.json({ translations: [] });
  }

  const numbered = quotes.map((q, i) => `${i + 1}. ${q}`).join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // 翻译任务用 Haiku，快且省 token
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `将以下中文语录翻译成英文。只返回翻译结果，保持编号，每行一条，不要加任何解释：\n\n${numbered}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  // 解析 "1. xxx\n2. xxx" 格式，去掉编号，顺序对应原始输入
  const translations = raw
    .split("\n")
    .filter((line) => /^\d+\./.test(line.trim()))
    .map((line) => line.replace(/^\d+\.\s*/, "").trim());

  // 如果解析数量对不上，用空字符串补齐，保证下标一致
  while (translations.length < quotes.length) translations.push("");

  return NextResponse.json({ translations });
}
