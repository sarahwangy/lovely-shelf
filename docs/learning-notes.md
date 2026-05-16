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

---

### T10 - 上传页 src/app/page.tsx

- **学到的核心概念：**
  - `"use client"`：告诉 Next.js 这个组件在浏览器运行，默认所有组件在服务端渲染，有交互就必须加这个
  - `useState`：React 状态管理，每次 state 变化会重新渲染组件，是前端响应式的基础
  - `useCallback`：包住函数防止每次渲染都重新创建，性能优化的行业惯例
  - `URL.createObjectURL(file)`：把本地文件变成临时预览 URL，不上传到服务器，浏览器内存里的魔法

- **用到的关键 API/函数：**
  - `useRef`：拿到 DOM 元素（这里用来触发隐藏的 file input 点击）
  - `useRouter` + `router.push("/result")`：Next.js 的客户端路由跳转
  - `localStorage.setItem(key, JSON.stringify(data))`：跨页面传递数据，比 URL 参数适合传大对象
  - `FormData.append("image", file)`：构造 multipart 请求体，和后端 route.ts 的字段名对应

- **容易踩的坑：**
  - 拖拽区域的 `dragover` 事件必须 `e.preventDefault()`，否则 `drop` 事件不会触发（浏览器默认行为是拒绝拖入）
  - `setItems` 用函数式更新 `prev => ...` 而不是直接读 `items`，避免异步循环里读到过时的 state
  - 文件 input 的 `onChange` 要重置 `e.target.value = ""`，否则选同一张图第二次不触发

- **一句话总结：**
  上传页是纯前端交互：文件选择→本地预览→逐张调用 API→实时更新状态→存结果跳转，完整体现了 React 状态驱动 UI 的思维方式。

---

### T11 - 结果页 src/app/result/page.tsx

- **学到的核心概念：**
  - SSR 与 `useEffect`：Next.js 组件默认在服务器渲染，服务器没有 `localStorage`/`window`，凡是用到浏览器 API 的代码必须放进 `useEffect` 里，等组件挂载到浏览器后才执行
  - `loaded` 状态防闪烁：初始时数据还没加载，空数组不代表"真的没数据"，用一个 `boolean` 标志区分"未加载"和"加载完但结果为空"
  - blob URL 的生命周期：`URL.createObjectURL()` 生成的 `blob:` 地址只存在于当前标签页的内存里，刷新页面后会失效——这是浏览器的设计，不是 bug

- **用到的关键 API/函数：**
  - `localStorage.getItem(key)` + `JSON.parse()`：读取跨页面传递的数据
  - `useEffect(() => {...}, [])`：空依赖数组 `[]` 表示只在组件首次挂载时执行一次
  - `img` 的 `onError`：图片加载失败时的降级处理（blob 失效时隐藏而不是显示破图）

- **容易踩的坑：**
  - 不能在组件顶层直接写 `localStorage.getItem()`，必须在 `useEffect` 里，否则服务端渲染报错
  - blob URL 刷新后失效：如果要支持刷新后还能看到封面，需要用真实的图片 URL 而非 blob

- **一句话总结：**
  结果页的核心挑战是"服务端不知道浏览器的事"——用 `useEffect` + `loaded` 标志优雅解决 SSR 和客户端数据读取的时序问题。

- **测试中发现并修复的 Bug：**

  **Bug 1：stale closure（过时闭包）导致所有结果显示"识别失败"**
  - 现象：API 明明成功了，结果页全部显示错误
  - 原因：`handleProcess` 函数是异步的，`updateItem` 会调用 `setItems` 更新 state，但 state 更新是异步的。循环结束后直接读 `items.map(...)` 拿到的是函数创建时的旧快照，所有 item 还是 `"pending"` 状态
  - 修法：在循环内每处理完一张就 push 进 `collectedResults` 数组，不依赖 `items` state
  - 行业常识：React 的 state 是快照而非引用——在闭包（async 函数、setTimeout、事件回调）里读 state 变量，永远拿到的是该函数创建时的版本

  **Bug 2：Claude 返回 JSON 内部含未转义双引号，导致解析失败**
  - 现象：`"description": "...播客\"Two Peas\"。"` — `"Two Peas"` 的引号破坏了 JSON 格式
  - 修法 1：system prompt 明确禁止字符串值内出现英文双引号
  - 修法 2：用 `rawText.match(/\{[\s\S]*\}/)` 贪婪提取 JSON 对象，比正则替换代码块标记更健壮
  - 行业常识：AI 输出永远不要 100% 信任格式，解析层要做防御，`[\s\S]*` 是匹配"包括换行符在内的所有字符"的惯用写法

---

### T12 - 基础样式 + 移动端适配

- **学到的核心概念：**
  - `viewport` meta 标签：告诉手机浏览器"按设备真实宽度渲染，不要缩放"，是所有移动端 Web 的必备配置
  - `safe-area-inset`：iPhone X 之后有刘海和 Home Bar，`env(safe-area-inset-bottom)` 是 iOS Safari 提供的 CSS 变量，用来让内容避开底部遮挡区
  - `viewportFit: "cover"`：配合 safe-area-inset 使用，让页面先铺满全屏（包括刘海区），再用 padding 把内容推回安全区

- **用到的关键 API/函数：**
  - Next.js `export const viewport: Viewport`：Next.js 13+ 推荐的 viewport 配置方式，比在 `<head>` 里手写 `<meta>` 更类型安全
  - `calc(1.5rem + env(safe-area-inset-bottom))`：用 `calc()` 把固定间距和动态安全区叠加，桌面端 `env()` 值为 0 所以不影响桌面布局
  - Tailwind `line-clamp-3`：CSS 多行截断，底层是 `-webkit-line-clamp`，Tailwind 封装后一个 class 搞定

