import { NOTION_TOKEN, notionHeaders } from "./client";

// 把图片 Buffer 上传到 Notion，返回 file_upload_id
// Notion SDK 还没有 TypeScript 类型支持文件上传，所以用 fetch 直接调 REST API
export async function uploadFileToNotion(
  buffer: Buffer,
  filename: string
): Promise<string> {
  // 第一步：告诉 Notion "我要上传一个文件"，拿到上传地址
  const createRes = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: notionHeaders,
    body: JSON.stringify({ filename, content_type: "image/jpeg" }),
  });

  if (!createRes.ok) {
    throw new Error(`创建上传任务失败：${await createRes.text()}`);
  }

  const { id, upload_url } = (await createRes.json()) as {
    id: string;
    upload_url: string;
  };

  // 第二步：用 multipart/form-data 把图片发到 Notion 的 /send 端点
  // 注意：不要手动设 Content-Type，fetch 会自动加 multipart boundary
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }),
    filename
  );

  const uploadRes = await fetch(upload_url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`上传图片失败：${await uploadRes.text()}`);
  }

  return id;
}
