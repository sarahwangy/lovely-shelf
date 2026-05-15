// NextAuth 的 catch-all 路由，处理所有 /api/auth/* 的请求
// 包括：Google 登录跳转、OAuth callback、登出、session 查询
// handlers 已经包含了 GET 和 POST，直接导出给 Next.js 用
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
