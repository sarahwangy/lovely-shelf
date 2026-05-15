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
