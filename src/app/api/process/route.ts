import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { preprocessImage } from "@/lib/image";
import { recognizeBook } from "@/lib/ai";
import { uploadFileToNotion, createBookPage, findDuplicateBook, countBooksByGenre, listBooksByGenre } from "@/lib/notion";
import { getDemoBooksForGenre } from "@/lib/demo-data";
import { checkRateLimit } from "@/lib/rate-limit";
import type { BookSummary } from "@/types/book";
import type { BookInfo } from "@/types/book";

// 结构化日志：[时间戳] [process] 步骤 状态 耗时ms
// 行业惯例：每条日志带时间戳和步骤名，Vercel 后台可按关键字过滤
function log(step: string, status: "ok" | "err" | "skip", ms: number, extra?: string) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] [process] ${step} ${status} ${ms}ms${extra ? ` | ${extra}` : ""}`;
  if (status === "err") console.error(msg);
  else console.log(msg);
}

// Next.js App Router 的 Route Handler：
// 文件名必须叫 route.ts，导出的函数名对应 HTTP 方法（POST/GET/PUT 等）
// Next.js 自动把 src/app/api/process/route.ts 变成 /api/process 这个 URL
export async function POST(request: NextRequest) {
  // 在处理任何业务逻辑之前，先验证登录态
  // auth() 读取 session cookie，未登录时 session 为 null
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  const isDemo = session.user.email === "demo@lovely-shelf.com";
  const uploadLimit = isDemo ? 10 : 20;
  const rl = checkRateLimit(session.user.email!, "upload", uploadLimit);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: `今日上传次数已达上限（${uploadLimit}次），请明天再试` },
      { status: 429 }
    );
  }

  const reqStart = Date.now();
  let filename = "(unknown)";

  try {
    // request.formData() 是 Web 标准 API，Next.js 自动解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      log("validate", "err", Date.now() - reqStart, "no image field");
      return NextResponse.json(
        { success: false, error: "没有收到图片，请上传 image 字段" },
        { status: 400 }
      );
    }

    filename = file.name;

    // File → ArrayBuffer → Buffer，Next.js 里拿到的是 Web File 对象，要转成 Node Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 第一步：图片预处理
    let t = Date.now();
    const { jpegBuffer, base64 } = await preprocessImage(buffer);
    log("preprocess", "ok", Date.now() - t, filename);

    // 第二步：Claude 识别
    let bookInfo: BookInfo;
    t = Date.now();
    try {
      bookInfo = await recognizeBook(base64);
      log("recognize", "ok", Date.now() - t, bookInfo.title);
    } catch (err) {
      // 识别失败单独处理，给前端明确提示
      log("recognize", "err", Date.now() - t, (err as Error).message);
      return NextResponse.json(
        { success: false, error: `AI 识别失败：${(err as Error).message}` },
        { status: 422 }
      );
    }

    // Demo 模式：AI 识别完就返回，不碰 Notion 任何数据
    if (isDemo) {
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

    // 第三步：查重（识别完就查，写入前）
    t = Date.now();
    const existingUrl = await findDuplicateBook(bookInfo.title, bookInfo.author);
    if (existingUrl) {
      // 已存在：跳过写入，告诉前端"重复"
      log("duplicate", "skip", Date.now() - t, bookInfo.title);
      log("total", "skip", Date.now() - reqStart);
      return NextResponse.json({
        success: true,
        isDuplicate: true,
        bookInfo,
        pageUrl: existingUrl,
      });
    }
    log("duplicate", "ok", Date.now() - t, "no match");

    // 第四步：上传封面到 Notion
    t = Date.now();
    const fileUploadId = await uploadFileToNotion(jpegBuffer, filename);
    log("upload", "ok", Date.now() - t);

    // 第五步：写入 Notion 数据库
    t = Date.now();
    const { pageUrl } = await createBookPage(bookInfo, fileUploadId, filename);
    log("notion-write", "ok", Date.now() - t, pageUrl);

    // 第六步：统计同类书数量 + 查推荐（入库之后再查，新书已包含在内）
    t = Date.now();
    let stats: { primaryGenre: string; countInGenre: number } | null = null;
    let recommendations: BookSummary[] = [];
    if (bookInfo.genres.length > 0) {
      const primaryGenre = bookInfo.genres[0];
      // 两个查询并发跑，互不依赖，用 Promise.all 节省时间
      const [countInGenre, recs] = await Promise.all([
        countBooksByGenre(primaryGenre),
        listBooksByGenre(primaryGenre, pageUrl, 5),
      ]);
      stats = { primaryGenre, countInGenre };
      recommendations = recs;
      log("count-genre", "ok", Date.now() - t, `${primaryGenre}: ${countInGenre}本, 推荐${recs.length}本`);
    }

    // 成功：返回识别结果 + Notion 链接 + 同类书统计 + 推荐书列表
    log("total", "ok", Date.now() - reqStart);
    return NextResponse.json({
      success: true,
      isDuplicate: false,
      bookInfo,
      pageUrl,
      stats,
      recommendations,
    });

  } catch (err) {
    // 兜底错误处理：网络失败、Notion API 失败等
    log("total", "err", Date.now() - reqStart, (err as Error).message);
    console.error("[/api/process]", err);
    return NextResponse.json(
      { success: false, error: `服务器错误：${(err as Error).message}` },
      { status: 500 }
    );
  }
}
