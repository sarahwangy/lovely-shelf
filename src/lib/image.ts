import sharp from "sharp";
import { statSync } from "fs";

export type ProcessedImage = {
  jpegBuffer: Buffer;   // 处理后的图片二进制数据
  base64: string;       // base64 字符串，给 Claude API 用
  mimeType: "image/jpeg";
  originalSize: number; // 原始文件大小（字节）
  processedSize: number;// 处理后大小（字节）
};

// 接受文件路径（string）或已读入内存的 Buffer，都能处理
export async function preprocessImage(
  input: Buffer | string
): Promise<ProcessedImage> {
  // 如果传的是文件路径，用 statSync 读文件大小；Buffer 直接取 .length
  const originalSize =
    typeof input === "string" ? statSync(input).size : input.length;

  // sharp 是行业标准图片处理库，这三步是固定套路：
  // 1. resize  - 限制最大宽度 1600px，高度自动等比缩放；withoutEnlargement 防止小图被放大
  // 2. jpeg    - 转成 JPEG 格式，quality 85 是清晰度和文件大小的常用平衡点
  // 3. toBuffer- 输出到内存（不写磁盘），Vercel 函数里不能乱写磁盘
  const jpegBuffer = await sharp(input)
    .resize(1600, undefined, { withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    jpegBuffer,
    base64: jpegBuffer.toString("base64"), // Buffer → base64 字符串，Node.js 内置方法
    mimeType: "image/jpeg",
    originalSize,
    processedSize: jpegBuffer.length,
  };
}
