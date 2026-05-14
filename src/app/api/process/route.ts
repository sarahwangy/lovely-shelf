import { NextRequest, NextResponse } from "next/server";
import { preprocessImage } from "@/lib/image";
import { recognizeBook } from "@/lib/ai";
import { uploadFileToNotion, createBookPage, findDuplicateBook } from "@/lib/notion";
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

    // 成功：返回识别结果 + Notion 链接
    log("total", "ok", Date.now() - reqStart);
    return NextResponse.json({
      success: true,
      isDuplicate: false,
      bookInfo,
      pageUrl,
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
