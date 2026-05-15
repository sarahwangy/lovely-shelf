// NextAuth v5 配置文件，行业惯例放在 src/auth.ts
// 导出 handlers（给 route.ts 用）、auth（服务端验证 session）、signIn / signOut（触发登录登出）
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// 邮箱白名单从环境变量读取，逗号分隔
// 例：AUTH_ALLOWED_EMAILS=a@gmail.com,b@gmail.com
// 不写死在代码里——代码会推到 GitHub，环境变量不会
const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Google provider 自动读取 AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET 环境变量（NextAuth v5 命名规范）

    Google,
  ],
  callbacks: {
    // authorized callback：proxy 层面的检查，决定这个请求能不能通过
    // auth 参数是当前 session（未登录时为 null）
    // 返回 false → proxy 自动跳到 pages.signIn；返回 true → 请求继续
    async authorized({ auth }) {
      return !!auth?.user;
    },
    // signIn callback：OAuth 登录完成后，决定这个账号能不能进来
    // 返回 true = 允许登录，返回 false = 拒绝（NextAuth 显示 "Access denied"）
    async signIn({ user }) {
      return !!user.email && ALLOWED_EMAILS.includes(user.email);
    },
  },
  pages: {
    // 未登录时跳到这个自定义登录页，而不是 NextAuth 默认的难看页面
    signIn: "/login",
  },
});
