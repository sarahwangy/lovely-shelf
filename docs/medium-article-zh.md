# 我用 7 天 Vibe Coding 做了一个 AI 全栈应用——完整记录

> 对着书的封面拍一张照，它自动出现在你的 Notion 里。

这是 **lovely-shelf** 的完整功能描述。上传一张书封图片，Claude AI 读取封面，提取书名、作者、类型、国家来源和书中金句，然后自动写入你的 Notion 数据库。不用手动输入，不用复制粘贴，只需要一张照片。

这篇文章我想讲两件事：我做了什么，以及我是怎么做的。"怎么做"才是真正有意思的部分。我是个刚入门的开发者，这整个项目是我用 Claude Code 做 pair programming，配合一套叫 Superpowers 的方法论插件，边学边建出来的。七天，一个真实能用的应用。

---

## lovely-shelf 是什么？

**[在线 Demo →](https://lovely-shelf.vercel.app)**（点"一键体验 Demo"，不需要注册账号）

![上传页面——扫描书封的入口](screenshots/showcase.png)

lovely-shelf 把书封照片变成一个带完整标签的 Notion 书库。应用分五个模块：

- **上传**：拖入书封照片，Claude 几秒内识别完成
- **看板**：类型饼图、30 天活动热力图、完整书单
- **语录**：Claude 提取的所有金句，可搜索可筛选
- **语录工作室**：把任意金句做成分享卡（导出 PNG 或录制带背景音乐的 MP4）
- **聊天**：流式 AI 助手，了解你书架上的每一本书

完整的数据流：

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

识别完成后，结果页展示 Claude 提取的内容，确认后写入 Notion：

![识别结果页——Claude 从封面提取了书名、作者、类型和简介](screenshots/prototype-result.png)

---

## 我想解决的问题

我本来就在用 Notion 记录读过的书。问题在于维护成本太高。每读完一本书，我要打开 Notion，新建一行，手打书名，手打作者，搜封面图，再把印象深的句子粘进去——最少五分钟。一年下来是多少本书？

具体的痛点：

- 手打书名容易打错字，后来筛选时就找不到
- 找封面图要另开一个浏览器标签
- 金句只有我在录入时碰巧记得才会存，不是在读到时存的
- 这些摩擦积累起来，会让我干脆跳过录入，数据库越来越不完整

我想在读书的那个当下就能关闭这个循环，而不是几小时之后。对着封面拍一张照，完事。lovely-shelf 就是这个需求的直接答案。

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
| 卡片渲染 | Satori（JSX → SVG → PNG） |
| 部署 | Vercel |

每一项都是主流标准库，没有为了"看起来高级"引入我不熟悉的东西。我在学 Next.js 的同时还要学一堆新库，所以刻意控制了技术复杂度。

---

## 用到的 API

### Anthropic Claude API

整个应用的核心。Claude 在这里承担三个角色：

- **视觉识别**：接收 base64 编码的 JPEG，返回结构化书籍元数据
- **Tool Use Agent**：通过调用四个自定义工具，以 Agent 方式编排多步流程——它自己决定调用顺序，检查中间结果，处理重复书籍等边界情况
- **流式聊天**：通过 SSE 回答关于你书架的问题，可以调用和 Agent 相同的工具集

用的模型：`claude-sonnet-4-6`。200k 的上下文窗口对聊天功能很重要——书库大到一定程度，要把所有书的信息作为上下文传进去。

唯一踩过的坑：Anthropic 当时没有像 OpenAI 那样的原生 `json_mode`。OpenAI 有 `response_format: { type: "json_object" }`，Claude 没有。我必须用正则（`{[\s\S]*}`）从响应里提取 JSON，因为 Claude 有时会把 JSON 包在一段话里。不是大问题，但要处理。

### Notion API（@notionhq/client）

对 Notion 数据库的完整读写。应用创建页面、上传封面图到 Notion 文件存储、按书名 + 作者查询重复，以及为 Dashboard 和 Chat 读取完整书库。

SDK 好用。API 本身慢——完整写入（图片上传 + 创建页面）要 3–5 秒。不是 bug，是 Notion 的基础设施现状。用加载状态来处理这个预期延迟。

### Pixabay API

语录工作室的背景图片和视频搜索。免费额度够用。通过 `/api/images` 和 `/api/videos` 路由做代理，避免 API Key 暴露在客户端。

### Jamendo API

语录工作室 MP4 录制时的免版权背景音乐。用户可以按情绪或关键词搜索曲目，选择后混入录制的视频里。

---

## AI 技术细节

这部分是我最想认真写的。不只是"调用 API"，而是用到的具体技巧。

### 1. 用 Prompt 约束实现结构化 JSON 输出

Claude 没有原生 JSON mode。要得到可靠的结构化输出，我用两种方式约束响应：告诉它要返回哪些字段，以及给 genre 字段一个固定的词汇表。

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
        text: `看这本书的封面，只返回以下格式的 JSON 对象：
{
  "title": "字符串",
  "subtitle": "字符串，没有副标题就返回空字符串",
  "author": "字符串",
  "gender": "male | female | unknown",
  "country": "字符串",
  "genres": ["数组，只能从以下选择：小说 散文 历史 哲学 心理相关 励志 政治 经济 科技 艺术 儿童读物 其他"],
  "description": "2-3 句话的简介",
  "quotes": ["2-3 条书中的经典语句"]
}
只返回 JSON，不要解释，不要 markdown。`
      }
    ]
  }]
})
```

把类型字段限制在固定词汇表里是这个设计里最关键的决定。没有这个约束，Claude 可能会把一本书标为"心理学"，另一本标为"Psychology"，第三本标为"自我成长"——然后你的 Notion 筛选器永远对不上。固定词汇表让整个书库的标签保持一致。

### 2. 容错的 JSON 解析

即使 prompt 写得很严，Claude 有时还是会在 JSON 前后加说明文字，或者带 markdown 代码块。我用三层解析来防御：

```typescript
function extractJSON(text: string): BookInfo {
  // 第一层：直接解析（Claude 表现良好时走这里）
  try {
    return JSON.parse(text)
  } catch {
    // 第二层：用正则提取 JSON 块
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        // 第三层：去掉 markdown 代码块标记
        const cleaned = text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
        return JSON.parse(cleaned)
      }
    }
    throw new Error(`无法从 Claude 响应里提取 JSON: ${text.slice(0, 200)}`)
  }
}
```

三层：直接解析、正则提取、去 markdown。全部失败就抛出带足够上下文的错误。这个模式适用于任何 AI API——Claude、GPT、随便哪个。大语言模型是文本生成器，你在从里面取结构化数据。把它当成解析用户输入，而不是解析数据库响应。

### 3. Tool Use——构建真正的 Agent

更有意思的那条流程用的是 Claude Tool Use。我不在代码里按固定顺序调用各个 API，而是给 Claude 一组工具，让它自己决定调用什么、什么时候调。

```typescript
// src/lib/agent.ts
const tools: Anthropic.Tool[] = [
  {
    name: "recognize_book_from_image",
    description: "从封面图片提取书籍元数据（书名、作者、类型、金句）",
    input_schema: {
      type: "object",
      properties: {
        image_base64: { type: "string", description: "base64 编码的 JPEG" }
      },
      required: ["image_base64"]
    }
  },
  {
    name: "check_duplicate_in_notion",
    description: "检查书籍是否已存在于 Notion 数据库",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        author: { type: "string" }
      },
      required: ["title", "author"]
    }
  },
  {
    name: "upload_cover_to_notion",
    description: "把封面图片上传到 Notion 文件存储",
    input_schema: {
      type: "object",
      properties: { image_base64: { type: "string" } },
      required: ["image_base64"]
    }
  },
  {
    name: "create_notion_page",
    description: "在 Notion 里创建新的书籍记录",
    input_schema: {
      type: "object",
      properties: {
        bookInfo: { type: "object" },
        coverUrl: { type: "string" }
      },
      required: ["bookInfo"]
    }
  }
]

