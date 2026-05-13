import path from "path";
import { preprocessImage } from "@/lib/image";
import { recognizeBook } from "@/lib/ai";
import { uploadFileToNotion, createBookPage } from "@/lib/notion";

// 从命令行参数读取图片路径，例：npx tsx ... ./public/12_Being-You.jpg
const imagePath = process.argv[2];
if (!imagePath) {
  console.error("用法：npx tsx --env-file=.env.local src/scripts/end-to-end.ts <图片路径>");
  process.exit(1);
}

// 计时工具：记录每步开始时间，结束时打印耗时
function timer(label: string) {
  const start = Date.now();
  return () => console.log(`  ✓ ${label}（${((Date.now() - start) / 1000).toFixed(1)}s）`);
}

async function main() {
  const fullPath = path.resolve(imagePath);
  const filename = path.basename(fullPath);
  console.log(`\n📖 开始处理：${filename}\n`);

  // 第一步：图片预处理（sharp 缩放 + 转 JPEG）
  console.log("1️⃣  预处理图片...");
  const done1 = timer("预处理完成");
  const { jpegBuffer, base64 } = await preprocessImage(fullPath);
  done1();
  console.log(`   处理后大小：${(jpegBuffer.length / 1024).toFixed(1)} KB\n`);

  // 第二步：Claude API 识别书封面
  console.log("2️⃣  Claude 识别中...");
  const done2 = timer("识别完成");
  const bookInfo = await recognizeBook(base64);
  done2();
  console.log(`   书名：${bookInfo.title}`);
  console.log(`   作者：${bookInfo.author}`);
  console.log(`   类型：${bookInfo.genres.join("、")}\n`);

  // 第三步：上传封面图到 Notion
  console.log("3️⃣  上传封面到 Notion...");
  const done3 = timer("上传完成");
  const fileUploadId = await uploadFileToNotion(jpegBuffer, filename);
  done3();
  console.log(`   file_upload_id：${fileUploadId}\n`);

  // 第四步：在 Notion 数据库创建一行
  console.log("4️⃣  写入 Notion 数据库...");
  const done4 = timer("写入完成");
  const { pageUrl } = await createBookPage(bookInfo, fileUploadId, filename);
  done4();

  console.log(`\n🎉 完成！`);
  console.log(`Notion 页面：${pageUrl}\n`);
}

main().catch((err) => {
  console.error("\n❌ 出错：", err.message);
  process.exit(1);
});
