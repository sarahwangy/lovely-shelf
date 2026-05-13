# Lovely-Shelf 学习笔记

---

### T05 - 图片预处理工具函数

- **学到的核心概念：**
  - `async/await`：处理耗时操作（图片读取/转换）的标准写法，`await` 表示"等这步完成再往下走"
  - `Buffer`：Node.js 里表示二进制数据（图片、文件）的对象，行业通用
  - `base64`：把二进制数据编码成纯文字字符串的方式，Claude API 要求图片用这个格式传输

- **用到的关键 API/函数：**
  - `sharp(input).resize().jpeg().toBuffer()`：图片处理的标准三步链式调用
  - `buffer.toString("base64")`：Node.js 内置，Buffer 转 base64 字符串
  - `statSync(path).size`：同步读取文件大小（字节数）

- **容易踩的坑：**
  - HEIC 格式需要 `libheif` 带 HEVC 解码器，`sharp` 默认不包含，本机测试失败——留到 T14 专门处理
  - `toBuffer()` 输出到内存而非磁盘，Vercel 云函数环境里必须这样做

- **一句话总结：**
  用 `sharp` 把任意图片标准化成"1600px 宽、JPEG 85 质量"的内存数据，为后续发给 Claude API 做准备。

---

### T06 - AI 视觉识别函数

- **学到的核心概念：**
  - `system prompt`：给 AI 的"岗前培训"，锁定它的角色和输出格式，行业标准做法
  - 多模态消息：Claude API 的 `messages` 数组可以同时包含图片（base64）和文字，这叫"多模态"
  - 环境变量加载：Next.js 自动读 `.env.local`，但独立脚本需要用 `--env-file=.env.local` 手动加载

- **用到的关键 API/函数：**
  - `client.messages.create()`：Anthropic SDK 的核心调用，传 model/system/messages 三个参数
  - `response.content[0].text`：从 API 返回中取出文字内容
  - `JSON.parse()`：把字符串解析成 JS 对象，解析失败会抛错，需要 try/catch

- **容易踩的坑：**
  - Claude 有时会在 JSON 外面套 ` ```json ``` `，需要用正则把它剥掉再 parse
  - `--env-file` 是 Node.js 20.6+ 的内置功能，老版本不支持（需改用 `dotenv` 包）

- **一句话总结：**
  用精心设计的 system prompt 把 Claude 变成"书籍信息提取机器"，锁定它只输出 JSON，再 parse 成 TypeScript 类型安全的对象。

---

### T07 - Notion 写入函数

- **学到的核心概念：**
  - `as const` + `(typeof X)[number]`：从数组自动派生联合类型，改预设选项只改数组，类型自动跟着变
  - 计算属性名 `[NOTION_FIELDS.title]`：用变量做对象的 key，字段名改动只需改一处
  - Notion 文件上传是两步：先 POST 拿上传地址，再 PUT 发图片内容（SDK 类型不支持，用 fetch 直调）

- **用到的关键 API/函数：**
  - `notion.pages.create({ parent, properties })`：在数据库里创建一行
  - `notion.databases.retrieve()`：查询数据库字段结构（调试用）
  - `CreatePageParameters["properties"]`：从 SDK 导入 properties 的正确类型

- **容易踩的坑：**
  - Title 字段格式是 `{ title: [{ text: { content } }] }`，和普通 Text 不一样
  - 普通文本字段的 API key 是 `rich_text`，不是 `text`
  - `NOTION_DATABASE_ID` 要填 URL 里 `?v=` 前面那段，不是整个 URL，也不是 `?v=` 后面的视图 ID
  - `fetch` 的 body 不接受 Node.js `Buffer`，需要转成 `new Uint8Array(buffer)`

- **一句话总结：**
  通过字段映射常量 + 计算属性名，让 Notion 写入代码既类型安全又易维护，字段名改动只需改一处。

---

### T08 - 端到端脚本（阶段 1 里程碑）

- **学到的核心概念：**
  - 端到端脚本：把多个独立函数串成一条链路，每步计时，出错时定位到哪步失败
  - `multipart/form-data`：上传文件的标准 HTTP 格式，用 `FormData` + `Blob` 构造，不能手动设 `Content-Type`（fetch 自动加 boundary）
  - 调试思路：先单独测每一步的 API 返回值，而不是猜测

- **用到的关键 API/函数：**
  - `FormData` + `Blob`：Node.js 18+ 内置，构造 multipart 请求体
  - `new Uint8Array(buffer)`：Node Buffer → 标准 Web API 兼容类型的转换

- **容易踩的坑：**
  - Notion 文件上传第二步的 `upload_url` 是 Notion 自己的端点（`/send`），需要带 Authorization 头，不是 S3 匿名上传
  - `FormData` 发文件时不能手动写 `Content-Type: multipart/form-data`，否则 boundary 会丢失导致解析失败

- **一句话总结：**
  阶段 1 里程碑达成：一张图片经过预处理→Claude识别→Notion上传→数据库写入，全链路约 6 秒跑通。

---

### T09 - 后端 API POST /api/process

- **学到的核心概念：**
  - Next.js Route Handler：文件放在 `app/api/xxx/route.ts`，导出函数名就是 HTTP 方法（POST/GET），框架自动变成 URL 端点
  - HTTP 状态码分层：400 参数错误、422 业务逻辑失败、500 服务器异常，行业标准
  - 两个世界的桥梁：浏览器用 `File`/`ArrayBuffer`，Node.js 用 `Buffer`，中间需要 `Buffer.from(arrayBuffer)` 转换

- **用到的关键 API/函数：**
  - `request.formData()`：Web 标准 API，自动解析 multipart/form-data
  - `file.arrayBuffer()`：把 File 对象读成二进制数据
  - `NextResponse.json(data, { status })`：返回 JSON 响应，Next.js 封装了原生 Response

- **容易踩的坑：**
  - curl 测试时不带 `-F` 参数直接 POST 会报 Content-Type 错误，这是正常的——接口只接受 multipart
  - AI 识别失败要单独捕获并返回 422，不能和其他错误混在一起，否则前端无法区分"识别失败可重试"和"服务器崩了"

- **一句话总结：**
  Route Handler 是 lib/ 工具函数和前端之间的"服务员"，自己不做业务逻辑，只负责接单、转发、返回结果。
