# 开发任务拆解 — Lovely-Shelf

> 配套文档：`PRD.md`
> 开发顺序按 ticket 编号执行；每个 ticket 都标注了**前置依赖**、**预计耗时**、**完成标准**（DoD）
> 建议节奏：每完成一个 ticket 就 `git commit` 一次，便于回滚

---

## 进度总览

| 阶段 | Ticket 范围 | 目标 |
|------|------------|------|
| **阶段 0：准备** | T01 - T03 | 环境就绪、账号开好、Notion 配好 |
| **阶段 1：跑通最小链路** | T04 - T08 | 命令行下能跑：1 张图 → AI 识别 → 写入 Notion |
| **阶段 2：加前端** | T09 - T12 | 网页能上传 → 看到识别结果 → 一键入库 |
| **阶段 3：增强体验** | T13 - T16 | 批量上传、错误处理、移动端适配 |
| **阶段 4：上线** | T17 - T19 | 部署 Vercel、写 README、真实数据测试 |
| **阶段 5：互动反馈 + 洞察看板** | T20 - T22 | 入库反馈 + 同类书推荐 + 网页内详情 modal + Dashboard 洞察页（不跳 Notion）|
| **阶段 6：Agent 化** | T23 | 后端从固定流程升级为 Agent（Tool Use 多步推理）|
| **阶段 7：对话式 UI** | T24 | 加上流式对话窗口，把工具变成"AI 助手" |

> 🔮 **未来可选阶段（暂不开工）**：国际化 i18n（中英文切换，next-intl + 类型 Label 双语映射 + AI 输出跟随语言）。等中文版本完整上线、有海外分享需求时再做。

---

## 🟢 阶段 0：准备（建议第一天搞定，1-2 小时）

