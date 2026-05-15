// Next.js 16 把 middleware.ts 改名为 proxy.ts（功能完全一样）
// auth 作为 proxy 运行时：未登录的请求自动跳到 pages.signIn 配置的路径（/login）
export { auth as proxy } from "@/auth";

export const config = {
  // matcher 决定哪些路径触发这个 proxy
  // 负向前瞻（?!...）：以下路径不需要登录即可访问
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|api/health).*)",
    //       NextAuth回调  登录页  静态资源         图片优化      图标       健康检查（公开）
  ],
};
