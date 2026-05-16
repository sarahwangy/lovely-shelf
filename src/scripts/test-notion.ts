import { createBookPage } from "@/lib/notion";
import type { BookInfo } from "@/types/book";

// 造一份假数据，不调用 Claude，直接测 Notion 写入
const fakeBook: BookInfo = {
  title: "测试书名",
  subtitle: "这是副标题",
  author: "测试作者",
  gender: "女",
  country: "英国",
  genres: ["科普", "心理相关"],
  description: "这是一本用来测试 Notion 写入功能的假书。",
  quotes: ["知识是人类进步的阶梯。", "科学的尽头是哲学。"],
};

async function main() {
  console.log("⏳ 写入 Notion（不上传封面）...\n");

  const { pageId, pageUrl } = await createBookPage(
    fakeBook,
    null,             // 不上传封面图
    "test-fake.jpg"
  );

  console.log(`✅ 写入成功！`);
  console.log(`Page ID：${pageId}`);
  console.log(`Notion URL：${pageUrl}`);
}

main().catch((err) => {
  console.error("❌ 出错了：", err.message);
  process.exit(1);
});