- **容易踩的坑：**
  - 手机触摸目标至少要 44px（Apple HIG）/48dp（Android），小于这个尺寸用户点不准——用 `py-2` / `p-3` 撑开点击区，不是靠加大字号
  - `viewportFit: "cover"` 必须配合 `safe-area-inset` 一起用，单独用会让内容被刘海遮住
  - 测移动端最快方法：Chrome DevTools → 左上角手机图标切设备视图，不用每次真机测

- **一句话总结：**
  移动端适配的核心是两件事：告诉浏览器"按真实尺寸渲染"（viewport），以及"把内容推离系统 UI 遮挡区"（safe-area-inset）。

---

### T13 - 批量并发上传

- **学到的核心概念：**
  - `Promise.all([])`：接受一个 Promise 数组，同时触发所有请求，等最慢那个完成才继续——就像同时下单 3 个外卖，而不是一个送到了再点下一个
  - 分批并发（batch concurrency）：不是无限并发，而是每批固定数量（这里是 3），一批全完成再开下一批，防止触发 API 限流（429 Too Many Requests）
  - 固定长度数组保顺序：`new Array(n)` 预分配槽位，每个并发任务按自己的 `index` 写入，保证结果顺序和上传顺序一致；如果用 `push`，谁先完成谁先进，顺序会乱

- **用到的关键 API/函数：**
  - `Promise.all(batch.map(...)))`：把一批 FileItem 各自的异步处理函数并发执行
  - `array.slice(i, i + BATCH_SIZE)`：把大数组切成固定大小的批次，`slice` 不改原数组
  - `items.filter(i => i.status === "processing").length`：实时统计正在处理的张数，用于 UI 显示

- **容易踩的坑：**
  - `Promise.all` 里任何一个 reject 会导致整批失败——所以每个 `processOne` 内部必须自己 `try/catch`，把错误转成正常返回值，不能让异常冒出去
  - 不加分批直接全部并发：上传 20 张图同时打 20 个 API 请求，触发限流，反而全部失败
  - `completedCount += 1` 在多个并发任务里同时执行是安全的，因为 JavaScript 是单线程的——不会出现两个任务同时读写同一个变量的竞态问题（这点和 Go/Java 的多线程不同）

- **一句话总结：**
  `Promise.all` + 分批切片，把串行"排队等候"变成并发"批量处理"，理论上速度提升倍数 ≈ 批次大小（3 张并发约快 3 倍）。

---

### T14 - HEIC 格式支持（前端转码）

- **学到的核心概念：**
  - 动态 import（`await import("库名")`）：用到时才把库加载进来，不打进首屏 JS 包——对只有部分用户才用到的功能（比如 HEIC 转换），这是行业标准做法
  - `Blob` vs `File`：`heic2any` 返回 `Blob`（纯二进制数据），`File` 是 `Blob` 的子类，多了 `name` 和 `type` 属性。`new File([blob], name, { type })` 可以把 Blob 升级成 File
  - 前端转码 vs 后端转码：HEIC 解码依赖系统级别的 codec（`libheif`），Node.js/Vercel 环境不保证有，放在浏览器端转更稳——浏览器本身就支持解码 HEIC（iOS Safari 原生支持）

- **用到的关键 API/函数：**
  - `file.type`：MIME 类型，HEIC 是 `"image/heic"` 或 `"image/heif"`；但部分系统上 HEIC 文件的 `type` 是空字符串，所以要同时检查扩展名
  - `file.name.toLowerCase().endsWith(".heic")`：扩展名检测，兜底 MIME 类型为空的情况
  - `Array.isArray(result)`：`heic2any` 对 Live Photo 返回数组、普通照片返回单个 Blob，两种情况都要处理

- **容易踩的坑：**
  - HEIC 文件在 Windows/Android 上 `file.type` 可能是空字符串（系统不识别这个 MIME 类型），所以必须同时判断扩展名
  - `heic2any` 是浏览器端库，不能在 Node.js 里用（SSR 会报错）——用 `dynamic import` 确保只在浏览器执行
  - `useCallback` 内部用了 `convertIfHeic`，但 `convertIfHeic` 没放在 `useCallback` 的依赖数组里——加了 `eslint-disable` 注释，因为 `convertIfHeic` 是纯函数，不依赖任何 state，引用永远不变

- **一句话总结：**
  HEIC 转码放前端做比放后端更可靠——浏览器原生支持解码，不依赖服务器环境，转完再发给后端只是普通 JPEG。

---

### T15 - 重复检测

- **学到的核心概念：**
  - SDK breaking change 的排查方式：`Object.keys(client.databases)` 直接看实例有哪些方法，比翻文档快——Notion SDK v5 把 `databases.query` 移到了 `dataSources.query`，参数名也从 `database_id` 改为 `data_source_id`
  - `page_size: 1` 性能优化：查重只需知道"有没有"，不需要全量结果，找到一条就停，省流量省时间
  - 在哪一步查重很重要：必须在 AI 识别完（拿到书名+作者）之后、Notion 写入之前，太早没有数据，太晚已经写进去了

- **用到的关键 API/函数：**
  - `notion.dataSources.query({ data_source_id, filter: { and: [...] }, page_size: 1 })`：组合过滤器查询
  - `filter: { and: [条件1, 条件2] }`：Notion 的 AND 筛选，书名+作者都匹配才算重复
  - `res.results.length === 0`：判断是否有查询结果

