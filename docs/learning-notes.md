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
