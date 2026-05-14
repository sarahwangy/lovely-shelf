import { NextResponse } from "next/server";

// /api/health：给 Vercel / 监控工具用的健康检查接口
// 行业惯例：部署平台定期 GET 这个接口，200 = 服务正常，非 200 = 触发告警
// 检查项：环境变量是否齐全（缺少任何一个，服务一定会出错）
export async function GET() {
  const missing = (["ANTHROPIC_API_KEY", "NOTION_TOKEN", "NOTION_DATABASE_ID"] as const)
    .filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return NextResponse.json(
      { status: "error", missing },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