- **容易踩的坑：**
  - SDK 版本升级可能有 breaking change：不要直接套老教程的 API 路径，先 `console.log(Object.keys(client))` 确认
  - 查重只按"书名+作者"匹配，同名不同作者不算重复，同作者不同书名也不算——这个逻辑要和 Notion 里的数据保持一致
  - 已存在的旧数据（含错误格式）不会自动修复，需要手动在 Notion 里处理

- **同期修复的 Bug：gender/country 字段不一致**
  - 现象：Notion 里有的是"男/女"，有的是"male/female"
  - 原因：system prompt 里 `"作者性别或null"` 没有给枚举，Claude 根据书的语言自由发挥
  - 修法：改为 `"男 或 女 或 null"`，country 也给出预设 8 个国家让 Claude 从中选
  - 原则：**能给枚举就给枚举，不要依赖 AI 自己决定格式**

- **一句话总结：**
  重复检测的核心是"在正确的时机查一次 Notion"，配合 `page_size: 1` 做到最小代价的存在性判断。

---

### T16 - 日志和错误处理

- **学到的核心概念：**
  - 结构化日志：每条日志包含 `[时间戳] [模块] 步骤 状态 耗时`，而不是随意 `console.log("done")`。有了结构，Vercel 后台可以按关键字过滤，定位问题从"大海捞针"变成"ctrl+F"
  - `/api/health` 健康检查接口：部署平台（Vercel、K8s）定期 GET 这个接口，200 = 服务正常。检查环境变量是否齐全是最轻量的健康检查——环境变量缺一个，所有请求都会失败
  - 计时模式 `const t = Date.now()` → `Date.now() - t`：在每一步前记录时间，步骤完成后算差值，是 Node.js 服务端打印耗时的最简单方式

- **用到的关键 API/函数：**
  - `new Date().toISOString()`：生成 `2026-05-14T10:30:00.000Z` 格式的时间戳，行业标准，时区统一（UTC），便于跨时区团队排查问题
  - `process.env[key]`：用变量做属性名访问环境变量，等同于 `process.env.KEY`，但支持动态 key
  - `console.error` vs `console.log`：错误用 `error`，Vercel 后台会按级别分类显示，方便过滤

- **容易踩的坑：**
  - 日志里不要打印完整的 API Key 或 Token，即使在服务端日志里也是安全风险
  - `health` 接口检查的是"环境变量存在"，不是"API Key 有效"——要真正验证 Key 需要实际调用 API，太慢，不适合做健康检查

- **一句话总结：**
  好的日志是"时间戳 + 步骤 + 耗时 + 状态"四件套，让线上问题从"不知道哪步出错"变成"一眼看出哪步慢了多少毫秒"。

---

### T18 - HEIC 格式支持（WebAssembly 前端转码）

- **学到的核心概念：**
  - WebAssembly（WASM）：把 C/C++ 代码编译成浏览器能运行的二进制格式，性能接近原生。`libheif-js` 就是把 C 写的 libheif 库编译成 WASM，让 Chrome 也能解码 iPhone 的 HEIC 格式
  - 编解码器依赖：HEIC 是"容器格式"，里面可以用不同编码方式（AVC/HEVC）。iPhone 默认用 HEVC（H.265），这是一种更高效但需要专门解码器的格式。`heic2any` 只支持旧格式，`libheif-js` 支持 HEVC
  - 动态 import：`await import("libheif-js/wasm-bundle")` 只在浏览器真正需要时才下载这个大包（~2MB WASM），而不是页面一加载就全部下载。这是"按需加载"的行业惯例
  - `wasm-bundle` vs `wasm`：前者把 WASM 二进制内嵌在 JS 文件里（base64），打包工具不需要特殊配置；后者是动态加载 `.wasm` 文件，需要配置 webpack/Next.js 才能处理

- **用到的关键 API/函数：**
  - `new libheif.HeifDecoder()` → `decoder.decode(uint8Array)`：把 HEIC 字节流解码成图片对象数组
  - `image.get_width()` / `image.get_height()`：读取解码后图片的尺寸
  - `image.display(imageData, callback)`：把解码后的像素写入 `ImageData`（回调式异步 API，用 Promise 包装）
  - `ctx.createImageData(w, h)` + `ctx.putImageData()`：Canvas 2D API，把原始像素数组渲染到画布
  - `canvas.toBlob("image/jpeg", 0.9)`：Canvas 内容导出为 JPEG Blob

- **容易踩的坑：**
  - `libheif-js` 没有 TypeScript 类型定义，需要手动创建 `.d.ts` 声明文件（`declare module 'libheif-js/wasm-bundle'`）才能通过 `tsc` 检查
  - `image.display()` 的回调如果收到 `null` 表示失败，需要用 `result ? resolve() : reject()` 来区分
  - 三道 fallback 的顺序很重要：libheif-js（WASM，主力）→ heic2any（轻量，旧格式）→ Canvas decode（Safari 原生）

- **一句话总结：**
  HEIC 支持的核心是"用 WebAssembly 把 C 库搬进浏览器"——libheif-js 把 libheif 打包成 WASM，让 Chrome 也能解码 iPhone 的 HEVC 格式，前端转好 JPG 再上传，后端从此只见 JPEG。

---

### T20 - 入库后同类书计数提示

- **学到的核心概念：**
  - 游标分页（Cursor Pagination）：Notion API 不直接返回总数，每次查询最多返回 100 条，如果 `has_more: true` 就用 `next_cursor` 再查下一页，循环直到 `has_more: false`。这是行业通用的分页模式，PostgreSQL、GitHub API、Stripe API 都用类似设计
  - 数据流向（单向）：后端计算 `stats` → 放入 API JSON → 前端 `processOne` 捕获 → 存入 `localStorage` → 结果页读取渲染。数据只向下流，不反向，这是 React 的核心设计原则
  - 顺序很重要：必须先 `createBookPage`（写入）再 `countBooksByGenre`（查询），这样新书已包含在计数里，顺序反了计数会少 1

