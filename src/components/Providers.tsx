"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

// 接收服务端已拿到的 session 并注入 SessionProvider
// 这样客户端第一次渲染就能直接拿到 session，不会有"loading"空档期
export default function Providers({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
