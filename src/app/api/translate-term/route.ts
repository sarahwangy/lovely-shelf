import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { anthropic as client } from "@/lib/anthropic";

// POST { terms: string[] } → { translations: Record<string, string> }
// 把静态表里没有的中文词（类型、国家）翻译成英文
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { terms } = (await request.json()) as { terms: string[] };
  if (!Array.isArray(terms) || terms.length === 0) {
    return NextResponse.json({ translations: {} });
  }

  const numbered = terms.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `将以下中文词语翻译成英文（书籍分类或国家名）。只返回翻译结果，保持编号，每行一条，不要解释：\n\n${numbered}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  const translations: Record<string, string> = {};
  raw
    .split("\n")
    .filter((line) => /^\d+\./.test(line.trim()))
    .forEach((line, i) => {
      const en = line.replace(/^\d+\.\s*/, "").trim();
      if (en && terms[i]) translations[terms[i]] = en;
    });

  return NextResponse.json({ translations });
}