- **用到的关键 API/函数：**
  - Notion REST `databases/{id}/query` + `filter.multi_select.contains`：筛选某个 multi-select 字段包含特定值的所有页面
  - `has_more` + `next_cursor`：Notion 分页的两个关键字段，`has_more` 是布尔值，`next_cursor` 是下一页的起点 ID
  - `do { ... } while (cursor)`：先执行一次再判断条件，适合"至少查一次"的分页场景，比 `while` 更简洁
  - JSX 条件渲染：`{stats && <div>...</div>}` 当 `stats` 为 `null/undefined` 时整个块不渲染

- **容易踩的坑：**
  - Notion API 查询结果不按创建顺序排，计数用 `results.length` 累加而非读某个 total 字段
  - `countBooksByGenre` 查询失败时返回已累计的数量而非抛错——这是"降级处理"，让主流程（入库）不因为次要功能（计数）失败而中断，行业里叫"graceful degradation"
  - `stats` 在 `genres` 为空时为 `null`，前端要用 `{stats && ...}` 保护，不能直接 `stats.primaryGenre`

- **一句话总结：**
  游标分页 + 先写后查 + 数据单向流动，三个模式叠在一起，就实现了"第 X 本 XX 类"这个让用户有成就感的小功能。

---

### T20.5 - Google OAuth 登录 + 邮箱白名单

- **学到的核心概念：**
  - OAuth 2.0 流程：用户点登录 → 跳到 Google → Google 验证身份 → 带着"授权码"跳回你的网站 → 后端用授权码换 token → 建立 session。整个过程你的服务器从没碰到用户的 Google 密码
  - next-auth v5 的三层保护：① `proxy.ts` 拦截页面请求（未登录跳 /login）、② `authorized` callback 控制是否放行、③ `signIn` callback 控制哪些账号能登录、④ API route 里手动 `auth()` 检查（双保险）
  - Server Action：`"use server"` 标记的代码块在服务端执行，浏览器看不到代码内容，适合触发登录这类"只能服务端做"的操作
  - 环境变量不写死在代码里：白名单邮箱放在 `AUTH_ALLOWED_EMAILS`，Client Secret 放在 `AUTH_GOOGLE_SECRET`，代码推到 GitHub 也不会泄露

- **用到的关键 API/函数：**
  - `NextAuth({ providers, callbacks, pages })`：一次配置搞定 OAuth、session 管理、回调处理
  - `callbacks.authorized({ auth })`：proxy 层的守门员，`auth` 为 null 时返回 false → 自动跳登录页
  - `callbacks.signIn({ user })`：OAuth 成功后的账号过滤，这里做邮箱白名单检查
  - `export { auth as proxy }`：Next.js 16 把 middleware 改名为 proxy，功能完全一样，只是文件名和导出名变了
  - `auth()` 在 route handler 里调用：服务端检查当前 session，返回 null 就是未登录

- **容易踩的坑：**
  - **next-auth v5 环境变量名变了**：v4 用 `GOOGLE_CLIENT_ID`，v5 用 `AUTH_GOOGLE_ID`（规律是 `AUTH_{PROVIDER}_ID`）。填了旧名字，client_id 是 undefined，Google 返回 "invalid_client"
  - **Next.js 16 把 middleware 改名为 proxy**：文件名必须是 `proxy.ts`，导出必须是 `proxy` 或 default export，旧的 `middleware.ts` 会有废弃警告且不生效
  - **`authorized` callback 是触发重定向的关键**：不加这个 callback，`auth as proxy` 默认放行所有请求，什么保护都没有
  - **Client Secret "invalid"**：Client ID 对了 Google 会跳回来，但 Secret 错了会在 callback 时报 `invalid_client`——两个错误表现不同，可以据此判断是哪个值出问题

- **一句话总结：**
  OAuth 登录的核心是"把身份验证外包给 Google"——next-auth 负责和 Google 握手、管理 session，我们只需要配置"谁能进来"（`signIn` callback + 邮箱白名单），整个密码相关的逻辑完全不用自己写。

---

### T21 - 入库后同类书推荐

- **学到的核心概念：**
  - `Promise.all([a, b])`：让两个互不依赖的异步请求并发执行，比顺序执行快一倍——这是行业里处理"同时需要多个结果"的标准写法
  - Notion 分页模式：REST API 每次最多返回 100 条，用 `has_more` + `next_cursor` 翻页累加，这是 Notion/Stripe/GitHub 等 API 的通用分页约定
  - 类型精简原则：`BookSummary` 只保留展示卡片必要的 4 个字段，不暴露完整 `BookInfo`——接口设计里叫"最小必要原则"

- **用到的关键 API/函数：**
  - `Promise.all` — 并发执行多个 Promise，全部完成后返回结果数组
  - Notion `databases/{id}/query` — 按条件筛选 + 排序分页，这个项目里用 REST 而非 SDK（SDK 类型支持不够完整）
  - `multi_select: { contains: genre }` — Notion 过滤语法，匹配标签包含某值的页面
  - `sorts: [{ timestamp: "created_time", direction: "descending" }]` — 按入库时间倒序

