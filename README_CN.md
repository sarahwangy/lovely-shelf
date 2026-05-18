# lovely-shelf 📚

[English README →](./README.md)

> 拍一张书封面，AI 自动入库。

lovely-shelf 把书封面照片变成结构完整的 Notion 书库。上传一张图，Claude AI 自动识别书名、作者、类型、国籍和精选语录，一键写入你的 Notion 数据库，附带封面图，自动去重。

**[在线体验 →](https://lovely-shelf.vercel.app)** — 点击「一键体验 Demo」，无需注册。

---

## 工作原理

```
┌─────────────────────────────────────────────────────────────────┐
│                         上传流程                                 │
│                                                                  │
│  📸 照片     ──►  图片预处理  ──►  Claude AI  ──►  写入 Notion  │
│  (任意尺寸)       (sharp)         (视觉识别)       (自动去重)    │
│                                                                  │
│  第一步：服务端将图片缩放至 ≤1200px，转换为 JPEG               │
│                                                                  │
│  第二步：Claude 读取封面，返回结构化数据：                      │
│          { 书名, 副标题, 作者, 性别, 国籍,                      │
│            类型[], 一句话描述, 精选语录[] }                     │
│                                                                  │
│  第三步：查询 Notion —— 这本书是否已入库？                      │
│          已存在 → 返回已有记录链接（不重复创建）                │
│          未存在 → 上传封面 + 创建 Notion 页面                   │
│                                                                  │
│  第四步：统计同类书数量 → 显示成就徽章                          │
│          查找同类书 5 本 → 显示推荐横向滚动区                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 功能介绍

### 📤 上传与识别
- 拖拽或点击上传，支持同时处理多张图片
- 支持 HEIC/HEIF 格式（iPhone 原图），三级降级转换方案：
  `libheif-js（WebAssembly）→ heic2any → Canvas API`
- 重复检测：书名 + 作者完全匹配时跳过入库，直接返回已有记录链接
- 入库成功后：显示该类型书籍数量成就（「你的第 14 本小说！」）+ 同类书推荐横滑区

### 📊 洞察看板
```
┌────────────────────────────────────────┐
│  我的书库                              │
│                                        │
│   📚 共 32 本    📅 今年入库 8 本      │
│                                        │
│  类型分布                  最近入库    │
│  ┌──────────┐             ┌──┐┌──┐┌──┐│
│  │  饼图    │  小说 44%   │  ││  ││  ││
│  │(Recharts)│  心理学 25% │  ││  ││  ││
│  │          │  散文 16%   └──┘└──┘└──┘│
│  └──────────┘             [点击查看详情]│
└────────────────────────────────────────┘
```
- 总书量、今年入库量、类型占比饼图
- 30 天入库活跃热力图
- 点击书籍缩略图弹出详情浮层（实时从 Notion 拉取）

### 💬 语录库
- 展示所有书籍中 AI 提取的语录，每页 10 条分页显示
- 四个标签页：**全部** · **手写** · **书库语录** · **已收藏**
- ❤️ 收藏语录（保存在 localStorage，刷新不丢失）
- 手动添加语录，无需关联书籍，出现在「手写」标签页顶部

### 🎨 语录卡制作室
```
┌──────────────────┬───────────────────────────────┐
│  实时预览        │  样式控制                     │
│  ┌────────────┐  │                               │
│  │ 🌅 渐变背景│  │  背景：纯色 / 渐变 /          │
│  │            │  │         图片 / 动态视频        │
│  │ "真正重要  │  │  字体：大小 / 字型 / 颜色     │
│  │  的东西…"  │  │  位置：上中下 / 左中右        │
│  │            │  │  Emoji 插入到光标位置          │
│  │ — 小王子   │  │  底部波浪装饰开关              │
│  └────────────┘  │                               │
│                  │  [ 导出 PNG ]                 │
│  [216 × 320 px]  │  [ 录制 MP4 + 背景音乐 ]     │
└──────────────────┴───────────────────────────────┘
```
- Pixabay 图片 / 视频库搜索
- Jamendo 音乐搜索，录制 MP4 时混入配乐
- 浏览器语音输入（Web Speech API）
- 样式偏好按语录存入 localStorage，下次打开自动恢复

### 🤖 AI 对话助手
- Server-Sent Events 流式输出，对话流畅无延迟
- 支持在对话中上传书封面，AI 实时识别并入库
- 可查询书架、展示语录、回答关于书库的问题

### 🎪 Demo 模式
- 调用**真实 Claude AI** 识别你上传的封面，结果完全真实
- 绕过所有 Notion 操作，你的数据库不会被触碰
- 内置约 32 本种子书数据，包含封面、语录、类型统计
- 手动添加的语录当次会话内保留，刷新后重置（设计如此）

---

## 项目结构

```
src/
├── app/                              Next.js App Router 页面与接口
│   ├── layout.tsx                    根布局：Session、NavBar、Demo 横幅
│   ├── upload/page.tsx               多图上传，每张独立进度条
│   ├── result/page.tsx               上传结果：书籍卡片 + 同类推荐
│   ├── dashboard/page.tsx            数据看板
│   ├── quotes/page.tsx               语录浏览 + 卡片制作室
│   ├── login/page.tsx                Google OAuth + Demo 凭证登录
│   ├── chat/page.tsx                 SSE 流式对话界面
│   └── api/
│       ├── process/route.ts          顺序流水线（默认）
│       ├── agent/route.ts            Claude Tool Use 流水线（可选）
│       ├── stats/route.ts            看板数据接口
│       ├── quotes/route.ts           语录 CRUD
│       ├── books/route.ts            书籍分页列表
│       ├── chat/route.ts             SSE 对话 + 工具调用
│       ├── images/route.ts           Pixabay 图片搜索代理
│       ├── videos/route.ts           Pixabay 视频搜索代理
│       ├── music/route.ts            Jamendo 音乐搜索
│       └── daily-quote/route.ts      随机每日语录
│
├── lib/
│   ├── ai.ts                         recognizeBook() — Claude 视觉识别
│   ├── agent.ts                      runBookAgent() — Tool Use 循环
│   ├── notion.ts                     Notion 读写全部辅助函数
│   ├── image.ts                      preprocessImage() — sharp 流水线
│   ├── notion-fields.ts              Notion 字段名统一映射（唯一真值源）
│   └── demo-data.ts                  Demo 模式种子数据
│
├── components/
│   ├── NavBar.tsx                    底部导航（上传/语录/书库/看板）
│   ├── BookDetailModal.tsx           全屏书籍详情抽屉
│   └── DemoBanner.tsx                「Demo 模式」顶部提示条
│
└── types/
    └── book.ts                       BookInfo、BookSummary、BookDetail 类型
```

---

## 两条上传流水线

环境变量 `NEXT_PUBLIC_USE_AGENT` 控制使用哪条流水线：

```
NEXT_PUBLIC_USE_AGENT=false（默认 — 顺序执行）
══════════════════════════════════════════════

  客户端               /api/process                第三方服务
  ──────               ────────────                ──────────
  POST 图片 ─────────► preprocessImage()  ──►  sharp
                       recognizeBook()     ──►  Anthropic API
                       findDuplicateBook() ──►  Notion 查询
                       uploadFileToNotion()──►  Notion 文件上传
                       createBookPage()    ──►  Notion 创建页面
                       countBooksByGenre() ──►  Notion 统计
                       listBooksByGenre()  ──►  Notion 查询推荐
            ◄─────────  { bookInfo, pageUrl, stats, recommendations }


NEXT_PUBLIC_USE_AGENT=true（Agent 模式 — Tool Use）
═══════════════════════════════════════════════════

  客户端               /api/agent                  第三方服务
  ──────               ──────────                  ──────────
  POST 图片 ─────────► preprocessImage()  ──►  sharp
                       runBookAgent() 循环：
                       │
                       │  Claude 自主决定调用哪些工具：
                       │  ┌─ recognize_book_from_image ──► Anthropic（视觉）
                       │  ├─ check_duplicate_in_notion  ──► Notion
                       │  ├─ upload_cover_to_notion     ──► Notion
                       │  └─ create_notion_page         ──► Notion
                       │
            ◄─────────  与 /api/process 完全相同的 JSON 格式
```

两条路线返回结构完全一致，前端代码无需区分。

---

## 登录与鉴权

```
                         next-auth v5
                    ┌────────────────────┐
                    │                    │
  Google 账号 ─────►│  Google 提供商     │──► 检查 AUTH_ALLOWED_EMAILS
                    │                    │    ✓ 在白名单 → 创建 Session
                    │                    │    ✗ 不在白名单 → 跳回 /login
                    │                    │
  Demo 按钮 ────────►│ Credentials 提供商 │──► 始终成功
                    │                    │    email = demo@lovely-shelf.com
                    └────────────────────┘

每个 API 路由：
  const session = await auth()
  if (!session?.user) return 401

  if (session.user.email === "demo@lovely-shelf.com") {
    // 跳过所有 Notion 写入，返回种子数据
    // （AI 识别仍然真实运行）
  }
```

---

## Notion 数据库字段

在 Notion 中新建一个 Database，添加以下字段（字段名须与 `src/lib/notion-fields.ts` 中保持一致）：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `书名` | Title | 书籍主标题 |
| `副标题` | Rich text | 副标题 |
| `作者` | Rich text | 作者名 |
| `性别` | Select | 作者性别 |
| `国家` | Select | 作者国籍 |
| `类型 Label` | Multi-select | 书籍类型（多选） |
| `描述` | Rich text | AI 生成的一句话简介 |
| `语录` | Rich text | 2–3 句精选语录，换行分隔 |
| `封面` | Files & media | 书籍封面图片 |
| `Notion URL` | URL | 页面自链接 |
| `音乐` | URL | 可选：配乐链接（语录卡用） |
| `视频` | URL | 可选：视频链接（语录卡用） |

**固定类型列表**（Claude 只从这里选取）：

```
小说  散文  历史  哲学  心理相关  励志  政治  经济  科技  艺术  儿童读物  其他
```

---

## 本地启动

### 前置要求

- Node.js 20+
- Notion Integration，并已授权访问你的数据库
- Anthropic API Key
- Google OAuth 凭证（真实账号登录用；Demo 模式无需此项）

### 1. 克隆并安装

```bash
git clone https://github.com/sarahwangy/lovely-shelf.git
cd lovely-shelf
npm install
```

### 2. 配置环境变量

```bash
cp .env.sample .env.local
```

编辑 `.env.local`：

```env
# 必填
ANTHROPIC_API_KEY=sk-ant-...
NOTION_TOKEN=secret_...
NOTION_DATABASE_ID=...                  # 数据库 URL 中的 32 位 ID

# 登录
AUTH_SECRET=...                         # 生成：npx auth secret
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_ALLOWED_EMAILS=you@gmail.com       # 逗号分隔的白名单

# 可选 — 启用 Agent 流水线
NEXT_PUBLIC_USE_AGENT=false

# 可选 — 语录卡背景图 / 视频 / 音乐搜索
PIXABAY_API_KEY=...
JAMENDO_CLIENT_ID=...
```

> `.env.local` 已在 `.gitignore` 中，不会被提交。

### 3. 启动

```bash
npm run dev
# → http://localhost:3000
```

点击「一键体验 Demo」即可无需 API Key 浏览（AI 识别功能需要 `ANTHROPIC_API_KEY`）。

---

## 部署到 Vercel

```bash
vercel deploy
```

在 Vercel 项目设置中填入相同的环境变量。推荐配置：
- **Node.js 版本**：20.x（sharp 依赖）
- **Function 超时**：60s（AI + Notion 冷启动约 10–15s）

---

## 开发备忘

**新增 Notion 字段**：修改 `src/lib/notion-fields.ts`（唯一真值源），再更新 `src/lib/notion.ts` 中的读写逻辑，若需 AI 提取则同步修改 `src/lib/ai.ts`。

**修改类型列表**：更新 `src/lib/ai.ts` 的 system prompt，同步修改 Notion 数据库中 Multi-select 的选项，两端保持一致。

**本地使用 Demo 模式**：启动 dev server，点击 Demo 按钮即可，凭证提供商不校验密码。AI 识别需要 `ANTHROPIC_API_KEY`，其余功能不依赖任何外部 API。

---

## 功能进度

- [x] AI 封面识别（Claude 视觉 API）
- [x] 自动写入 Notion，附封面，自动去重
- [x] 批量上传，每张独立进度条
- [x] HEIC/HEIF 格式支持（iPhone 原图）
- [x] 看板：类型饼图、活跃热力图
- [x] 书籍详情浮层，支持 Notion 字段回写
- [x] 语录库：分标签、收藏、分页
- [x] 语录卡制作室（PNG 导出、MP4 录制）
- [x] AI 对话助手（SSE 流式输出）
- [x] Agent 模式（Claude Tool Use）
- [x] Demo 模式（真实 AI 识别，不触碰 Notion）
- [ ] Google Books API 补全 ISBN / 页数
- [ ] 语录卡公开分享链接

---

## License

MIT
