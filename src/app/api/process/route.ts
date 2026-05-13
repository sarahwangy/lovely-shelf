import { NextRequest, NextResponse } from "next/server";
import { preprocessImage } from "@/lib/image";
import { recognizeBook } from "@/lib/ai";
import { uploadFileToNotion, createBookPage } from "@/lib/notion";
import type { BookInfo } from "@/types/book";

// Next.js App Router 的 Route Handler：
// 文件名必须叫 route.ts，导出的函数名对应 HTTP 方法（POST/GET/PUT 等）
// Next.js 自动把 src/app/api/process/route.ts 变成 /api/process 这个 URL
export async function POST(request: NextRequest) {
  try {
    // request.formData() 是 Web 标准 API，Next.js 自动解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "没有收到图片，请上传 image 字段" },
        { status: 400 }
      );
    }

    const filename = file.name;

    // File → ArrayBuffer → Buffer，Next.js 里拿到的是 Web File 对象，要转成 Node Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 第一步：图片预处理
    const { jpegBuffer, base64 } = await preprocessImage(buffer);

    // 第二步：Claude 识别
    let bookInfo: BookInfo;
    try {
      bookInfo = await recognizeBook(base64);
    } catch (err) {
      // 识别失败单独处理，给前端明确提示
      return NextResponse.json(
        { success: false, error: `AI 识别失败：${(err as Error).message}` },
        { status: 422 }
      );
    }

    // 第三步：上传封面到 Notion
    const fileUploadId = await uploadFileToNotion(jpegBuffer, filename);

    // 第四步：写入 Notion 数据库
    const { pageUrl } = await createBookPage(bookInfo, fileUploadId, filename);

    // 成功：返回识别结果 + Notion 链接
    return NextResponse.json({
      success: true,
      bookInfo,
      pageUrl,
    });
  } catch (err) {
    // 兜底错误处理：网络失败、Notion API 失败等
    console.error("[/api/process]", err);
    return NextResponse.json(
      { success: false, error: `服务器错误：${(err as Error).message}` },
      { status: 500 }
    );
  }
}
