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


T20：集成 Google Books API（用书名+作者反查）
- 在 T08 端到端流程中，Claude 识别完后立刻调用 Google Books
- 合并字段（ISBN、出版日期、页数、官方简介、官方封面 URL）
- Notion 写入时把合并后的完整字段都填上
- 估计工时：1-1.5 小时
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
```

---

**祝顺利，期待 lovely-shelf 上线那天！🚀**