// Agent 循环——一直跑到 Claude 不再调用工具为止
async function runBookAgent(imageBase64: string): Promise<AgentResult> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
        { type: "text", text: "处理这本书的封面，把它加到我的 Notion 书库里。先检查有没有重复。" }
      ]
    }
  ]

  while (true) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools,
      messages
    })

    if (response.stop_reason === "end_turn") {
      return extractFinalResult(response)
    }

    // Claude 要调工具——执行并把结果反馈回去
    const toolResults = await executeTools(response.content)
    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults }
    )
  }
}
```

和顺序流程的区别：Claude 能看到每次工具调用的结果，再决定下一步做什么。如果重复检测找到已有记录，Claude 直接停下来返回已有的页面。如果封面太模糊识别不了，Claude 可以说明原因。模型在做判断，不只是执行脚本。

### 4. 用 SSE 实现流式聊天

聊天助手通过 Server-Sent Events 逐字流式输出响应。这是单向数据流的正确工具——比 WebSocket 简单，和 Next.js Route Handler 配合开箱即用。

```typescript
// src/app/api/chat/route.ts
export async function POST(request: Request) {
  const { messages } = await request.json()

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const anthropicStream = await anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: `你是一个了解用户个人书库的 AI 助手。
                 用户的书库包含以下书籍：${JSON.stringify(libraryContext)}
                 回答关于他们阅读的问题，推荐书，讨论主题。
                 用用户写作时使用的语言来回复。`,
        messages,
        tools: bookTools
      })

      for await (const chunk of anthropicStream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`))
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  })
}
```

System prompt 把用户的书库作为上下文注入进去。这是最简单的 RAG——没有向量数据库，没有 Embedding，就是 JSON。能用是因为个人书库足够小，放得进 Claude 的 200k 上下文窗口。如果数据量更大，就需要真正的语义搜索了。

### 5. 图片预处理流程

手机拍出来的照片体积大，格式还经常是 HEIC。发给 Claude 之前要先处理：

```typescript
// src/lib/image.ts
import sharp from "sharp"

export async function preprocessImage(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(1200, 1200, {
      fit: "inside",            // 保留宽高比
      withoutEnlargement: true  // 小图不放大
    })
    .jpeg({ quality: 85 })      // 质量够用，体积可控
    .toBuffer()

  return processed.toString("base64")
}
```

这个函数做两件事：把图片控制在 Anthropic 的大小限制内，以及避免把 12MB 的 iPhone 原图直接发出去增加 API 成本。Claude 识别书封不需要全分辨率——1200px 读标题完全够。

HEIC 支持需要三层降级，因为没有任何单一库能可靠处理所有设备的输出：

```
尝试 libheif-js（WebAssembly，精度最高）
  失败？→ heic2any（JS 库，兼容性更广）
  失败？→ Canvas API（最基础，所有设备都支持）
```

---

## Vibe Coding 的工作流程

这部分是我希望开始之前就能读到的。我用 Claude Code 配合 **Superpowers** 方法论插件来构建这个项目。下面是这套工作流实际长什么样。

### 用到的技能

**`superpowers:brainstorming`** — 在写任何代码之前，每遇到不简单的功能我都会先触发这个。它会问问题：用户目标是什么？边界情况有哪些？最简单能跑通的版本是什么样？只有经过这段对话，我才开始想实现。

**`superpowers:writing-plans`** — 把设计讨论转换成有文件路径、函数签名和代码片段的具体实现计划。这份计划就是合同。如果我偏离了，先更新计划，再继续。

**`superpowers:subagent-driven-development`** — 每个任务作为独立的子 Agent 运行，拥有干净的上下文，不受之前任务的干扰。每个任务完成后，会有两个审查者：规格合规审查（我们做了计划里说要做的事吗？）和代码质量审查（代码干净吗？）。

**`superpowers:systematic-debugging`** — 出 bug 时，这个技能强制先做根因分析，再提修复方案。不打补丁，找根本原因。我用了三次：HEIC 转换问题、流式传输竞态条件、Notion 限流。

**`superpowers:verification-before-completion`** — 声称任务完成之前，必须跑实际的验证命令。避免了两次"在我机器上能跑"的 bug 进入代码库。

**`superpowers:frontend-design`** — 在写任何 React 代码之前先生成 HTML 原型，在浏览器里预览。这是"AI 默认生成的 UI"和"看起来真的有设计过的 UI"之间的差异所在。

### 实例：语录工作室功能的完整流程

以下是语录工作室功能从想法到代码的全程，就是这套工作流的实际样子。

**第一步——头脑风暴。** 我用 `superpowers:brainstorming` 发起了这个讨论："我想让用户把金句做成可分享的图片卡片。" 头脑风暴过程里浮出了我没想到的问题：输出格式是什么？（PNG，不只是截图。）需要支持视频背景吗？（要，而且要带音乐。）非系统字体怎么处理？（生成卡片时加载。）Pixabay 挂了的 fallback 是什么？（纯色渐变。）

**第二步——写计划。** `superpowers:writing-plans` 生成了这份文件列表：
```
src/app/quotes/page.tsx              — 底部加 QuoteStudio 面板
src/components/QuoteCard.tsx         — 卡片渲染器（Satori）
src/app/api/generate-card/route.ts   — POST 接口，返回 PNG
src/app/api/images/route.ts          — Pixabay 代理
src/app/api/music/route.ts           — Jamendo 代理
```

每个文件都有描述的接口，不只是文件名。计划里明确了 Satori 在服务端把 JSX 渲染成 SVG，再转成 PNG。这个架构决策在计划里，不是实现到一半才发现的。

**第三步——子 Agent 开发。** 每个文件作为独立任务运行。卡片渲染器是一个任务，API 路由是另一个，UI 集成是第三个。规格合规审查在每个任务完成后检查它和计划的对应关系，再开始下一个。这个过程发现了一个偏差：第一版卡片渲染器把 PNG 转换放在了客户端，而计划里明确写的是服务端。

**第四步——代码质量审查。** 所有任务完成后，质量审查标记出一个重复的字体加载代码块，在卡片渲染器和聊天页面里各存在一份。提取到 `src/lib/fonts.ts`，两处都改成 import。

**第五步——验证。** `superpowers:verification-before-completion` 跑了完整的导出流程：进语录页，配置卡片，点导出，确认 PNG 下载了，确认尺寸对。不是"我觉得应该能用"——是实际命令跑出来的结果。

整个功能大概花了四小时。其中一半在头脑风暴和写计划。代码本身写得快，是因为决策已经做完了。

---

## 应用各页面

### 上传页

入口。拖拽或点击选择，支持多文件批量处理，每个文件有独立进度条。HEIC 图片在上传前在浏览器里完成转换。识别完成后，确认页展示 Claude 提取的内容——你看完确认才写入 Notion。结果页显示成就徽章（"你的第 14 本小说！"）和一排同类推荐书。

### 看板

书库概览。类型分布饼图（Recharts）、30 天活动热力图展示加书时间分布、总数量和今年新增。全部书封以缩略图网格展示——点任意一本打开详情 Modal，实时从 Notion 取数据，所有字段可直接编辑。

### 语录页

Claude 从书库里每一本书提取的所有句子。四个标签页：全部、手写（自己添加的）、书库语录（AI 提取的）、已收藏。每页 10 条，分页翻看。收藏状态存在 localStorage 里。也可以手动添加自己的语录，显示在手写标签页下。

### 语录工作室

把任意金句做成分享卡。控制项：字体系列、大小、颜色，背景（纯色、渐变、Pixabay 图片、Pixabay 视频），排版，emoji 插入。导出 PNG 或录制 5 秒 MP4，混入 Jamendo 背景音乐。每条语录的样式配置存在 localStorage 里，下次再来看同一条语录时样式还在。

### 聊天页

基于 SSE 的流式 AI 助手。通过 system prompt 注入完整书库上下文，知道你架子上每一本书。可以让它按类型推荐书，找某个主题下的金句，或者聊书架上的任意一本。也可以在对话中途发一张书封图片，它会识别这本书。根据浏览器语言请求头自动用中文或英文回复。

---

## 实例：一次完整的书籍识别流程

上传一张书封照片时，完整的执行序列是这样的：

1. **客户端**：文件拖入上传区，读成 ArrayBuffer
2. **HEIC 检测**：如果是 HEIC 格式，三层转换流程在上传前跑完
3. **POST /api/process**：预处理后的图片发到服务器
4. **sharp**：压缩到 ≤1200px，转 JPEG，编码为 base64
5. **Claude Vision**：base64 图片 + 文字 prompt 发给 `claude-sonnet-4-6`
6. **JSON 提取**：用三层容错解析器处理响应
7. **Notion 查询**：按书名 + 作者检查是否已存在
8. **如果是新书**：上传封面图到 Notion 文件存储，创建包含所有字段的页面
9. **成就查询**：统计同类型书数量，返回徽章文案
10. **推荐**：获取 5 本有重叠类型的书
11. **返回客户端**：`{ bookInfo, pageUrl, stats, recommendations }`

首次上传整个往返要 8–12 秒。大部分时间在 Notion（写入 3–5 秒）。Claude 本身 3 秒内响应。

Demo 模式下，第 7 到第 10 步替换为从硬编码数据集读取。Claude 正常运行。识别结果是真实的。

---

## 我学到了什么

**1. Agent 只是一个结构化的 while 循环。** 说"Agent"听起来很高级，但它就是一个循环：调 Claude，执行 Claude 要调的工具，把结果反馈回去。有意思的部分是 Claude 在做顺序决策。理解了这个循环模式之后，Agent 代码实际上比顺序版本还要简单。

**2. Demo 模式是架构决策，不是事后补丁。** 我在第五天才加 Demo 模式，意味着要改所有 API 路由。如果第一天就想到，我会在数据层抽象一个接口，根据 session 邮箱切换实现。两种都能用，一种更干净。

**3. 分享之前先加限速。** 我给三个朋友发了链接测试，第二天早上就打到 Anthropic API 额度上限了。加一个简单的内存计数器或者 `express-rate-limit` 要三十分钟。在告诉任何人 URL 之前就加上。

**4. SSE 是流式传输的正确工具，不是 WebSocket。** WebSocket 是双向实时通信——多人游戏、协作编辑。SSE 是服务端推流。聊天功能不需要客户端在对话中途推数据，它需要的是服务端在 Claude 生成时推文字。SSE 大概 20 行代码搞定。WebSocket 要单独搭服务。

**5. 计划阶段不是额外开销，它就是主要工作。** 用 Superpowers，我大概花了 30% 的时间在写代码之前做头脑风暴和计划。第一次感觉效率很低。到了第四天我才明白：每小时的计划能省掉两小时的重构。语录工作室整个功能四小时做完。HEIC 支持（没有计划直接写代码的）花了一整个下午加三次重写。

---

## 试试看

在线 Demo：[lovely-shelf.vercel.app](https://lovely-shelf.vercel.app)

GitHub：[github.com/sarahwangy/lovely-shelf](https://github.com/sarahwangy/lovely-shelf)

技术栈：Next.js、TypeScript、Claude Sonnet 4.6、Notion API、next-auth、Tailwind CSS v4、Vercel。

这不是一个教程项目。它是我实际在用来记录阅读的应用。Demo 按钮给你真实的 Claude AI 识别——把手边任何一本书的封面对着摄像头拍一下，它会告诉你它看到了什么。实体书照片、Kindle 截图、清晰的书脊图片，都能识别。

如果你是刚入门的开发者，在考虑做一个 AI API 项目，我最想让你从这篇文章带走的一件事是：AI 集成本身不是最难的部分。最难的部分和其他所有 Web 应用一样——认证、错误处理、Demo 模式、限速、部署。Claude 的 API 文档很完善，SDK 结构清晰。一个周末就能有可以运行的原型。

---

*2025 年 5 月，7 天做完。技术栈：Next.js App Router、TypeScript、Claude Vision + Tool Use + 流式传输、Notion API、Vercel。*
