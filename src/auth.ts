// NextAuth v5 配置文件，行业惯例放在 src/auth.ts
// 导出 handlers（给 route.ts 用）、auth（服务端验证 session）、signIn / signOut（触发登录登出）
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

// 邮箱白名单从环境变量读取，逗号分隔
// 例：AUTH_ALLOWED_EMAILS=a@gmail.com,b@gmail.com
// 不写死在代码里——代码会推到 GitHub，环境变量不会
const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,

    // Demo 账号：DEMO_ENABLED=true 时开启，面试官可免 Google OAuth 直接体验
    // 不需要密码——通过环境变量控制开关，关闭时 authorize 返回 null 即拒绝
    Credentials({
      credentials: {},
      async authorize() {
        if (process.env.DEMO_ENABLED !== "true") return null;
        return { id: "demo", name: "Demo User", email: "demo@lovely-shelf.com" };
      },
    }),
  ],
  callbacks: {
    // authorized callback：proxy 层面的检查，决定这个请求能不能通过
    // auth 参数是当前 session（未登录时为 null）
    // 返回 false → proxy 自动跳到 pages.signIn；返回 true → 请求继续
    async authorized({ auth }) {
      return !!auth?.user;
    },
    // signIn callback：OAuth 登录完成后，决定这个账号能不能进来
    async signIn({ user, account }) {
      // Demo 账号（Credentials provider）直接放行，不走邮箱白名单
      if (account?.provider === "credentials") return true;
      // Google 账号检查白名单
      return !!user.email && ALLOWED_EMAILS.includes(user.email);
    },
  },
  pages: {
    // 未登录时跳到这个自定义登录页，而不是 NextAuth 默认的难看页面
    signIn: "/login",
  },
});
