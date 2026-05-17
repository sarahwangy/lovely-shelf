import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { preprocessImage } from "@/lib/image";
import { runBookAgent } from "@/lib/agent";
import { countBooksByGenre, listBooksByGenre } from "@/lib/notion";
import { getDemoBooksForGenre } from "@/lib/demo-data";
import { recognizeBook } from "@/lib/ai";
import type { BookSummary } from "@/types/book";

function log(step: string, status: "ok" | "err", ms: number, extra?: string) {
  const ts  = new Date().toISOString();
  const msg = `[${ts}] [agent-route] ${step} ${status} ${ms}ms${extra ? ` | ${extra}` : ""}`;
  if (status === "err") console.error(msg); else console.log(msg);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  const reqStart = Date.now();

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "没有收到图片" }, { status: 400 });
    }

    const filename = file.name;
    const buffer   = Buffer.from(await file.arrayBuffer());

    // 图片预处理不交给 Agent 决策——属于基础设施，直接做
    let t = Date.now();
    const { jpegBuffer, base64 } = await preprocessImage(buffer);
    log("preprocess", "ok", Date.now() - t, filename);

    // Demo 模式：AI 识别真实书封面，但跳过所有 Notion 操作
    if (session.user.email === "demo@lovely-shelf.com") {
      t = Date.now();
      const bookInfo = await recognizeBook(base64);
      log("recognize", "ok", Date.now() - t, bookInfo.title);
      const primaryGenre = bookInfo.genres[0] ?? "小说";
      log("total", "ok", Date.now() - reqStart, "demo shortcut");
      return NextResponse.json({
        success: true,
        isDuplicate: false,
        bookInfo,
        pageUrl: "#",
        stats: { primaryGenre, countInGenre: 14 },
        recommendations: getDemoBooksForGenre(primaryGenre).slice(0, 5),
      });
    }

    // 启动 Agent：内部会自动跑完整个工具调用循环
    t = Date.now();
    const agentResult = await runBookAgent(base64, jpegBuffer, filename);
    log("agent", "ok", Date.now() - t);

    // 入库成功后追加同类书统计（和旧流程保持一致，前端复用同一套数据结构）
    let stats: { primaryGenre: string; countInGenre: number } | null = null;
    let recommendations: BookSummary[] = [];

    if (!agentResult.isDuplicate && agentResult.pageUrl && agentResult.bookInfo?.genres?.length) {
      const primaryGenre = agentResult.bookInfo.genres[0];
      t = Date.now();
      const [countInGenre, recs] = await Promise.all([
        countBooksByGenre(primaryGenre),
        listBooksByGenre(primaryGenre, agentResult.pageUrl, 5),
      ]);
      stats        = { primaryGenre, countInGenre };
      recommendations = recs;
      log("count-genre", "ok", Date.now() - t, `${primaryGenre}: ${countInGenre}本`);
    }

    log("total", "ok", Date.now() - reqStart);

    // 返回格式和 /api/process 完全一致，前端可以无缝切换
    return NextResponse.json({
      success:     true,
      isDuplicate: agentResult.isDuplicate,
      bookInfo:    agentResult.bookInfo,
      pageUrl:     agentResult.isDuplicate ? agentResult.duplicateUrl : agentResult.pageUrl,
      stats,
      recommendations,
    });

  } catch (err) {
    log("total", "err", Date.now() - reqStart, (err as Error).message);
    console.error("[/api/agent]", err);
    return NextResponse.json(
      { success: false, error: `Agent 错误：${(err as Error).message}` },
      { status: 500 },
    );
  }
}