- **容易踩的坑：**
  - **Notion 文件 URL 约 1 小时过期**：封面用的是 Notion S3 临时链接，刷新页面后图片可能消失，需要 `onError` 降级到占位图标
  - **排除刚入库的书**：查推荐时新书已经在数据库里，不排除会把自己推荐给自己；对比 pageId 时要去掉连字符再比（Notion 有时带 `-` 有时不带）
  - **`page_size: limit + 1`**：多取一本，过滤掉自己后刚好剩够 `limit` 本

- **一句话总结：**
  同类书推荐的本质是"查数据库 + 过滤 + 排版"，`Promise.all` 把计数和推荐两步从串行变并行是这个 ticket 最值得记住的性能优化思路。

---

### T22.5 - 书籍详情 Modal + Notion 编辑回写

- **学到的核心概念：**
  - **动态路由 API**：文件路径 `app/api/books/[pageId]/route.ts` 里的 `[pageId]` 是占位符，Next.js 自动把 URL 里的实际值注入进来。行业里几乎所有 REST API 都长这样（`/users/123`、`/posts/456`）
  - **Next.js 16 Breaking Change — `params` 是 Promise**：以前 `params.pageId` 能直接用，v15 起必须 `const { pageId } = await params`。看官方文档很重要，这类"语法正确但运行时错误"的坑只有文档能救你
  - **`Partial<T>`**：TypeScript 内置工具类型，把 `T` 的所有字段变成可选。用在"只传要改的字段"场景非常合适，行业里做"局部更新（PATCH）"接口时的标准写法
  - **受控组件 (Controlled Component)**：`<input value={draft.title} onChange={...} />` 这种写法，React 完全控制输入框的值，和"非受控组件" (`ref`) 是两种流派，React 官方推荐受控

- **用到的关键 API/函数：**
  - `GET https://api.notion.com/v1/pages/{page_id}` — 取单本 Notion 页面完整信息
  - `notion.pages.update({ page_id, properties })` — SDK 局部更新页面属性（只传要改的字段）
  - `document.addEventListener("keydown", ...)` — 监听键盘事件实现 Esc 关闭
  - `document.body.style.overflow = "hidden"` — modal 打开时禁止背景滚动（移动端 UX 必做）

- **容易踩的坑：**
  - **`params` 必须 await**：Next.js 16 的路由 handler 里 `{ params }` 的类型是 `Promise<{...}>`，忘记 await 会拿到 Promise 对象而不是字符串，运行时静默出错很难发现
  - **`<a>` 改 `<button>`**：推荐卡片从链接改成弹 modal 时，语义上应该用 `<button>` 不是 `<a>`——`<a>` 表示"导航到某处"，`<button>` 表示"触发某个操作"，混用会影响无障碍访问
  - **useEffect 清理函数**：监听键盘事件和修改 `body.overflow` 都需要在 `return` 里清除，否则组件卸载后监听器会留在内存里

- **一句话总结：**
  Modal 的本质是"用 state 控制显示/隐藏 + 用 pageId 决定展示哪本书"，所有键盘、滚动、层级的处理都是为了让体验接近原生 App 而补的细节。

---

### T22 - Dashboard 洞察看板

- **学到的核心概念：**
  - **内存缓存（in-memory cache）**：用一个模块级变量 `let cache = { data, expiresAt }` 存上次的计算结果，60 秒内直接返回，不重复打 Notion API。行业里小项目常用这个模式，大项目换成 Redis
  - **`usePathname()`**：Next.js 提供的 hook，返回当前 URL 路径（如 `/dashboard`），用来判断哪个导航项要高亮。行业里叫"active link"模式，几乎所有导航栏都这么做
  - **响应式网格布局**：`grid grid-cols-1 lg:grid-cols-3` 的含义——手机单列，大屏三列。`lg:col-span-2` 让某个 widget 占两格。这是 Tailwind 响应式的标准写法
  - **共用组件（Shared Component）**：把导航栏抽成 `NavBar.tsx`，所有页面 import 同一个，改一处全局生效。行业里叫"single source of truth"，是组件化开发的核心思想

- **用到的关键 API/函数：**
  - `signOut({ callbackUrl: "/login" })` — next-auth/react 客户端登出，跳回登录页
  - `pathname.startsWith(href)` — 判断子路径也算激活（`/dashboard/genre/xxx` 也高亮"书架"）
  - recharts `<PieChart>` + `<Pie>` + `<Cell>` — 环形图，`innerRadius` 控制中空大小
  - recharts `<BarChart>` + `<Bar radius={[6,6,0,0]}>` — 柱状图，radius 让顶部圆角

- **容易踩的坑：**
  - **recharts Tooltip formatter 类型**：v3 的 `value` 参数类型是 `ValueType | undefined`，直接写 `(v: number)` 会报错，要写 `(v) => \`${v ?? 0} 本\`` 处理 undefined
  - **模块级变量做缓存**：Next.js 每次冷启动（Vercel 函数重启）缓存会清空，这是预期行为——热启动时缓存有效，冷启动时重新算一次，可以接受

- **一句话总结：**
  Dashboard 的核心是"一次全量拉数据，然后在内存里做各种统计计算"，缓存避免每次刷页面都重复这个过程，recharts 负责把数字变成图。

---

### T23 - 后端 Agent 重构（Anthropic Tool Use）

