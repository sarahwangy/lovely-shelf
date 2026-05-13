import { preprocessImage } from "@/lib/image";
import { recognizeBook } from "@/lib/ai";
import path from "path";

// 默认用之前那张测试图，也可以命令行传参：npx tsx ... ./public/xxx.jpg
const TEST_IMAGE = path.resolve(process.argv[2] ?? "./public/12_Being-You.jpg");

async function main() {
  console.log(`📖 识别图片：${path.basename(TEST_IMAGE)}\n`);

  // 第一步：预处理（复用 T05 的函数）
  console.log("⏳ 预处理图片...");
  const { base64 } = await preprocessImage(TEST_IMAGE);

  // 第二步：调用 Claude API 识别
  console.log("⏳ 调用 Claude API...\n");
  const start = Date.now();
  const bookInfo = await recognizeBook(base64);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`✅ 识别完成（耗时 ${elapsed}s）\n`);
  console.log(JSON.stringify(bookInfo, null, 2));
}

main().catch((err) => {
  console.error("❌ 出错了：", err.message);
  process.exit(1);
});