### **T01：申请所有必要的 API Keys / Tokens**
- **前置**：无
- **预计耗时**：30 分钟
- **任务**：
  - [ ] 注册 [Anthropic Console](https://console.anthropic.com/)，充值 $5，创建 API Key
  - [ ] 在 [Notion Integrations](https://www.notion.so/profile/integrations) 创建 Internal Integration，记下 Token
  - [ ] 在 Notion 创建一个空白 Database（按 PRD §6 设字段），右上角 "..." → Connections 连接刚创建的 Integration
  - [ ] 复制 Database 的 ID（URL 里那串 32 位字符）
- **DoD**：
  - 一个文本文件（不要 commit 到 git）记下 3 个变量：
    ```
    ANTHROPIC_API_KEY=sk-ant-xxx
    NOTION_TOKEN=secret_xxx
    NOTION_DATABASE_ID=xxx
    ```

---

### **T02：搭好本地开发环境**
- **前置**：无
- **预计耗时**：30 分钟
- **任务**：
  - [ ] 安装 Node.js 20+ LTS（[nodejs.org](https://nodejs.org/)）
  - [ ] 安装 VS Code（如未装）
  - [ ] 安装 Claude Code（按官方文档）
  - [ ] 配置 GitHub SSH 或 HTTPS（确认能 `git push`）
- **DoD**：终端能跑 `node -v`、`npm -v`、`git --version`，都正常

---

### **T03：创建项目脚手架**
- **前置**：T02
- **预计耗时**：15 分钟
- **任务**：
  - [ ] 在 `~/Projects/` 下跑：
    ```
    npx create-next-app@latest love-my-shelf --typescript --tailwind --app --src-dir --import-alias "@/*"
    ```
  - [ ] `cd love-my-shelf && npm run dev`，访问 `localhost:3000` 看到默认页
  - [ ] `git init` + 第一次 commit
  - [ ] 在 GitHub 创建同名 repo（private 或 public），`git push`
  - [ ] 在项目根目录建一个 `.env.local`，把 T01 的 3 个变量写进去
  - [ ] 检查 `.gitignore` 中已经包含 `.env*.local`
- **DoD**：本地能看到默认 Next.js 页面；代码已经在 GitHub

---

## 🟢 阶段 1：跑通最小链路（建议 1-2 天，4-6 小时）

> 目标：在命令行里运行一个脚本，给它一张图，它能识别并写入 Notion。**先不做 UI**。

### **T04：安装核心依赖**
- **前置**：T03
- **预计耗时**：10 分钟
- **任务**：
  ```bash
  npm install @anthropic-ai/sdk @notionhq/client sharp
  npm install -D @types/node
  ```
- **DoD**：`package.json` 中能看到这些依赖

---

### **T05：写图片预处理工具函数**
- **前置**：T04
- **预计耗时**：1 小时
- **任务**：
  - 文件：`src/lib/image.ts`
  - 函数：`async function preprocessImage(input: Buffer | string): Promise<{ jpegBuffer: Buffer; base64: string; mimeType: 'image/jpeg' }>`
  - 逻辑：
    1. 用 `sharp` 读取（支持 HEIC / JPG / PNG / WebP）
    2. 缩到 `max width 1600px`（保持长宽比，`withoutEnlargement: true`）
    3. 输出 JPEG，quality 85
    4. 返回 buffer + base64（base64 给 Claude 用）
  - 写一个 `src/scripts/test-preprocess.ts`：读 `封面图/01_*.jpg`，输出尺寸和文件大小
- **DoD**：跑 `npx tsx src/scripts/test-preprocess.ts` 能输出"原始 X bytes → 处理后 Y bytes"

---

### **T06：写 AI 视觉识别工具函数**
- **前置**：T05
- **预计耗时**：1.5 小时
- **任务**：
  - 文件：`src/lib/ai.ts`
  - 函数：`async function recognizeBook(base64Image: string): Promise<BookInfo>`
  - 类型 `BookInfo`：
    ```ts
    type BookInfo = {
      title: string;              // 主标
      subtitle: string | null;    // 冒号后的副标
      author: string;             // 作者，多作者用 "&" 分隔
      country: string | null;     // 作者国籍（识别不出时为 null）
      genre: string[];            // 类型 label 数组
      description: string;        // 一句话主题
    }
    ```
  - 调用 Claude API（推荐模型 `claude-sonnet-4-6`）
  - 用 system prompt 要求严格 JSON 输出，禁止任何额外文字
  - 写一个 `src/scripts/test-recognize.ts`：跑一张测试图，打印识别结果
- **DoD**：脚本能输出一个合法的 `BookInfo` JSON，字段都对得上

---

### **T07：写 Notion 写入工具函数**
- **前置**：T06
- **预计耗时**：2 小时
- **任务**：
  - 文件：`src/lib/notion.ts`
  - 函数 1：`async function uploadFileToNotion(buffer: Buffer, filename: string): Promise<string>`（返回 file_upload_id）
  - 函数 2：`async function createBookPage(info: BookInfo, fileUploadId: string): Promise<{ pageId: string; pageUrl: string }>`
  - 写一个 `src/scripts/test-notion.ts`：把 `BookInfo` + 图片传上去，看 Notion 里出现一行
- **DoD**：在 Notion Database 里能看到新增的一行，带封面图、所有字段填好

---

### **T08：把 T05+T06+T07 串起来跑通端到端**
- **前置**：T05, T06, T07
- **预计耗时**：30 分钟
- **任务**：
  - 文件：`src/scripts/end-to-end.ts`
  - 接收命令行参数：图片路径
  - 依次：preprocess → recognize → upload → createPage
  - 打印每步耗时和最终 Notion page URL
- **DoD**：
  - 跑 `npx tsx src/scripts/end-to-end.ts ./封面图/01_The-Girl-Who-Touched-the-Stars.jpg`
  - 终端打印识别结果 + Notion URL
  - 打开 Notion URL 能看到这一行

---

## 🟢 阶段 2：加前端（建议 2-3 天，6-8 小时）

### **T09：写后端 API：`POST /api/process`**
- **前置**：T08
- **预计耗时**：1.5 小时
- **任务**：
  - 文件：`src/app/api/process/route.ts`
  - 接收 `multipart/form-data`，字段名 `image`
  - 逻辑：复用 T08 的 end-to-end 流程
  - 返回 JSON：`{ success: boolean; bookInfo?: BookInfo; pageUrl?: string; error?: string }`
  - 加错误处理：单步失败时返回明确的错误信息
- **DoD**：用 `curl -F "image=@封面.jpg" http://localhost:3000/api/process` 能返回成功 JSON

---

### **T10：写上传页面 `/`**
- **前置**：T09
- **预计耗时**：2 小时
- **任务**：
  - 文件：`src/app/page.tsx`
  - UI 元素：
    - 大的拖拽区域（也支持点击选文件）
    - 选了文件后展示缩略图
    - "开始识别"按钮
    - 处理中显示 loading
    - 处理完跳转或在页面上显示结果
  - 用 `<input type="file" accept="image/*" multiple>` 即可（手机会自动调相机或相册）
- **DoD**：网页能选图，提交后看到识别结果

---

### **T11：写结果页 `/result/[batchId]`**
- **前置**：T10
- **预计耗时**：2 小时
- **任务**：
  - 文件：`src/app/result/[batchId]/page.tsx`
  - 用 React state 或 URL 参数携带识别结果
  - 每张图一张卡片：左边封面缩略图，右边各字段（可编辑 input）
  - 底部"确认入库"按钮 → 再调一次 `/api/confirm`（如果走"先识别再人工确认再入库"流程）
  - 简化版：T09 已经直接入库，这里只展示 + 提供 Notion 链接
- **DoD**：识别完能看到一张卡片，字段清晰，能跳转到 Notion

---

### **T12：基础样式 + 移动端适配**
- **前置**：T10, T11
- **预计耗时**：1.5 小时
- **任务**：
  - 用 Tailwind 做最低限度的美化：合理间距、字体、颜色、暗色模式（可选）
  - 用 `max-w-*` 控制内容区宽度
  - 在 Chrome 开发者工具切到手机视图验证
  - 真机访问 `http://你的电脑IP:3000` 测一下
- **DoD**：在 iPhone 浏览器打开能正常使用

---

## 🟡 阶段 3：增强体验（建议 1-2 天，3-5 小时）

### **T13：批量上传 + 进度展示**
- **前置**：T12
- **预计耗时**：1.5 小时
- **任务**：
  - 上传页支持多张图同时选择
  - 前端串行/并行调用 `/api/process`（建议并发 3 个，防止触发 API 限流）
  - 展示每张图的状态：pending / processing / success / failed
  - 失败可单独重试
- **DoD**：一次上传 5 张图，能看到每张的进度，全部成功

---

### **T14：图片格式扩展（确认 HEIC 支持）**
- **前置**：T13
- **预计耗时**：30 分钟
- **任务**：
  - 验证 `sharp` 在 Vercel 函数环境里能解码 HEIC
  - 如果不行，备选方案：前端用 `heic2any` 库先转 JPG
- **DoD**：能成功处理一张 HEIC 文件

---

### **T15：重复检测（Should Have）**
- **前置**：T13
- **预计耗时**：1 小时
- **任务**：
  - 在写 Notion 前先查询 Database，按"书名 + 作者"匹配
  - 如果已存在，前端提示用户"已在书库里，是否仍要新增？"
- **DoD**：上传同一本书两次，第二次有警告

---

### **T16：基础日志和错误处理**
- **前置**：T13
- **预计耗时**：1 小时
- **任务**：
  - 后端：每个请求打印 `[timestamp] [step] [duration] [status]`
  - 前端：fetch 失败时显示友好提示，不要白屏
  - 加一个 `/api/health` 接口给 Vercel 用
- **DoD**：故意断网或填错 Token 时，能在前端看到清楚的错误

---

## 🟢 阶段 4：上线（建议 0.5-1 天，2-3 小时）

### **T17：写 README**
- **前置**：T16
- **预计耗时**：1 小时
- **任务**：
  - 文件：`README.md`
  - 内容：
    - 项目截图 / GIF 演示
    - 一句话简介
    - 技术栈说明
    - 本地启动步骤
    - 环境变量清单
    - Notion Database 字段结构（贴个截图最直观）
    - 部署到 Vercel 的步骤
    - 后续 Roadmap
  - 加几张运行截图
- **DoD**：让你妈/朋友看了 README 大致能搞懂这个项目是干嘛的

---

### **T18：部署 Vercel**
- **前置**：T17
- **预计耗时**：30 分钟
- **任务**：
  - 在 [vercel.com](https://vercel.com/) 用 GitHub 登录
  - Import 你的 repo
  - 在 Project Settings → Environment Variables 加 3 个 env（同 T01）
  - Deploy
  - 第一次部署可能因 `sharp` 失败，需要配置 ）（如真出问题再处理）
- **DoD**：拿到 `https://love-my-shelf-xxx.vercel.app/`，手机能打开

---

### **T19：真实数据测试 + 收尾**
- **前置**：T18
- **预计耗时**：1 小时
- **任务**：
  - 用 88 张测试图全跑一遍（线上环境）
  - 统计识别准确率（对照已有的 `书籍清单.md` 前 20 张）
  - 修改 README 加上"实测识别 88 张图，准确率 X%"
  - 给 Vercel 项目绑定自定义域名（可选）
- **DoD**：80% 以上的图能成功跑完；README 完整；可发简历

---

## 🟣 阶段 5：互动反馈（建议 1-2 天，4-6 小时）

> 目标：用户每入一本书，前端立刻有"惊喜反馈"——"这是你第 23 本回忆录！"，让书库变得有"成就感"。后续做 Dashboard 把书库整体可视化。

### **T20：入库后返回同类书统计 + 前端提示**
- **前置**：T11（结果页已存在）、T16（错误处理）
- **预计耗时**：2 小时
- **任务**：
  - **后端改造**：
    - 文件：`src/lib/notion.ts` 新增 `async function countBooksByGenre(genre: string): Promise<number>`
      - 用 `notion.databases.query` + `filter: { property: "类型 Label", multi_select: { contains: genre } }`
      - 如果数据量大，可用 `page_size: 100` + 翻页（MVP 阶段 < 100 本就一次查完）
    - 改 `src/app/api/process/route.ts`：在成功 `createBookPage` 之后，对返回的 `info.genre[0]`（取主类型）调一次 `countBooksByGenre`
    - 返回 JSON 扩展：
      ```ts
      {
        success: true,
        bookInfo,
        pageUrl,
        stats: {
          primaryGenre: "回忆录",
          countInGenre: 23,
          message: "发现你这是第 23 本回忆录类的书～"
        }
      }
      ```
  - **前端改造**：
    - 结果页 `src/app/result/...` 或主页的成功态下，在 Notion 链接旁加一个高亮提示卡片
    - 文案模板：`已添加到你的 Notion 书库 ✅\n发现你这是第 {count} 本 {genre} 类的书～`
    - 视觉建议：emoji + 渐变色背景，让"成就感"出来
- **DoD**：
  - 上传任意一本书，结果页能看到"这是第 X 本 XX 类的书"
  - 手动在 Notion 里删一本后再上传，计数能正确减少

---

### **T21：同类书推荐（最多 5 本）**
- **前置**：T20
- **预计耗时**：2 小时
- **任务**：
  - **后端**：
    - 文件：`src/lib/notion.ts` 新增 `async function listBooksByGenre(genre: string, excludePageId: string, limit = 5): Promise<BookSummary[]>`
    - `BookSummary` 类型：`{ pageId: string; title: string; subtitle: string | null; author: string; country: string | null; genres: string[]; description: string; coverUrl: string | null; notionUrl: string }`
    - 取最近创建的 N 本（按 `created_time` desc，过滤掉刚入库那本）
  - 改 `/api/process` 在 `stats` 下加 `recommendations: BookSummary[]`
  - **前端**：
    - 提示卡片下方加一个"📚 你的同类书架"区块
    - 横向滚动或网格，每张卡片显示封面缩略图 + 书名 + 作者
    - 点击卡片 → **在网页内弹出书籍详情 modal**（使用 T22.5 中的 `<BookDetailModal>` 组件），展示该书所有字段；modal 底部保留一个"在 Notion 中打开 ↗"小链接作为兜底
    - **不要**在新标签打开 Notion，让用户保持在网页内浏览
  - 边界情况：如果同类只有 1 本（就是刚入库的这本），区块整体隐藏
- **DoD**：
  - 上传一本回忆录，下方能看到 3-5 本之前入库的回忆录卡片
  - 点击任意卡片，能在网页内看到完整书籍信息（不跳转）
  - 第一次入某类书时，推荐区不显示，文案改为"这是你的第 1 本 XX 类的书 🎉"

---

### **T22：洞察看板 `/dashboard`（不是 Notion 复刻，是"书架洞察 + 公开作品页"）**
- **前置**：T21、T22.5
- **预计耗时**：5 小时
- **设计理念**：
  - Notion 已经能"浏览/编辑/筛选"书库，我们的 Dashboard 不重复造这些
  - 我们的 Dashboard 做 Notion 做不好的事：**可视化洞察、多级钻取、可分享、像 Spotify Wrapped 的成就感**
  - 整页设计成"我的书架洞察"，可以作为简历附 demo 链接
- **任务**：
  - 文件：`src/app/dashboard/page.tsx` + `src/app/api/stats/route.ts` + `src/app/dashboard/genre/[name]/page.tsx`
  - **后端 `/api/stats`**：
    - 全量拉取 Notion Database（带翻页），返回：
      ```ts
      {
        total: 88,
        genres: [{ name: "回忆录", count: 23, percentage: 26.1 }, ...],
        topGenres: [...],                    // 占比前 3 的类型
        countries: [{ name: "澳大利亚", count: 12 }, ...],
        thisYear: { total: 45, byMonth: [3, 5, 7, ...] },  // 今年入库数 + 月度分布
        recentActivity: [{ date: "2026-05-12", count: 3 }, ...],  // 最近 30 天每日入库
        latest: BookSummary[],               // 最近 5 本入库
      }
      ```
    - 内存缓存 60 秒（避免每次刷新都打 Notion API）
  - **前端 - 顶部 Hero 区**：
    - 大字："你的书架里有 **88** 本书"
    - 副标："今年入库 45 本 · 最爱的类型是回忆录"
    - 可截图分享（设计成 16:9，方便发朋友圈）
  - **前端 - Widget 区（响应式网格）**：
    1. **🥧 类型占比环形图**（主 widget，占两列）
       - 用 `recharts` 的 PieChart / Donut
       - 点击切片或图例 → 跳 `/dashboard/genre/[name]`（封面墙）
    2. **🏆 Top 3 类型卡片**
       - 大数字 + 类型名 + 占比，emoji 区分
    3. **🌍 作者国家分布**
       - 简单条形图或国家 chip 列表（带国旗 emoji），点击 chip → 弹列表
       - 加分项：用 `react-simple-maps` 做小地图（可选）
    4. **📅 最近 30 天入库热力图**
       - 类似 GitHub 贡献图的小色块
       - 每天一个格子，颜色深浅 = 当天入库数
    5. **📈 今年月度趋势**
       - 12 个月柱状图
    6. **🆕 最近入库**
       - 横向滚动 5 本，点击 → 弹 `<BookDetailModal>`（复用 T22.5）
    7. **☁️ 书库热词云**（详见 T22.6）
       - 占满整行的大 widget，视觉冲击力最强
       - 从所有书的 description + subtitle 提取高频词
       - 点击词 → 筛出所有含该词的书的封面墙
  - **前端 - 子页 `/dashboard/genre/[name]`**：
    - 顶部："**回忆录** · 23 本 · 占书库 26.1%"
    - 网格封面墙（封面 + 书名 + 作者）
    - 点击任意一本 → 弹 `<BookDetailModal>`（**不跳 Notion**）
  - **顶部导航**加 "📊 我的书架" 入口
  - **公开分享准备**：
    - Dashboard 页支持 `?public=true` 参数：隐藏编辑/上传入口，只读
    - 加 OG 标签，分享到 Twitter/微信能预览
- **DoD**：
  - `/dashboard` 能看到 6 个 widget，全部数据来自 Notion 实时
  - 点击饼图任一切片 → 进入封面墙 → 点书 → 弹 modal 看详情，全过程**不跳 Notion**
  - 手机端响应式：widget 在窄屏单列堆叠、不溢出
  - Dashboard 页可截图，发出去像 Spotify Wrapped 一样有"看头"

---

### **T22.5：书籍详情 Modal 组件 + 编辑回写**
- **前置**：T21（或与 T22 并行）
- **预计耗时**：3 小时
- **任务**：
  - **目标**：做一个全站通用的 `<BookDetailModal>`，让用户在网页内查看 + 编辑任何一本书，不用跳 Notion
  - **后端**：
    - 文件：`src/lib/notion.ts` 新增：
      - `async function getBookByPageId(pageId: string): Promise<BookDetail>` — 拉单本完整信息
      - `async function updateBookPage(pageId: string, patch: Partial<BookInfo>): Promise<void>` — 字段回写
    - 新 API 路由：
      - `GET /api/books/[pageId]` — 取单本详情
      - `PATCH /api/books/[pageId]` — 局部更新字段
    - 后端做基本字段校验（类型 label 必须在预设列表内、书名非空等）
  - **前端组件**：
    - 文件：`src/components/BookDetailModal.tsx`
    - Props：`{ pageId: string; open: boolean; onClose: () => void; onUpdated?: (book: BookDetail) => void }`
    - 视觉：
      - 左：封面大图
      - 右：书名（大字标题）、副标、作者、国家、类型 label（chip）、描述（多行）
      - 顶部右上角：✏️ 编辑按钮 → 切换到编辑模式（字段变 input/textarea/multi-select）
      - 编辑模式下底部"保存" / "取消"
      - 底部最左：小灰字链接"在 Notion 中打开 ↗"（兜底）
    - 移动端：modal 全屏展示（`max-h-dvh overflow-auto`），不要让 iOS 把内容截掉
  - **接入点**：
    - T21 的同类书卡片点击 → 弹这个 modal
    - T22 的 Dashboard 封面墙点击 → 弹这个 modal
    - T11 的结果页"刚入库这本"卡片旁也加一个"查看/编辑详情"按钮 → 弹这个 modal
- **DoD**：
  - 点击任何一张书卡片都能弹出详情 modal
  - 在 modal 内修改书名/类型后保存，30 秒内能在 Notion 看到更新（也能看到 Dashboard 计数变化）
  - 关闭 modal 不刷新页面、保持当前位置
  - iPhone Safari 上 modal 不溢出、能滚动看完

---

### **T22.6：书库热词云 Widget（带中文分词）**
- **前置**：T22（Dashboard 主结构已搭好）
- **预计耗时**：3-4 小时
- **设计理念**：
  - 词云是 Dashboard 里**视觉冲击力最强**的 widget，做成大尺寸放整页底部
  - 不同于饼图（看分类），词云看的是**书库的"主题宇宙"**——哪些关键词反复出现
  - 词来自 description + subtitle，**不要用类型 Label**（那已经在饼图里了）
  - 点击任一词 → 弹出"包含该词的书"列表，作为发现书的另一条路径

- **任务**：
  - **后端 - 新增 API `/api/wordcloud`**：
    - 文件：`src/app/api/wordcloud/route.ts`
    - 逻辑：
      1. 全量拉取 Notion 中所有书的 `description` 和 `subtitle` 字段
      2. 拼接成大文本，按语言分词：
         - 中文部分：用 `segmentit` 做分词
         - 英文部分：按空格切，转小写
      3. 去停用词（中英两套停用词表）+ 过滤短词（中文 < 2 字 / 英文 < 3 字）
      4. 统计词频，取 Top 80-100 个词
      5. 返回：
         ```ts
         {
           words: [
             { text: "回忆", count: 18, weight: 1.0 },
             { text: "童年", count: 12, weight: 0.67 },
             { text: "memoir", count: 9, weight: 0.5 },
             ...
           ],
           generatedAt: "2026-05-12T..."
         }
         ```
    - 缓存：内存缓存 5 分钟（词云不需要实时，缓存避免每次进 Dashboard 都重算）
    - 性能：500 本以下都能在 200ms 内算完

  - **后端 - 分词工具**：
    - 文件：`src/lib/tokenizer.ts`
    - 安装：`npm install segmentit`
    - 导出函数：
      ```ts
      export function tokenize(text: string): string[]
      export function isStopword(word: string): boolean
      ```
    - 停用词表：
      - 中文停用词：建一个 `src/lib/stopwords-zh.ts`，包含"的、了、是、和、与、在、有、一、个、这、那、就、也、都、为、要、会、把、给、来、去、说、可以、可能、关于、以及、一种、一本"等约 100 个
      - 英文停用词：用通用列表（the / a / an / of / and / or / but / in / on / at / to / for / with / by / from / about / as / is / are / was / were / be / been / being / have / has / had / do / does / did / will / would / could / should / can / may / might / one / book / story / memoir / author 等）

  - **前端 - WordCloud 组件**：
    - 安装：`npm install wordcloud` （wordcloud2.js）
    - 文件：`src/components/WordCloudWidget.tsx`
    - 逻辑：
      - 用 ref 拿到一个 `<canvas>` 元素
      - 调 `WordCloud(canvasEl, { list: words.map(w => [w.text, w.count]), ... })`
      - 关键参数：
        - `gridSize: 8`（密度，越小词越密）
        - `weightFactor: count => 8 + count * 4`（字号映射，最大词约 40-60px）
        - `fontFamily: '"PingFang SC", "Helvetica Neue", sans-serif'`
        - `color: 'random-light'` 或自定义渐变色函数
        - `rotateRatio: 0.3`（30% 词旋转，避免太规整）
        - `shape: 'circle'`（也可以 `'cardioid'` 心形）
        - `click: (item) => onWordClick(item[0])`
    - 响应式：用 `ResizeObserver` 监听容器宽度，宽度变化时 redraw

  - **前端 - 点击词 → 抽屉/modal 展示包含该词的书**：
    - 新增 API `GET /api/books/search?word=XXX` 模糊匹配 description 或 subtitle
    - 点击词时弹一个 Drawer（右侧滑出）：
      - 顶部："包含「童年」的 8 本书"
      - 下方网格：封面 + 书名 + 作者，点击 → 弹 BookDetailModal
    - 关闭 Drawer 不离开 Dashboard

  - **空态处理**：
    - 书库少于 5 本时，词云区显示"再入几本书，这里就会出现你的主题宇宙 🌌"
    - 不要显示一个孤零零的几个词

- **DoD**：
  - Dashboard 底部出现热词云，主要词字号大、次要词小，视觉效果接近参考图
  - 中文 description 里的"回忆、童年、海洋、母亲"等高频词能正确分词出现
  - 英文书的 subtitle 里"adventure、journey、love"等也能出现
  - 停用词（"的、了、a、the"）不应出现
  - 点击任意一个词，右侧滑出抽屉，能看到所有相关书的封面
  - 手机端词云依然能看清（小屏自动减少词数到 40 个左右）
  - 5 分钟内重复进入 Dashboard 不会重复触发分词计算（缓存生效）

- **加分项（可选）**：
  - 按类型 Label 染色：回忆录的高频词偏蓝、心理相关偏紫…（让词云本身也传递分类信息）
  - 一键截图分享（用 `html2canvas`）

---

## 🔵 阶段 6：Agent 化（建议 2-3 天，6-8 小时）

> 目标：把后端从"固定 if/else 流水线"重构为"Agent + Tool Use"。AI 自己决定何时调用哪个工具、如何处理异常、何时请用户确认。这是简历上能写"用 Anthropic Tool Use 构建 Agent"的关键。

### **T23：后端 Agent 重构（Anthropic Tool Use）**
- **前置**：T22
- **预计耗时**：6-8 小时（这是本阶段单个最大的 ticket，建议拆 2 天）
- **任务**：
  - **设计**：
    - 文件：`src/lib/agent.ts`
    - 定义工具（Anthropic `tools` 参数）：
      1. `preprocess_image` — 图片预处理
      2. `recognize_book_from_image` — 从图片提取 BookInfo
      3. `search_google_books` — （可选）用书名+作者查 Google Books 补全信息
      4. `check_duplicate_in_notion` — 查 Notion 是否已有同书
      5. `upload_cover_to_notion` — 上传封面文件
      6. `create_notion_page` — 创建 Notion 行
      7. `count_books_by_genre` — 同类书计数
      8. `list_books_by_genre` — 同类书列表
      9. `ask_user_for_confirmation` — 当 AI 不确定时要求用户确认（前端弹一个 modal）
    - Agent 循环：`while (response.stop_reason === 'tool_use')`，按 SDK 规范处理
  - **改造路径**：
    - 保留旧的 `/api/process` 作为 fallback，新加 `/api/agent` 走 Agent 流程
    - 前端加一个 feature flag（环境变量 `NEXT_PUBLIC_USE_AGENT=true`）切换
  - **可观测性**：
    - 每个工具调用打日志：`[agent] step 3: recognize_book_from_image → 1.2s → ok`
    - 把 Agent 的 thinking 步骤可选地返回给前端展示（"AI 正在识别封面..."）
  - **Prompt 工程**：
    - System prompt 明确说明：识别不清楚时调 `search_google_books` 补全；发现重复时调 `ask_user_for_confirmation`；最后才入库
- **DoD**：
  - `/api/agent` 能完整跑完一张图的入库流程
  - 故意上传一张模糊的图，能看到 Agent 自动调用 `search_google_books` 补全
  - 上传重复书时，前端能收到"已存在，是否仍要入库"的询问
  - 终端日志能完整看到 Agent 的每一步决策

---

## 🟣 阶段 7：对话式 UI（建议 2 天，5-7 小时）

> 目标：在 Web 上加一个对话窗口，用户可以"和 AI 助手聊着把书入库"。流式输出让交互感更强。手机也能用。

### **T24：聊天界面 + 流式响应**
- **前置**：T23
- **预计耗时**：5-7 小时
- **任务**：
  - **后端**：
    - 文件：`src/app/api/chat/route.ts`
    - 用 Anthropic SDK 的 `stream: true`，按 SSE 或 ReadableStream 返回
    - 支持多轮对话（前端把历史 messages 传回）
    - 工具调用复用 T23 的工具集
  - **前端**：
    - 新页面 `src/app/chat/page.tsx`
    - UI：类似 ChatGPT 的对话气泡 + 底部输入框 + 文件上传按钮
    - 流式 token 打字机效果
    - 用户消息支持文本 + 图片附件
    - 助手回复中嵌入"已入库"卡片（直接用 T20-T21 的组件）
    - 工具调用过程展示为"思考中"动画（折叠的"AI 调用了 X 工具"）
  - **示例对话**：
    ```
    用户：[上传 3 张图]
    AI：好的，我来识别一下～（流式）
        [识别中... 3/3]
        ✅ 已入库 3 本：
        - 《From Scratch》— 你的第 24 本回忆录
        - 《Big Feelings》— 你的第 16 本心理相关
        - 《Being You》— 你的第 1 本科普 🎉
        要看看你之前的回忆录吗？
    用户：好啊
    AI：[展示 5 本同类书卡片]
    ```
  - **移动端**：
    - 用 `100dvh` 处理 iOS 键盘弹起问题
    - 输入框 sticky 在底部
- **DoD**：
  - 桌面和手机都能流畅对话
  - 上传图片有打字机式的"识别中→识别完成"过程
  - 一次对话内可以连续入多本书，AI 记得上下文（如"再给我看看回忆录"）
  - 项目可以放简历，能写"基于 Anthropic Tool Use + Streaming 的对话式 Agent"

---

## 🎯 推荐起步顺序（直接给 Claude Code 用）

如果你打算让 Claude Code 帮你做，建议**严格按编号顺序**执行。具体提示语示例：

**给 Claude Code 的第一条指令：**

```
请按 TICKETS.md 中的 T03 创建项目脚手架，使用以下命令：
npx create-next-app@latest love-my-shelf --typescript --tailwind --app --src-dir --import-alias "@/*"
完成后初始化 git，加一个 .env.local 模板，并把 .gitignore 检查一下。
```

**完成 T03 后：**

```
请按 T04 安装核心依赖：@anthropic-ai/sdk、@notionhq/client、sharp，然后实现 T05（src/lib/image.ts 的图片预处理函数），并写一个测试脚本验证。
```

依此类推。每完成一个 ticket 跑测试，再进下一个。

---

## ⚠️ 重要提醒

1. **每个 ticket 完成后 `git commit`**，commit message 用 `feat(T05): 图片预处理工具函数` 这种风格
2. **不要跳 ticket**：T08 之前都是基础设施，必须先跑通命令行版再做 UI，否则调试会非常痛苦
3. **API Key 绝对不能 commit 到 Git**：`.env.local` 必须在 `.gitignore` 里
4. **遇到报错先复制完整错误给 AI**：不要自己猜
5. **每天结束 `git push`**：哪怕代码丑，存上备份

---

## 📋 快速 checklist（开发期间贴在桌面）

```
□ T01 申请 API Keys
□ T02 装环境
□ T03 项目脚手架 ← 从这开始动手写
□ T04 装依赖
□ T05 image.ts
□ T06 ai.ts
□ T07 notion.ts
□ T08 端到端脚本【里程碑1】
□ T09 POST /api/process
□ T10 上传页
□ T11 结果页
□ T12 移动端样式【里程碑2 - 可演示】
□ T13 批量上传
□ T14 HEIC
□ T15 重复检测
□ T16 日志和错误
□ T17 README
□ T18 部署 Vercel【里程碑3 - 上线】
□ T19 实测 + 收尾【里程碑4 - 可放简历】
□ T20 同类书计数提示 ← 阶段 5 开始
□ T21 同类书推荐（点击不跳 Notion，弹 modal）
□ T22.5 BookDetailModal + 编辑回写【关键基建】
□ T22 洞察看板 Dashboard【里程碑5 - 可视化书架】
□ T22.6 热词云 widget + 中文分词 + 点词查书
□ T23 Agent 重构（Tool Use）【里程碑6 - 简历亮点】
□ T24 对话式 UI + 流式响应【里程碑7 - 完整产品】
```

---

**祝顺利，期待 lovely-shelf 上线那天！🚀**