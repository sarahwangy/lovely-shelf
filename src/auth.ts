import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,

    // Demo 账号：无需 Google OAuth，点"一键体验"直接进入，展示种子假数据
    // 通过 email === "demo@lovely-shelf.com" 识别 demo 用户，API 路由返回假数据
    Credentials({
      credentials: {},
      async authorize() {
        return { id: "demo", name: "Demo User", email: "demo@lovely-shelf.com" };
      },
    }),
  ],
  callbacks: {
    async authorized({ auth }) {
      return !!auth?.user;
    },
    async signIn({ user, account }) {
      // Demo 账号（Credentials provider）直接放行
      if (account?.provider === "credentials") return true;
      // Google 账号走邮箱白名单
      return !!user.email && ALLOWED_EMAILS.includes(user.email);
    },
  },
  pages: {
    signIn: "/login",
  },
});