- **学到的核心概念：**
  - **Tool Use（工具调用）**：给 Claude 定义一组"工具"（函数描述 + 参数 Schema），Claude 在回复里不直接给答案，而是说"我要调用 XX 工具，参数是 YY"——你执行完把结果还给它，它再决定下一步。这是 Anthropic SDK 的核心进阶功能
  - **Agent 循环**：`while (stop_reason === 'tool_use')` 这个循环就是 Agent 的心跳——只要 Claude 还想调工具就继续，直到它说 `end_turn` 才停。行业里所有 Tool Use Agent 都长这个样子
  - **messages 数组是 Agent 的记忆**：每轮都把完整对话历史（用户消息 + Claude 回复 + 工具结果）发给 Claude，它才知道"前面做了什么、现在该做什么"。这也是为什么 Agent 比单次调用贵——每轮 token 都在累积
  - **Agent vs Workflow 的区别**：Workflow 是代码控制顺序（旧 `/api/process`）；Agent 是 Claude 自己决定调哪些工具、什么顺序。T23 是介于两者之间的"有引导的 Agent"（system prompt 里指定了顺序），T24 的聊天界面才是真正自主的 Agent
  - **AGENTS.md 是给 AI 工具看的**：不是给人看的文档，是告诉 Claude Code / Cursor 等 AI 编程工具"这个项目有哪些特殊规则"，比如"这个 Next.js 版本有 breaking changes，先读本地文档"
  - **feature flag（功能开关）**：`NEXT_PUBLIC_USE_AGENT=true` 让新旧流程可以随时切换，不用改代码。`NEXT_PUBLIC_` 前缀是 Next.js 约定——带这个前缀的环境变量才会暴露给浏览器端

- **用到的关键 API/函数：**
  - `client.messages.create({ tools, messages })` — 带工具定义的 Anthropic API 调用，响应里可能包含 `tool_use` 类型的 content block
  - `response.stop_reason === "tool_use"` — 判断 Claude 是否还要继续调工具
  - `response.content.filter(b => b.type === "tool_use")` — 从响应里找出所有工具调用指令
  - `{ type: "tool_result", tool_use_id, content }` — 把工具执行结果塞回 messages，格式是 Anthropic 协议规定的
  - `input_schema`（JSON Schema）— 定义每个工具的参数结构，Claude 按这个格式填参数

- **容易踩的坑：**
  - **assistant 回复必须加入 messages 再 push tool_result**：顺序是 messages.push(Claude回复) → 执行工具 → messages.push(工具结果)。如果漏掉 Claude 回复这一步，下一轮 API 会报"messages 不符合交替规则"
  - **tool_result 的 content 必须是字符串**：工具返回的对象要 `JSON.stringify()` 再塞进去，直接传对象会报类型错误
  - **Agent 比单次调用贵 4-8 倍**：每个工具调用 = 一次 API 往返，对话历史还会随轮次累积。适合复杂场景，简单场景用旧 `/api/process` 更划算
  - **`NEXT_PUBLIC_` 缺一不可**：浏览器端读环境变量必须加这个前缀，不加的话 `process.env.NEXT_PUBLIC_USE_AGENT` 在浏览器里永远是 `undefined`

- **一句话总结：**
  Tool Use Agent 的本质是"把 Claude 从一个函数变成一个决策者"——它不再只是输入→输出，而是在一个循环里自己决定调哪些工具、看结果、再决定下一步，messages 数组是它唯一的记忆载体。

---

### T24 - 聊天界面 + 流式响应（Streaming Chat）

- **学到的核心概念：**
  - **SSE（Server-Sent Events）**：服务端主动向浏览器推送数据的协议，格式是 `data: {...}\n\n`。Next.js 里用 `ReadableStream` 返回，浏览器用 `response.body.getReader()` 读取。行业里 ChatGPT 的打字机效果就是用 SSE 实现的
  - **流式 Agent 循环**：`client.messages.stream()` 返回一个 `MessageStream`，`.on("text", cb)` 在每个 token 到来时触发，`await stream.finalMessage()` 等整条消息完整。工具调用发生在两轮流式之间：流完→执行工具→再开新流
  - **无状态 API + 前端维护历史**：后端不存 session，前端把完整 `apiMessages` 数组随每次请求发过来。这是现代聊天应用的标准设计，服务端可以水平扩展、随时重启
  - **SSE buffer 处理**：`reader.read()` 返回的 chunk 可能跨行，不能直接 `split("\n")`。要用 `buffer += chunk; lines = buffer.split("\n"); buffer = lines.pop()` 模式，把不完整的行留在 buffer 里
  - **受控 textarea 自动撑高**：`useEffect` 监听 `input` 变化，用 `el.style.height = "auto"` 先重置再读 `scrollHeight`，这是让 textarea 随内容增长的行业惯用写法
  - **`title` vs 自定义 tooltip**：浏览器原生 `title` 属性有固定延迟，无法控制。要做"立即显示"的 tooltip 必须用 CSS `group-hover:opacity-100`（Tailwind group 模式）
  - **系统提示控制输出格式**：与其在前端费力解析 Markdown 表格，不如在 system prompt 里直接告诉 Claude"禁止用表格"。从源头控制输出比在终端解析更可靠

- **用到的关键 API/函数：**
  - `client.messages.stream({ model, tools, messages })` — 流式版 API，返回 `MessageStream`
  - `stream.on("text", delta => ...)` — 每个 token 到来时的回调，用来实现打字机效果
  - `await stream.finalMessage()` — 等待完整消息，拿到 `stop_reason` 和完整 `content`
  - `new ReadableStream({ start(controller) { ... } })` — Next.js App Router 的流式响应写法
  - `controller.enqueue(encoder.encode("data: {...}\n\n"))` — SSE 格式推送单条事件
  - `response.body!.getReader()` — 前端读取 SSE 流的标准方式
  - `FileReader.readAsDataURL(file)` — 把文件转成 base64 data URL 用于预览，比 `createObjectURL` 对更多格式兼容

