import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Notion 单个 rich_text 内容上限 2000 字符；留 100 字余量
const MAX_CHUNK = 1900;

// 把长文本切成多个 block（首块用 callout，后续用 paragraph）
function buildBlocks(text: string) {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_CHUNK) {
    return [
      {
        type: "callout" as const,
        callout: {
          rich_text: [{ type: "text" as const, text: { content: trimmed } }],
          icon:  { type: "emoji" as const, emoji: "🤖" as const },
          color: "gray_background" as const,
        },
      },
    ];
  }

  // 超长时：callout 标题 + 若干 paragraph 分块
  const blocks: object[] = [
    {
      type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: "🤖 AI 分析笔记" } }],
        icon:  { type: "emoji", emoji: "🤖" },
        color: "gray_background",
      },
    },
  ];
  for (let i = 0; i < trimmed.length; i += MAX_CHUNK) {
    blocks.push({
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: trimmed.slice(i, i + MAX_CHUNK) } }],
      },
    });
  }
  return blocks;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  // demo 模式静默成功，不写 Notion
  if (session.user.email === "demo@lovely-shelf.com") {
    return NextResponse.json({ ok: true });
  }

  const { text, pageId } = (await req.json()) as { text?: string; pageId?: string };
  if (!text?.trim() || !pageId) {
    return NextResponse.json({ error: "缺少 text 或 pageId" }, { status: 400 });
  }

  await notion.blocks.children.append({
    block_id: pageId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: buildBlocks(text) as any,
  });

  return NextResponse.json({ ok: true });
}
