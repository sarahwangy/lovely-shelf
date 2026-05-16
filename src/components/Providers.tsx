"use client";

// SessionProvider 必须在 client 组件里使用（它依赖 React context）
// 把它包在这里，layout.tsx（server component）就可以 import 并套在 children 外面
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
