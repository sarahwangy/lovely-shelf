# Lovely Shelf 项目进度时间线

| 日期 | 主题 | 做了什么 | 学到的核心技能 |
|------|------|----------|----------------|
| **5月13日（周三）** | 项目启动 + 后端核心 | 初始化 Next.js 项目；设计 UI 原型（深色/靛蓝紫风格）；安装 Anthropic/Notion/Sharp 依赖；写图片预处理函数；接 Claude Vision 识别书封；写 Notion 写入函数；串联端到端链路；建 `/api/process` 后端接口 | 环境变量、SDK 集成、API Route、async/await |
| **5月14日（周四）** | 前端页面 + 稳定性 | 做上传页；做结果展示页；移动端适配；实现批量并发上传（最多 3 张同时处理）；支持 HEIC 格式（iPhone 照片）；重复书籍检测；加结构化日志和 `/api/health` 健康检查 | 并发控制、HEIC 转码、前后端通信 |
| **5月15日（周五）** | 用户账号 + 社区功能 | 接 Google OAuth 登录 + 邮箱白名单；入库后显示同类书计数；做推荐书籍横向滚动区块；做 Dashboard 洞察看板；加全站共用导航栏；做书籍详情 Modal + 编辑字段回写 Notion | OAuth 认证、Session、Notion 双向读写 |
| **5月16日（周六）** | AI 聊天 + 语录系统（最大功能日）| 用 Tool Use 重构后端 Agent；做聊天界面 + SSE 流式响应；AI 生成书摘语句存 Notion；做 QuoteStudio 语录卡制作室（字体/背景/配乐）；Dashboard 加热力图 tooltip 和词云；手写语录持久化到 Notion；Demo 一键体验模式 | Anthropic Tool Use、SSE 流式、状态管理 |
| **5月17日（周日）** | Demo 隔离 + Bug 修复 | Demo 模式完整隔离（数据、上传、语录分开）；修复 Demo banner 显示时机；修复 GET 请求覆盖用户存储的语录 | 环境隔离、Race Condition |
| **5月18日（周一）** | 工程质量 + 国际化启动 | 加 Rate Limiting（防滥用）；加 Error Boundary（前端崩溃兜底）；搭 i18n 基础架构 + 中英切换按钮；翻译 ErrorBoundary、BookDetailModal、QuoteStudio；整理 `.claude` 配置和 docs 文档 | Rate Limiting、Error Boundary、Context API |
| **5月19日（周二）** | i18n 翻译完善 | 完成上传页、结果页、聊天页的英文翻译；翻译类型/国家 Map；完成 QuoteStudio modal 翻译 | i18n 翻译覆盖、Map 数据国际化 |
| **5月20日（周三）** | i18n 合并上线 | 合并 feat/i18n 分支；修复 Hydration Mismatch 和 Turbopack panic | SSR Hydration、分支合并 |

---

**技能地图总览：**

- **后端**：Next.js API Route、Anthropic SDK（Vision + Tool Use + SSE 流式）、Notion API 读写、Rate Limiting
- **前端**：React 状态管理、移动端适配、HEIC 转码、Context API、Error Boundary、i18n 国际化
- **Auth**：Google OAuth、Session 管理、邮箱白名单
- **工程**：环境变量、Demo 模式隔离、结构化日志、健康检查接口

一共 **7 天**，从零搭到有登录、AI 识别、Dashboard、聊天、语录卡、国际化的完整产品。