- **容易踩的坑：**
  - **SSE chunk 边界不对齐**：一次 `reader.read()` 可能包含半条消息，必须用 buffer 拼接，不能假设每次 chunk 都是完整的 `data: {...}\n\n`
  - **`sharp` 不支持 HEIC**：后端用 sharp 处理图片，HEIC 格式会直接报错返回 500。必须在前端转换成 JPEG 再发送（三道保险：libheif-js → heic2any → Canvas）
  - **流式中不能渲染 Markdown**：打字机输出时 `**` 可能只来了一半（如 `**书名`），直接解析会出现乱码。正确做法：流式时显示原始文字，`streaming: false` 后再用 MarkdownText 渲染
  - **`apiMessages` 包含 tool_use/tool_result 块**：对话历史里不只有 text，还有工具调用的结构化数据。前端必须原封不动地把 `newMessages` 存起来发回，不能只存文字
  - **Claude 会自作主张用 Markdown 表格**：system prompt 里不禁止，它就会用。从源头约束比前端解析更靠谱

- **一句话总结：**
  聊天 + 流式的核心是"把 Agent 循环的每一步实时广播给前端"——SSE 是广播通道，buffer 处理保证完整性，messages 数组是 AI 的记忆，system prompt 控制输出格式，四件事配合好才能跑通。

---

### T26 - QuoteStudio 统一编辑器（组件设计模式）

- **学到的核心概念：**
  - **"合并"比"并排"更省认知成本**：原来有两个独立组件 `AddQuoteDrawer`（保存文字）和 `CardMaker`（做卡片），用户每次都要在两个入口间跳来跳去。把它们合成一个 `QuoteStudio` 之后，用同一套界面既能保存又能导出——这是"减少上下文切换"的经典产品决策
  - **Props 控制模式（canSave 模式）**：`QuoteStudio` 接受可选的 `onSaved` 回调。有传 → 显示"保存到 Notion"按钮；不传 → 只能导出 PNG。一个组件、两种行为，靠 props 区分而不是靠两个组件。行业里叫"controlled behavior via props"
  - **StudioTarget 类型**：父组件（`page.tsx`）用一个对象描述"打开制作室时的初始状态"，比独立的 `useState` 一个个传更清晰：`{ initialText, initialBookTitle, initialAuthor, canSave }`。状态是 `null`（关闭）或对象（打开），一个字段搞定开关+数据
  - **乐观更新（Optimistic Update）**：保存成功后，不等服务端返回新数据刷页面，而是直接把新条目插到列表最前面 `setBooks(prev => [book, ...prev])`。用户感觉"立刻生效"，实际上服务端可能还在写。行业标准做法，微博/朋友圈点赞都这样
  - **无书名 → 仅本地展示**：`handleSave` 里检查 `bookTitle.trim()`，空则构造一个本地 `QuoteBook` 对象（`pageId: local-${Date.now()}`）直接调 `onSaved`，完全不发网络请求。这叫"边界条件早返回"，逻辑放在调用方而非 API 里

- **用到的关键 API/函数：**
  - `dynamic(() => import("./QuoteStudio"), { ssr: false })` — Next.js 动态导入并关闭 SSR，因为组件依赖 `document`、`window` 等浏览器 API，在服务端渲染时不存在
  - `FormData` + `fd.append()` — 同时上传文字字段和图片文件的标准方式（比 JSON 多了 binary 支持）
  - `useRef<HTMLTextAreaElement>` — 拿到 textarea 的 DOM 节点，用于后续读取 `selectionStart/selectionEnd`

- **容易踩的坑：**
  - **`ssr: false` 必须加**：组件里用了 `html-to-image`（操作 DOM）、`SpeechRecognition`（浏览器 API），服务端根本没有这些，不关 SSR 会报 `ReferenceError: document is not defined`
  - **乐观更新 vs 实际 coverUrl**：本地上传图片时，文件已存到 Notion，但 Notion 返回的临时 URL 需要刷新才能用。所以乐观更新时 `coverUrl` 只能传 `null`，等用户下次刷页面才能看到封面图

- **一句话总结：**
  好的组件设计不是"功能越多越好"，而是"一个入口做完所有相关的事"——QuoteStudio 把创作、预览、保存、导出合在一处，靠 `onSaved` 这一个 prop 区分两种模式。

---

### T27 - 第三方图片/视频搜索 API（Pixabay 集成）

- **学到的核心概念：**
  - **API Key 放后端是铁律**：Pixabay Key 写在 `.env.local`，只有服务端的 `/api/images` 和 `/api/videos` 路由能读到，浏览器永远看不见。如果直接在前端 `fetch("pixabay.com/api/?key=YOUR_KEY")` 就会在 Network 面板里暴露给任何人——这是最常见的 API Key 泄漏方式
  - **中间层路由的价值**：前端不直接调 Pixabay，而是调自己的 `/api/images?q=xxx`，由这个路由再去请求 Pixabay。好处：① Key 不暴露；② 可以格式化返回值（把 Pixabay 的复杂结构拍平成 `{ id, thumbUrl, fullUrl, author }`）；③ 加缓存、限流等逻辑都在一处。行业里叫 BFF（Backend For Frontend）模式
  - **中文关键词检测**：`/[一-鿿]/.test(q)` 用正则判断字符串里是否有中文字符（Unicode 区间 `一-鿿`），有就在 Pixabay 请求里加 `&lang=zh` 参数——这是适配多语言 API 的实用技巧
  - **`flatMap` vs `map + filter`**：`(data.videos ?? []).flatMap(v => { if (!file) return []; return [{ ...}]; })` 是"边转换边过滤"的简洁写法。返回 `[]` 表示跳过，返回 `[item]` 表示保留。比先 `map` 再 `filter` 少一次遍历，行业里处理"可能缺字段"的数据时很常用

