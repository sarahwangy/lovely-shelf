# lovely-shelf 📚

> 拍一张书封面，AI 自动识别书名、作者、类型，一键存入 Notion 书库。  
> Scan a book cover — AI extracts title, author & genre, saves it to your Notion library instantly.

<!-- 部署完成后在此处替换为真实截图或 GIF -->
<!-- ![lovely-shelf demo](./assets/demo.gif) -->

---

## 功能特性

- **AI 封面识别**：上传书封面图片，Claude AI 自动提取书名、副标题、作者、国籍、类型标签、一句话简介
- **批量上传**：最多同时处理 3 张图，进度实时显示
- **自动写入 Notion**：识别完成立即入库，附带封面图
- **重复检测**：书名+作者相同时跳过入库，显示已有记录链接
- **HEIC 支持**：iPhone 原图直接上传，前端自动转换为 JPEG
- **移动端适配**：支持手机浏览器使用，适配 iPhone 安全区

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | [Next.js 15](https://nextjs.org/) App Router |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| AI 识别 | [Anthropic Claude](https://www.anthropic.com/) (`claude-sonnet-4-6`) |
| 数据存储 | [Notion API](https://developers.notion.com/) |
| 图片处理 | [sharp](https://sharp.pixelplumbing.com/) |
| HEIC 转换 | [heic2any](https://github.com/alexcorvi/heic2any)（前端） |
| 部署 | [Vercel](https://vercel.com/) |

---

## 本地启动

### 前置要求

- Node.js 20+
- 一个 Notion Integration Token（见下方申请步骤）
- 一个 Anthropic API Key

### 1. 克隆并安装依赖

```bash
git clone https://github.com/sarahwangy/lovely-shelf.git
cd lovely-shelf
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
NOTION_TOKEN=secret_xxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

各变量获取方式见下方"环境变量说明"。

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## 环境变量说明

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | [console.anthropic.com](https://console.anthropic.com/) → API Keys |
| `NOTION_TOKEN` | Notion Integration Token | [notion.so/profile/integrations](https://www.notion.so/profile/integrations) → 创建 Internal Integration |
| `NOTION_DATABASE_ID` | Notion 数据库 ID | 打开数据库页面，URL 中 `notion.so/` 后面那串 32 位字符（`?v=` 之前的部分） |

> ⚠️ `.env.local` 已在 `.gitignore` 中，不会被提交到 Git。

---

## Notion 数据库字段结构

在 Notion 中新建一个 Database，添加以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| 书名 | Title | 主标题（必填） |
| 副标题 | Text | 副标题 |
| 作者 | Text | 多作者用 `&` 分隔 |
| 性别 | Text | 作者性别：男 / 女 |
| 国家 | Select | 作者国籍（预设 8 个选项） |
| 类型 Label | Multi-select | 书籍类型标签（可多选） |
| 描述 | Text | AI 生成的一句话主题 |
| 封面 | Files & media | 书籍封面图片 |
| 状态 | Select | 草稿 / 已确认 |
| 原图文件名 | Text | 上传时的原始文件名 |

创建完成后，进入数据库页面 → 右上角 `···` → Connections → 选择你创建的 Integration。

---

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 访问 [vercel.com](https://vercel.com/)，用 GitHub 账号登录
3. 点击 **Add New Project** → 选择 `lovely-shelf` 仓库
4. 在 **Environment Variables** 中添加 3 个环境变量（同 `.env.local`）
5. 点击 **Deploy**

部署完成后会得到一个 `https://lovely-shelf-xxx.vercel.app` 的链接。

> **注意**：首次部署如遇 `sharp` 相关报错，在 Vercel Project Settings → General → Node.js Version 中确认版本为 20.x。

---

## 项目结构

```
src/
├── app/
│   ├── page.tsx              # 上传页（/）
│   ├── result/page.tsx       # 结果页（/result）
│   └── api/
│       ├── process/route.ts  # POST /api/process（主处理接口）
│       └── health/route.ts   # GET /api/health（健康检查）
├── lib/
│   ├── ai.ts                 # Claude 识别函数
│   ├── image.ts              # 图片预处理（sharp）
│   ├── notion.ts             # Notion 读写函数
│   └── notion-fields.ts      # 字段名映射常量
└── types/
    └── book.ts               # BookInfo 类型定义
```

---

## Roadmap

- [x] AI 封面识别（Claude Vision）
- [x] 自动写入 Notion
- [x] 批量上传 + 并发处理
- [x] HEIC 格式支持
- [x] 重复检测
- [x] 移动端适配
- [ ] 部署上线（Vercel）
- [ ] Google Books API 补全 ISBN / 页数等信息
- [ ] Dashboard 书库洞察看板（类型占比、月度入库趋势）
- [ ] 书籍详情网页内编辑（不跳 Notion）
- [ ] Agent 化（Anthropic Tool Use 多步推理）
- [ ] 对话式 UI（流式响应）

---

## License

MIT
