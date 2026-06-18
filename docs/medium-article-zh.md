# 我用 7 天 Vibe Coding 做了一个 AI 全栈应用——完整记录

> 对着书的封面拍一张照，它自动出现在你的 Notion 里。

这是 **lovely-shelf** 的完整功能描述。上传一张书封图片，Claude AI 读取封面，提取书名、作者、类型、国家来源和书中金句，然后自动写入你的 Notion 数据库。不用手动输入，不用复制粘贴，只需要一张照片。

这篇文章我想讲两件事：我做了什么，以及我是怎么做的。因为"怎么做"才是真正有意思的部分。我是个刚入门的开发者，这整个项目是我用 Claude Code 做 pair programming，边学边建出来的。

---

## lovely-shelf 是什么？

**[在线 Demo →](https://lovely-shelf.vercel.app)**（点"一键体验 Demo"，不需要注册账号）

![上传页面——扫描书封的入口](screenshots/showcase.png)

应用分五个模块：

- 上传：拖入书封照片，Claude 几秒内识别完成
- 看板：类型饼图、30 天活动热力图、完整书单
- 语录：Claude 提取的所有金句，可搜索可筛选
- 语录工作室：把任意金句做成分享卡（导出 PNG 或录制带背景音乐的 MP4）
- 聊天：流式 AI 助手，了解你书架上的每一本书

```
┌─────────────────────────────────────────────────────┐
│                    上传流程                          │
│                                                     │
│  照片 ──► 预处理 ──► Claude AI ──► Notion 写入       │
│  (任意尺寸)  (sharp)   (视觉识别)                    │
│                                                     │
│  第一步：压缩到 ≤1200px，转换为 JPEG                 │
│  第二步：Claude 返回 { 书名, 作者, 类型,              │
│           国家, 金句, 简介 }                          │
│  第三步：重复检测——已有就链接，没有就创建             │
│  第四步：类型成就徽章 + 同类推荐列表                  │
└─────────────────────────────────────────────────────┘
```

识别完成后，结果页面展示 Claude 提取的内容，确认后写入 Notion：

![识别结果页——Claude 从封面提取了书名、作者、类型和简介](screenshots/prototype-result.png)

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js（App Router）+ TypeScript |
| 样式 | Tailwind CSS v4 |
| 图表 | Recharts |
| 图像处理 | sharp（服务端压缩 + JPEG 转换） |
| HEIC 支持 | libheif-js（WebAssembly）→ heic2any → Canvas API |
| AI | Anthropic Claude SDK |
| 数据库 | Notion（via @notionhq/client） |
| 登录 | next-auth v5 + Google OAuth |
| 实时通信 | Server-Sent Events（SSE）流式聊天 |
| 图片搜索 | Pixabay API |
| 音乐 | Jamendo API |
| 部署 | Vercel |

每一项都是业界标准的主流库，没有引入不熟悉的东西。

---

## Anthropic API vs OpenAI API——为什么选这个

两个都能做这个项目。视觉识别、结构化输出、流式聊天，双方都有。实际差别在哪？

| | Anthropic（Claude） | OpenAI（GPT-4o） |
|---|---|---|
| 视觉 API | `messages` 里放 `image` content block | 结构完全一样 |
| 工具调用 | `tools` 参数，概念完全相同 | `tools` / `functions` 参数 |
| 流式输出 | `messages.stream()` + async iterator | `chat.completions.create({ stream: true })` |
| JSON 输出 | 靠 prompt 约束，当时没有原生 JSON mode | `response_format: { type: "json_object" }` |
| 定价（当时） | Sonnet 比 GPT-4o 便宜，质量相当 | GPT-4o-mini 更便宜适合简单任务 |
| 上下文窗口 | 200k tokens | 128k tokens |

我选 Anthropic 是因为我用 Claude Code 做 pair programming，用同一家的模型做应用会顺手很多。两个 SDK 的结构几乎一样，切换过去大概两小时的工作。

踩坑的地方：Anthropic 的 API 当时没有 OpenAI 那样的 `json_mode`。我必须用正则（`{[\s\S]*}`）从响应里硬提取 JSON，因为 Claude 有时会把 JSON 包在一段话里。OpenAI 的 `response_format` 在这里会干净一些。

项目里用到的其他 API：

- **Notion API**（@notionhq/client）：对 Notion 数据库做完整的读写。创建页面、上传封面图片、查询重复。SDK 好用，API 本身比较慢（每次写入 3-5 秒）。
- **Pixabay API**：为语录工作室提供图片和视频背景搜索。免费额度够用。
- **Jamendo API**：语录工作室 MP4 录制时的免版权背景音乐搜索。
- **Google OAuth**（via next-auth）：处理登录。只有配置了邮箱白名单的用户能进入。

---

## AI 架构

应用用了三种方式调用 Claude。

### 1. 视觉识别——读取书封

照片进来，sharp 压缩，转 base64，发给 Claude Vision API：

```typescript
// src/lib/ai.ts
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: base64Image }
      },
      {
        type: "text",
        text: `看这本书的封面，返回 JSON：
          { title, subtitle, author, gender, country, genres[], description, quotes[] }
          类型必须从以下选择：小说 传记 回忆录 心理相关 历史 ...`
      }
    ]
  }]
})
```

Claude 读图返回结构化 JSON。Prompt 里限制了固定的类型列表，让 Notion 的标签在整个书库里保持统一。

### 2. Tool Use——Agent 流程

项目里有两套处理流程。顺序流程很直接：调 Claude、调 Notion、完成。还有一套 Agent 流程，用的是 Claude Tool Use。

```
用户上传封面
      |
Claude 收到图片 + 工具列表
      |
Claude 决定："先调用 recognize_book_from_image"
      |
工具执行，结果返回给 Claude
      |
Claude 决定："现在检查重复 check_duplicate_in_notion"
      |
工具执行，Claude 看到结果
      |
Claude 决定："没有重复，执行 upload_cover_to_notion"
      |
      ... 继续
      |
Claude 返回最终总结
```

应用给了 Claude 四个工具：

- `recognize_book_from_image`：对上传封面运行视觉识别
- `check_duplicate_in_notion`：按书名 + 作者查询数据库
- `upload_cover_to_notion`：把图片文件上传到 Notion
- `create_notion_page`：写入完整的书籍记录

Claude 自己决定调用顺序，处理中间结果，可以根据情况跳过或重试某一步。这就是"API 调用"和"Agent"的区别：模型在做决策，而不只是转换输入。

切换两套流程只需要一个环境变量：`NEXT_PUBLIC_USE_AGENT=true`。

### 3. 流式聊天——Claude 了解你的书架

聊天功能通过 SSE（Server-Sent Events）流式传输响应。Claude 可以使用和 Agent 流程相同的工具，所以它能在对话中查找你 Notion 里的书，识别你发过来的封面图片，或者直接用自己的知识聊任何一本书。

```typescript
// src/app/api/chat/route.ts
const stream = await anthropic.messages.stream({
  model: "claude-sonnet-4-6",
  messages: conversationHistory,
  tools: bookTools,
})

for await (const chunk of stream) {
  if (chunk.type === "content_block_delta") {
    controller.enqueue(`data: ${chunk.delta.text}\n\n`)
  }
}
```

聊天是双语的——读取浏览器语言请求头，自动用中文或英文回复。

语录页面展示 Claude 从每本书里提取的所有句子，可以按书或类别筛选：

![语录页面——所有提取的金句，底部是语录工作室设计器](screenshots/quotes-chat.png)

---

## 我用的 Claude Code Skills（它们到底做什么）

这块内容我没看到有人系统写过。Claude Code 有一套插件/技能系统，远不止是基础编辑器。这个项目里我用了几个，它们真实地改变了我的工作方式。

**Superpowers** 是最重要的一个。这是一个方法论插件，把 Claude 的默认行为从"立刻写代码"变成"先问清楚再动手"。开始一个新任务时，Superpowers 让 Claude 先澄清需求、确认设计方案、约定实现计划，你说 OK 之后才动任何文件。它强制执行 TDD（测试驱动）、YAGNI（不提前过度设计）、DRY（不重复代码）。全局安装：

```
/plugin install superpowers@claude-plugins-official
```

我用到的 Superpowers 子技能：
- `brainstorming`：实现之前先探索意图和需求
- `writing-plans`：写任何代码之前先生成分步计划
- `systematic-debugging`：遇到 bug 或异常行为时的结构化排查流程
- `verification-before-completion`：声称完成之前先跑验证

**graphify** 把整个代码库映射成知识图谱。跑完 `/graphify .` 之后，它生成了一个 441 节点的可交互图谱，覆盖项目里的每个文件、函数和它们之间的关系。然后可以用 `/graphify query "agent pipeline 是怎么工作的"` 来提问，它从图谱里回答，而不是线性读取文件。

![lovely-shelf 的 graphify 知识图谱——441 个节点，按模块用颜色区分](screenshots/graphify.png)

**frontend-design skill**（Anthropic 官方）解决一个具体问题：AI 生成的 UI 往往长得一模一样，因为模型每次都默认同样的视觉选择（Inter 字体、紫色渐变、卡片布局）。这个 skill 在写任何 UI 代码之前先问你审美方向：极简还是表达感强？单色还是彩色？密集还是留白大？你的回答约束了它之后会生成什么。

**awesome-design-md / DESIGN.md** 是解决同一问题的另一种方式。不每次问问题，而是选一个品牌的设计体系（Airbnb、Linear、Notion、Vercel……）放到项目根目录里。Claude 写组件的时候会自动参考它。我用的是 Airbnb 的。可以看到最终结果——整个应用的暖橙色配色和圆角卡片布局，就是从 Airbnb DESIGN.md 里来的。

**vercel-labs/agent-skills** 是 Vercel 官方的一套 Next.js 专属规范。按项目安装：

```bash
npx skills add vercel-labs/agent-skills
```

包含七个 skill，覆盖 React 最佳实践、无障碍访问、组件组合模式、Vercel 部署优化。Claude 写组件的时候会自动参考这些规范，不需要你每次手动提醒。

三个设计工具的分工：

| 工具 | 回答什么问题 | 什么时候用 |
|------|------------|----------|
| DESIGN.md | 长什么样（颜色、字体、间距） | 整个项目，全程参考 |
| frontend-design skill | 怎么在这个风格里做设计决策 | 开始新组件/页面时 |
| vercel-labs/agent-skills | 代码写得对不对 | 实现过程中 |

下面的路由地图展示了应用完整的 API 路由结构——8 个页面路由、18 个 API 接口、2 个 SSE 流式路由、1 个 Tool Use Agent：

![路由地图——应用完整的 API 路由结构](screenshots/route-map.png)

---

## HEIC：没人提但必须解决的问题

iPhone 拍出来的照片是 HEIC 格式。大多数 Web 应用直接拒绝这个格式。lovely-shelf 用三层降级处理：

```
尝试 libheif-js（WebAssembly，精度最高）
  失败？尝试 heic2any（JS 库，兼容性好）
  失败？降级到 Canvas API（最基础但通用）
```

这个问题花了整整一个下午才搞定。WebAssembly 是异步加载的，这个库没有 TypeScript 类型定义，三层的输出格式也略有差异。移动优先意味着要处理移动端实际产生的文件格式。

---

## Demo 模式——不暴露真实数据库就能演示

做演示时有个反复出现的问题：你不想让陌生人往你真实的 Notion 数据库里写数据，但又想让他们体验完整的产品。解决方案是一个特殊邮箱地址（`demo@lovely-shelf.com`）。next-auth 识别到这个邮箱时：

- Claude AI 正常运行（真实识别，真实结果）
- 所有 Notion 操作完全跳过
- 应用从硬编码的约 32 本书的数据集里读取
- Session 刷新后重置

```typescript
// 每个 API 路由在触碰 Notion 之前都检查这一条
if (session.user.email === "demo@lovely-shelf.com") {
  return Response.json(getDemoData())
}
```

访客获得真实的 AI 体验。你的 Notion 数据库完全没有被动过。一个条件，在每个路由里统一处理。

---

## 我是怎么用 Claude Code 做这个项目的

我是个初学者，在这个项目之前不懂 Next.js App Router。整个应用 7 天做完，全程用 Claude Code 做 pair programming。

第 1 天（5 月 13 日）：初始化 Next.js，安装依赖，写图片预处理函数，接 Claude Vision，写 Notion 工具函数，串通 `/api/process` 接口。

第 2 天：上传页、结果页、移动端适配、批量上传、HEIC 支持、重复检测。

第 3 天：Google OAuth、成就徽章、推荐列表、Dashboard、书籍详情 Modal（字段可编辑并回写 Notion）。

第 4 天（功能量最大的一天）：用 Tool Use 重写 Agent 后端，做聊天界面 + SSE 流式响应，Quote Studio（字体/背景/配乐），Dashboard 热力图，Demo 模式。

第 5-7 天：Bug 修复、Rate Limiting、Error Boundary、中英文 i18n、部署。

我用 Claude Code 的方式不是"帮我写这个文件"。更像是：这是我想做的事，这是我现在的代码，有什么问题、为什么。Claude 会解释概念，给出模式，然后我去实现，同时理解我在写什么。

这个项目每一段关键代码旁边都有中文注释。不是给未来的读者看的——写注释这个动作本身迫使我理解刚刚做了什么。

---

## Agent 模式 vs 顺序 API 调用

调用 AI API 和构建 AI Agent 之间的差距，没有人说的那么大，但确实存在。

顺序流程完全够用。可预测、快、好调试：

```
输入 -> Claude -> Notion -> 输出
```

Agent 流程更灵活。如果封面模糊，Claude 可能会给出置信度较低的猜测并注明；如果书已经存在，它能提前停下并说明原因。模型在做判断，不只是执行步骤。

代价：Agent 更难测试。你没办法对一个决策写单元测试。你的测试方式是跑 Agent，读它的决策过程，然后判断它对不对。

---

## 把 Notion 当数据库用

用 Notion 做后端数据库这件事被低估了。API 干净，SDK 维护活跃，而且你免费获得了一个人类可读、可编辑的数据视图。

| 字段 | 类型 | 用途 |
|------|------|------|
| 书名 | Title | 书名 |
| 作者 | Rich text | 作者 |
| 国家 | Select | 国家来源 |
| 类型 Label | Multi-select | 类型标签 |
| 封面 | Files & media | 封面图片 |
| 优美语句 | Rich text | 提取的金句 |
| 描述 | Rich text | 简介 |

Multi-select 类型字段会随着 Claude 遇到新类型自动创建新标签。封面图片直接上传到 Notion 的文件存储。整条记录写完后，你可以在 Notion 界面里直接排序、筛选、编辑。

有一个坑：Notion API 很慢。完整写入（图片上传 + 创建页面）要 3-5 秒。提前预期这个时间。

---

## 哪些地方我会做不一样

TypeScript 类型不一定有。libheif-js 没有类型定义，我手动写了一个 `.d.ts` 声明文件。这是正常情况，遇到就写。

单向流式传输用 SSE，不要上 WebSocket。WebSocket 是双向实时通信（多人游戏、协作编辑）。我见过很多初学者在 SSE 能搞定的地方选了 WebSocket，代码多了一倍，复杂度也多了一倍。

Demo 模式应该从一开始就设计进去。最后才加意味着要改每一个 API 路由。如果重来，我会把数据层抽象出来，让 demo 数据和真实数据接同一个接口。

分享给三个朋友的第二天就打到 Anthropic API 额度上限了。分享之前先加限速。

Claude Code Skills 要在项目开始时就装好，而不是快做完了才装。尤其是 Superpowers——它的价值在于塑造你在写任何代码之前的思考方式。我在快结束时才装上，当时想的是"早装就好了"。

---

## 试试看

在线 Demo：[lovely-shelf.vercel.app](https://lovely-shelf.vercel.app)

技术栈：Next.js、TypeScript、Claude Sonnet 4.6、Notion API、next-auth、Tailwind CSS、Vercel。

如果你想看一个真实的小型 AI 项目长什么样（不是教程，是实际能用的应用），这是一个合理的参考。按生产标准不算出色，但真实。

---

*2025 年 5 月，7 天做完。*
