import { preprocessImage } from "@/lib/image";
import path from "path";

// 把这里改成你本地任意一张书封面图片的路径
const TEST_IMAGE = path.resolve(process.argv[2] ?? "./public/test.jpg");

async function main() {
  console.log(`测试图片：${TEST_IMAGE}`);

  const result = await preprocessImage(TEST_IMAGE);

  const ratio = ((1 - result.processedSize / result.originalSize) * 100).toFixed(1);
  console.log(`原始大小：${(result.originalSize / 1024).toFixed(1)} KB`);
  console.log(`处理后大小：${(result.processedSize / 1024).toFixed(1)} KB`);
  console.log(`压缩率：${ratio}%`);
  console.log(`base64 长度：${result.base64.length} 字符`);
  console.log("✅ 预处理成功");
}

main().catch((err) => {
  console.error("❌ 出错了：", err.message);
  process.exit(1);
});
