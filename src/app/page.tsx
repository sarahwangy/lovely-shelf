import { redirect } from "next/navigation";

// 根路由重定向到 /upload
export default function RootPage() {
  redirect("/upload");
}
