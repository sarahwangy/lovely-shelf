# Lovely Shelf — 系统图表

---

## 1. 核心业务流程图（用户视角）

```mermaid
flowchart TD
    A([用户访问]) --> B{已登录?}
    B -- 否 --> C[登录页]
    C --> D[Google OAuth]
    C --> E[Demo 一键体验]
    D --> F{邮箱白名单?}
    F -- 否 --> G[拒绝访问]
    F -- 是 --> H([主界面])
    E --> H

    H --> UP[📷 上传页]
    H --> QU[💬 语录页]
    H --> DB[📊 Dashboard]
    H --> CH[🤖 Chat]

    %% Upload Flow
    UP --> UP1[选择/拖拽图片]
    UP1 --> UP2{HEIC格式?}
    UP2 -- 是 --> UP3[前端转换 HEIC→JPEG\nlibheif-js / heic2any / Canvas]
    UP2 -- 否 --> UP4[Sharp 压缩\n1600px / quality 85]
    UP3 --> UP4
    UP4 --> UP5{Demo 用户?}
    UP5 -- 是 --> UP6[Claude Vision 识别书籍]
    UP5 -- 否 --> UP6
    UP6 --> UP7{有重复书籍?}
    UP7 -- 是 --> UP8[返回已有记录]
    UP7 -- 否 --> UP9[上传封面到 Notion]
    UP9 --> UP10[写入 Notion 数据库]
    UP10 --> UP11[查询同类推荐书]
    UP11 --> UP12[展示结果页\n书信 + 推荐 + 成就徽章]
    UP8 --> UP12

    %% Quotes Flow
    QU --> QU1[浏览语录\nAll / 手写 / 书库 / 收藏]
    QU1 --> QU2[Quote Studio 编辑器]
    QU2 --> QU3[自定义背景/字体/音乐/视频]
    QU3 --> QU4{导出格式}
    QU4 -- PNG --> QU5[html2canvas 截图]
    QU4 -- MP4 --> QU6[MediaRecorder 录制]

    %% Dashboard Flow
    DB --> DB1[/api/stats 聚合数据]
    DB1 --> DB2[类型饼图]
    DB1 --> DB3[每月条形图]
    DB1 --> DB4[30天热力图]
    DB1 --> DB5[最近书籍网格]
    DB5 --> DB6[BookDetailModal\n查看/编辑/保存]

    %% Chat Flow
    CH --> CH1[发送消息/上传图片]
    CH1 --> CH2[SSE 流式返回]
    CH2 --> CH3{Claude Tool Use}
    CH3 -- recognize_book --> CH4[识别书籍]
    CH3 -- query_books --> CH5[查询书库]
    CH3 -- list_genres --> CH6[列出类型]

    style A fill:#4f46e5,color:#fff
    style H fill:#059669,color:#fff
    style UP12 fill:#0891b2,color:#fff
```

---

## 2. 技术架构图（系统视角）

```mermaid
graph TB
    subgraph Client["客户端 (Browser)"]
        direction TB
        NextPages["Next.js App Router\n(React 19 / TypeScript)"]
        
        subgraph Pages["页面"]
            PLogin["/login"]
            PUpload["/upload"]
            PResult["/result"]
            PDash["/dashboard"]
            PQuotes["/quotes"]
            PChat["/chat"]
        end
        
        subgraph ClientLibs["客户端库"]
            HEIC["libheif-js (WASM)\nHEIC 解码"]
            Recharts["Recharts\n图表渲染"]
            html2canvas["html2canvas\nPNG 导出"]
            MediaRec["MediaRecorder API\nMP4 录制"]
            i18n["i18n\nzh / en 切换"]
        end

        NextPages --> Pages
        NextPages --> ClientLibs
    end

    subgraph Server["服务端 (Next.js API Routes / Vercel Serverless)"]
        direction TB
        
        subgraph Auth["认证层"]
            NextAuth["NextAuth v5\nGoogle OAuth + Credentials"]
            RateLimit["Rate Limiter\n内存 Map\n(per user/action)"]
        end
        
        subgraph APIs["API Routes"]
            APIProcess["/api/process\n顺序管道"]
            APIAgent["/api/agent\n智能体管道"]
            APIStats["/api/stats\n统计聚合"]
            APIBooks["/api/books\n书库分页"]
            APIQuotes["/api/quotes\nCRUD"]
            APIChat["/api/chat\nSSE 流式"]
            APIProxy["/api/images\n/api/videos\n/api/music\n代理"]
        end
        
        subgraph Libs["服务端库"]
            LibAI["lib/ai.ts\nrecognizeBook()"]
            LibAgent["lib/agent.ts\nrunBookAgent()"]
            LibNotion["lib/notion.ts\nCRUD + 分页"]
            LibImage["lib/image.ts\nSharp 预处理"]
            LibFields["lib/notion-fields.ts\n字段映射 SSOT"]
            LibDemo["lib/demo-data.ts\nDemo 数据种子"]
        end

        Auth --> APIs
        APIs --> Libs
    end

    subgraph External["外部服务"]
        ClaudeAPI["Anthropic Claude API\nclaude-sonnet-4-6\nVision + Tool Use"]
        NotionAPI["Notion API\n数据库 + 文件存储"]
        GoogleOAuth["Google OAuth 2.0"]
        Pixabay["Pixabay API\n图片/视频搜索"]
        Jamendo["Jamendo API\n音乐搜索"]
    end

    Client -- "HTTPS / SSE" --> Server
    LibAI --> ClaudeAPI
    LibAgent --> ClaudeAPI
    LibNotion --> NotionAPI
    NextAuth --> GoogleOAuth
    APIProxy --> Pixabay
    APIProxy --> Jamendo

    style Client fill:#eff6ff,stroke:#3b82f6
    style Server fill:#f0fdf4,stroke:#22c55e
    style External fill:#fef9c3,stroke:#eab308
```