- **用到的关键 API/函数：**
  - `Pixabay Images API`：`GET https://pixabay.com/api/?key=...&q=...&image_type=photo&orientation=vertical`，返回 `hits[]`，每条含 `webformatURL`（缩略图）和 `largeImageURL`（高清图）
  - `Pixabay Videos API`：`GET https://pixabay.com/api/videos/?key=...&q=...`，每条 `hits` 下有 `videos.large/medium/small`，选最大的用
  - `encodeURIComponent(q)` — 把中文等特殊字符编码成 URL 安全格式，搜索关键词必须过这一关
  - `res.ok` — fetch 返回的 Response 对象自带的布尔值，`status 200-299` 为 `true`，比手动判断 `status === 200` 更健壮

- **容易踩的坑：**
  - **`per_page=6` 而不是 12**：视频文件大，太多结果会让用户等很久且占带宽。图片可以给 12 张，视频控制在 6 张就够选
  - **Pixabay 视频 URL 有时效性**：Pixabay 的视频直链会过期，不能存到数据库里作为永久链接用。这里只用来在制作室里预览和播放，不存 Notion

- **一句话总结：**
  后端中间层路由的核心价值是"把第三方 API 的复杂性和敏感信息挡在后端"——前端只看到整洁的 `/api/images`，Key、格式转换、错误处理全部藏在服务端。

---

### T28 - 前端导出技术（PNG / MP4 / Emoji 插入）

- **学到的核心概念：**
  - **html-to-image vs html2canvas**：两者都能把 DOM 元素"截图"成图片，但原理不同。`html2canvas` 用自己实现的渲染引擎重绘 DOM，遇到现代 CSS（如 Tailwind v4 的 `oklab()` 颜色函数）就解析失败报错。`html-to-image` 把 DOM 序列化成 SVG 的 `<foreignObject>`，再用浏览器原生 `Image` 渲染，支持所有浏览器能显示的 CSS
  - **MediaRecorder API（录制视频）**：浏览器原生 API，把 `<canvas>` 的实时画面录制成视频文件。流程：`canvas.captureStream(30fps)` → `new MediaRecorder(stream)` → `recorder.start()` → 每帧 `ctx.drawImage(videoEl, ...)` → `setTimeout(() => recorder.stop(), duration)` → `ondataavailable` 收集 chunks → `new Blob(chunks)` → 下载
  - **canvas 合成替代 DOM 截图**：录制视频时不能截 DOM（DOM 没有 `captureStream`），必须用 canvas 手动重绘所有图层：① 视频帧（`ctx.drawImage(videoEl)`）、② 半透明遮罩（`ctx.fillRect`）、③ 波浪动画（`ctx.beginPath` + 正弦曲线）、④ 文字（`ctx.fillText`）。顺序即层级
  - **Emoji 插入到光标位置**：`textarea.selectionStart/selectionEnd` 是 DOM 原生属性，告诉你"光标在第几个字符"。`text.slice(0, start) + emoji + text.slice(end)` 把 emoji 插入进去，`setTimeout(() => ta.setSelectionRange(start + emoji.length, ...)` 把光标移到 emoji 后面（setTimeout 是为了等 React 重渲完再操作 DOM）
  - **`video/mp4` 的浏览器支持不统一**：Chrome 支持 `video/mp4;codecs=avc1`，Firefox 和 Safari 可能不支持，回退到 `video/webm`。`MediaRecorder.isTypeSupported()` 用来运行时检测，按支持情况选格式

- **用到的关键 API/函数：**
  - `import("html-to-image").then(({ toPng })` — 动态导入，只在点击导出时才加载这个库（懒加载），减少首屏 JS 体积
  - `toPng(element, { pixelRatio: 2 })` — 导出 2 倍分辨率（Retina 屏清晰），返回 base64 dataURL
  - `canvas.captureStream(fps)` — 把 canvas 变成 `MediaStream`（视频流），是录制的起点
  - `new MediaRecorder(stream, { mimeType })` — 把媒体流录制成文件，`ondataavailable` 回调收数据
  - `URL.createObjectURL(blob)` / `URL.revokeObjectURL(url)` — 把内存里的 Blob 变成临时 URL 用于下载，用完要释放，不然内存泄漏
  - `ctx.measureText(str).width` — 测量文字渲染后的像素宽度，用来实现 canvas 上的自动换行

- **容易踩的坑：**
  - **`display: none` 的 video 不播放**：把视频放在隐藏元素里（`className="hidden"`），浏览器会暂停播放，`ctx.drawImage` 只能捕捉到黑帧。解决：让 `<video>` 直接显示在卡片里（`absolute inset-0`），用 CSS 层叠来控制视觉效果
  - **canvas 文字不自动换行**：`ctx.fillText` 不像 HTML 那样自动折行，必须自己写 `wrapCanvasText` 函数：逐字累加，`ctx.measureText` 量宽，超出 maxWidth 就换行
  - **emoji 长度 ≠ 字符数**：`"🦋".length === 2`（因为 emoji 是 UTF-16 代理对），但 `[..."🦋"].length === 1`。用展开运算符 `[...text]` 遍历字符串，每个 emoji 算一个，光标偏移量才对

- **一句话总结：**
  "导出"是前端最考验底层知识的功能——PNG 导出靠 SVG foreignObject 绕过 CSS 兼容问题，MP4 录制靠 canvas 帧级合成 + MediaRecorder，两条路都绕开了"直接截 DOM"的局限。