---

## 3. System Design 图（含数据库 & 数据流）

```mermaid
graph LR
    subgraph UserDevice["用户设备"]
        Browser["浏览器\n(Next.js CSR)"]
        LocalStorage["localStorage\n收藏 / 语言偏好\n卡片样式"]
    end

    subgraph Vercel["Vercel Serverless Platform"]
        direction TB
        
        subgraph EdgeLayer["边缘层"]
            NextAuthMW["NextAuth Middleware\n路由鉴权"]
        end

        subgraph ComputeLayer["计算层 (Serverless Functions)"]
            direction TB
            
            ProcessFn["process() fn\n顺序 Pipeline\n~10-15s"]
            AgentFn["agent() fn\nClaude Tool Use Loop\n~15-20s"]
            StatsFn["stats() fn\nNotion 全量扫描\n~5s"]
            ChatFn["chat() fn\nSSE 60s timeout"]
            
            subgraph SharedModules["共享模块"]
                SharpMod["Sharp\n图像处理\nnative bindings"]
                RateLimitMem["内存 Rate Limit\nMap per instance\n(非持久化)"]
                DemoMod["Demo Data\n种子数据\n~32本书"]
            end
        end
    end

    subgraph NotionDB["Notion (主数据库)"]
        direction TB
        DB[("Notion Database\n单表架构")]
        
        subgraph Schema["字段 Schema"]
            F1["书名 (Title) — PK-like"]
            F2["作者 (Rich Text)"]
            F3["类型 Label (Multi-select)"]
            F4["描述 (Rich Text)"]
            F5["优美语句 (Rich Text)\n换行符分隔多条语录"]
            F6["封面 (Files & Media)\nNotion CDN 存储"]
            F7["国家 (Select)"]
            F8["Notion URL (URL)"]
            F9["音乐/视频 (URL)\nQuote Studio 用"]
        end
        
        DB --> Schema
    end

    subgraph AILayer["AI 服务层"]
        Claude["Claude claude-sonnet-4-6\nVision API\nTool Use API\nSSE Streaming"]
    end

    subgraph MediaAPIs["媒体 API 层"]
        PixabayS["Pixabay\n图片 & 视频"]
        JamendoS["Jamendo\n背景音乐"]
    end

    Browser -- "1. 上传图片 (multipart)" --> NextAuthMW
    NextAuthMW -- "2. 验证 Session Cookie" --> ProcessFn
    ProcessFn -- "3. Base64 图像" --> Claude
    Claude -- "4. JSON 书籍信息" --> ProcessFn
    ProcessFn -- "5. 查重 / 写入" --> NotionDB
    NotionDB -- "6. 页面 URL + 推荐" --> ProcessFn
    ProcessFn -- "7. 结果 JSON" --> Browser

    StatsFn -- "全量分页查询" --> NotionDB
    ChatFn -- "SSE chunks" --> Browser
    ChatFn -- "Tool Use" --> Claude
    ChatFn -- "查询书库" --> NotionDB

    Browser -- "图片/视频搜索" --> PixabayS
    Browser -- "音乐搜索" --> JamendoS

    Browser <--> LocalStorage

    subgraph DataFlowNote["关键数据流说明"]
        N1["重复检测: 查询 Notion 书名+作者精确匹配\n(非 AI 去重，纯数据库查询)"]
        N2["语录存储: 单个 Rich Text 字段\n多条用 \\n 分隔，前端 split() 解析"]
        N3["封面存储: 直接上传到 Notion 文件存储\n返回 Notion CDN URL"]
        N4["统计聚合: 无缓存，每次全量扫描 Notion\n(小规模库 < 1000 本可接受)"]
        N5["Rate Limit: 内存 Map，Vercel 多实例\n不跨实例共享 (已知限制)"]
    end

    style UserDevice fill:#dbeafe,stroke:#2563eb
    style Vercel fill:#dcfce7,stroke:#16a34a
    style NotionDB fill:#fce7f3,stroke:#db2777
    style AILayer fill:#fef3c7,stroke:#d97706
    style MediaAPIs fill:#f3e8ff,stroke:#9333ea
    style DataFlowNote fill:#f8fafc,stroke:#94a3b8,stroke-dasharray:5 5
```

---

## 图例补充：Upload Pipeline 对比

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant API as /api/process
    participant Sharp as Sharp (服务端)
    participant Claude as Claude Vision
    participant Notion as Notion API

    U->>FE: 选择图片文件
    
    alt HEIC/HEIF 格式
        FE->>FE: libheif-js WASM 解码
        FE->>FE: 转换为 JPEG Blob
    end
    
    FE->>API: POST multipart/form-data (JPEG)
    API->>API: await auth() — 验证 Session
    API->>API: checkRateLimit() — 限流检查
    API->>Sharp: resize(1600) + jpeg(quality:85)
    Sharp-->>API: jpegBuffer + base64
    
    API->>Claude: vision API (base64 + prompt)
    Claude-->>API: { title, author, genres, quotes, description }
    
    alt 非 Demo 用户
        API->>Notion: query — 检查重复 (书名+作者)
        
        alt 无重复
            API->>Notion: upload cover image
            Notion-->>API: fileUrl
            API->>Notion: create page (all fields)
            Notion-->>API: pageId + pageUrl
        end
        
        API->>Notion: query — 同类型书数量
        API->>Notion: query — 同类型最近5本
    else Demo 用户
        API->>API: 返回 Demo 种子数据 (跳过所有 Notion 操作)
    end
    
    API-->>FE: { bookInfo, pageUrl, stats, recommendations }
    FE->>U: 展示结果页
```
