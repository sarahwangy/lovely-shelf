# Graph Report - .  (2026-05-21)

## Corpus Check
- 87 files · ~56,995 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 441 nodes · 725 edges · 28 communities (23 shown, 5 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.85)
- Token cost: 1,200 input · 620 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Routes & Chat Backend|API Routes & Chat Backend]]
- [[_COMMUNITY_Chat UI & Error Handling|Chat UI & Error Handling]]
- [[_COMMUNITY_App Layout & Image Pipeline|App Layout & Image Pipeline]]
- [[_COMMUNITY_Demo Data & Book Components|Demo Data & Book Components]]
- [[_COMMUNITY_Claude Agents & AI Config|Claude Agents & AI Config]]
- [[_COMMUNITY_Dependencies & Package Config|Dependencies & Package Config]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Architecture Patterns & Learning|Architecture Patterns & Learning]]
- [[_COMMUNITY_Quote Card Studio|Quote Card Studio]]
- [[_COMMUNITY_Dashboard & Stats UI|Dashboard & Stats UI]]
- [[_COMMUNITY_Notion Docs & PRD|Notion Docs & PRD]]
- [[_COMMUNITY_Notion API Library|Notion API Library]]
- [[_COMMUNITY_Book Content & Tech Stack|Book Content & Tech Stack]]
- [[_COMMUNITY_Early Tickets (T03–T08)|Early Tickets (T03–T08)]]
- [[_COMMUNITY_Auth & Timeline|Auth & Timeline]]
- [[_COMMUNITY_Streaming Chat & Agent Loop|Streaming Chat & Agent Loop]]
- [[_COMMUNITY_Image Upload Pipeline (T09–T11)|Image Upload Pipeline (T09–T11)]]
- [[_COMMUNITY_Recommendations & UI Tickets|Recommendations & UI Tickets]]
- [[_COMMUNITY_UI Prototypes & Design|UI Prototypes & Design]]
- [[_COMMUNITY_Frontend Patterns|Frontend Patterns]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Proxy Config|Proxy Config]]
- [[_COMMUNITY_Initial API Keys Ticket|Initial API Keys Ticket]]

## God Nodes (most connected - your core abstractions)
1. `useLanguage()` - 36 edges
2. `Learning Notes (docs/learning-notes.md)` - 31 edges
3. `compilerOptions` - 16 edges
4. `preprocessImage()` - 16 edges
5. `recognizeBook()` - 13 edges
6. `BookInfo` - 11 edges
7. `POST()` - 11 edges
8. `createBookPage()` - 11 edges
9. `BookSummary` - 10 edges
10. `uploadFileToNotion()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `preprocessImage()` --calls--> `sharp`  [INFERRED]
  src/lib/image.ts → package.json
- `Project Coding Standards (file size, shared components)` --semantically_similar_to--> `notion-fields.ts Single Source of Truth Pattern`  [INFERRED] [semantically similar]
  CLAUDE.md → README.md
- `Demo Mode Guard Agent` --references--> `src/app/api/process/route.ts`  [INFERRED]
  .claude/agents/demo-mode-guard.md → README.md
- `Demo Mode Guard Agent` --references--> `src/app/api/agent/route.ts`  [INFERRED]
  .claude/agents/demo-mode-guard.md → README.md
- `Demo Mode Guard Agent` --references--> `src/app/api/quotes/route.ts`  [INFERRED]
  .claude/agents/demo-mode-guard.md → README.md

## Hyperedges (group relationships)
- **Notion Field Three-File Sync Contract** — lib_notion_fields_ts, lib_notion_ts, lib_ai_ts [EXTRACTED 1.00]
- **Upload Pipeline Core Services** — concept_upload_pipeline, lib_image_ts, lib_ai_ts, lib_notion_ts [EXTRACTED 1.00]
- **Demo Mode Safety: guard agent, pattern, and demo data** — agents_demo_mode_guard_agent, concept_demo_mode_guard_pattern, lib_demo_data_ts [INFERRED 0.85]
- **Book Ingestion Pipeline: Image → AI → Notion** — docs_tickets_t05_image, docs_tickets_t06_ai, docs_tickets_t07_notion [EXTRACTED 0.95]
- **Agent + Streaming Chat System** — docs_tickets_t23_agent, docs_tickets_t24_chat, concept_tool_use_agent_loop, concept_sse_streaming [EXTRACTED 0.95]
- **Prototype Design Chain: Brief → v1 → v2** — docs_prompt_ui_prompt_ui, prototypes_index_overview, prototypes_v2_index_overview [INFERRED 0.75]
- **Next.js + Vercel Deployment Stack for Lovely Shelf** — public_next_logo, public_vercel_logo, concept_lovely_shelf_app, concept_nextjs_framework, concept_vercel_platform [INFERRED 0.85]
- **Lovely Shelf UI Icon Assets** — public_file_icon, public_globe_icon, public_window_icon, concept_lovely_shelf_app [INFERRED 0.75]

## Communities (28 total, 5 thin omitted)

### Community 0 - "API Routes & Chat Backend"
Cohesion: 0.08
Nodes (46): log(), POST(), GET(), CHAT_TOOLS, client, DEMO_GENRE_BOOKS, DEMO_RECOGNIZE_POOL, executeDemoTool() (+38 more)

### Community 1 - "Chat UI & Error Handling"
Cohesion: 0.06
Nodes (34): GlobalError(), ChatError(), ApiMessage, BookItem, ChatPage(), ChatSidebar(), DisplayMessage, EmptyState() (+26 more)

### Community 2 - "App Layout & Image Pipeline"
Cohesion: 0.05
Nodes (31): geistMono, geistSans, metadata, viewport, ImageResult, MusicResult, ALLOWED_HOSTS, GET() (+23 more)

### Community 3 - "Demo Data & Book Components"
Cohesion: 0.10
Nodes (29): Props, book(), buildDemoStats(), buildRecentActivity(), DEMO_BOOKS_FULL, DEMO_LATEST, DEMO_PROCESS_POOL, DemoBookFull (+21 more)

### Community 4 - "Claude Agents & AI Config"
Cohesion: 0.08
Nodes (36): Next.js Agent Rules (AGENTS.md), Code Reviewer Agent, Demo Mode Guard Agent, Notion Sync Checker Agent, src/app/api/agent/route.ts, src/app/api/chat/route.ts, src/app/api/process/route.ts, src/app/api/quotes/route.ts (+28 more)

### Community 5 - "Dependencies & Package Config"
Cohesion: 0.06
Nodes (32): dependencies, @anthropic-ai/sdk, heic2any, html2canvas, html-to-image, libheif-js, next, next-auth (+24 more)

### Community 6 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 7 - "Architecture Patterns & Learning"
Cohesion: 0.12
Nodes (19): BFF (Backend For Frontend) Proxy Pattern, Demo Mode Isolation Pattern, React Context for i18n Global State, Learning Notes (docs/learning-notes.md), T12 Learning Note: Mobile Viewport & Safe-Area, T13 Learning Note: Batch Concurrent Upload, T14 Learning Note: HEIC Front-end Transcoding, T15 Learning Note: Duplicate Detection (+11 more)

### Community 8 - "Quote Card Studio"
Cohesion: 0.14
Nodes (8): dlFile(), exportMarkdown(), exportTSV(), QuoteCard(), QuotesPage(), QuoteStudio, StudioTarget, CardStyle

### Community 9 - "Dashboard & Stats UI"
Cohesion: 0.15
Nodes (8): DashboardPage(), HeatmapRow(), WordCloud(), COUNTRY_ZH_TO_EN, GENRE_ZH_TO_EN, translateTerm(), GENRE_COLORS, WORD_CLOUD_COLORS

### Community 10 - "Notion Docs & PRD"
Cohesion: 0.17
Nodes (12): Notion API Pitfalls (Title vs RichText, Select null format), Notion Database Field Configuration, Notion Field Mapping (NOTION_FIELDS), GENRE_LABELS Constant, STATUS_VALUES Constant, Architecture Decision Records (ADR), Single-Image Processing Data Flow, PRD — Lovely-Shelf (+4 more)

### Community 11 - "Notion API Library"
Cohesion: 0.27
Nodes (11): DEMO_BOOKS, appendManualQuote(), fetchManualPageBlockInfo(), fetchManualPageQuotes(), findOrCreateManualPage(), updateManualQuote(), fetchBooksFromNotion(), fetchManualBook() (+3 more)

### Community 12 - "Book Content & Tech Stack"
Cohesion: 0.20
Nodes (11): Consciousness Science / Neuroscience, Lovely Shelf Application, Next.js Framework, Vercel Deployment Platform, Being You: A New Science of Consciousness, Being You - Anil Seth (Book Photo), File / Document Icon (SVG), Globe / Web Icon (SVG) (+3 more)

### Community 13 - "Early Tickets (T03–T08)"
Cohesion: 0.29
Nodes (10): T05 Learning Note: Image Preprocessing, T06 Learning Note: AI Vision Recognition, T07 Learning Note: Notion Write Function, T08 Learning Note: End-to-End Pipeline, T03: Project Scaffold, T05: Image Preprocessing (src/lib/image.ts), T06: AI Book Recognition (src/lib/ai.ts), T07: Notion Write Functions (src/lib/notion.ts) (+2 more)

### Community 14 - "Auth & Timeline"
Cohesion: 0.25
Nodes (8): T20.5 Learning Note: Google OAuth / next-auth, T20.5: Google OAuth + Email Allowlist, Day 2 (May 14): Frontend + Stability, Day 3 (May 15): Auth + Community Features, Day 5 (May 17): Demo Isolation + Bug Fixes, Day 6 (May 18): Engineering Quality + i18n, Day 7 (May 19): i18n Translation Completion, Lovely Shelf Project Timeline

### Community 15 - "Streaming Chat & Agent Loop"
Cohesion: 0.38
Nodes (7): SSE Streaming (Server-Sent Events) Pattern, Anthropic Tool Use Agent Loop Pattern, T23 Learning Note: Anthropic Tool Use Agent, T24 Learning Note: SSE Streaming Chat, T23: Backend Agent Refactor (Tool Use), T24: Chat UI + Streaming Response, Day 4 (May 16): AI Chat + QuoteStudio

### Community 16 - "Image Upload Pipeline (T09–T11)"
Cohesion: 0.29
Nodes (7): T09 Learning Note: API Route Handler, T10 Learning Note: Upload Page, T11 Learning Note: Result Page + SSR/localStorage, T09: POST /api/process Route, T10: Upload Page (src/app/page.tsx), T11: Result Page (/result/[batchId]), T20: Genre Count After Upload

### Community 17 - "Recommendations & UI Tickets"
Cohesion: 0.33
Nodes (7): T21 Learning Note: Book Recommendations, T22 Learning Note: Dashboard In-Memory Cache, T22.5 Learning Note: BookDetailModal, T21: Same-Genre Book Recommendations, T22.5: BookDetailModal Component, T22.6: Word Cloud Widget, T22: Dashboard /dashboard

### Community 18 - "UI Prototypes & Design"
Cohesion: 0.33
Nodes (7): Prompt UI Design Brief, Prototype v1 Upload Page (home.html), Prototype v1 Index (iPhone 15 Pro frame), Prototype v1 Result Page (result.html), Prototype v2 Upload Page, Prototype v2 Index (Dark/Indigo theme), Prototype v2 Result Page

### Community 19 - "Frontend Patterns"
Cohesion: 0.40
Nodes (5): Cursor Pagination Pattern (has_more + next_cursor), Optimistic Update Pattern, T20 Learning Note: Cursor Pagination & Stats, T26 Learning Note: QuoteStudio Unified Editor, T31 Learning Note: Optimistic Update & Block Update

## Knowledge Gaps
- **157 isolated node(s):** `config`, `name`, `version`, `private`, `dev` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useLanguage()` connect `Chat UI & Error Handling` to `Quote Card Studio`, `Dashboard & Stats UI`, `App Layout & Image Pipeline`, `Demo Data & Book Components`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `preprocessImage()` connect `API Routes & Chat Backend` to `Notion API Library`, `Dependencies & Package Config`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `config`, `name`, `version` to the rest of the system?**
  _161 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Routes & Chat Backend` be split into smaller, more focused modules?**
  _Cohesion score 0.0825136612021858 - nodes in this community are weakly interconnected._
- **Should `Chat UI & Error Handling` be split into smaller, more focused modules?**
  _Cohesion score 0.06313497822931785 - nodes in this community are weakly interconnected._
- **Should `App Layout & Image Pipeline` be split into smaller, more focused modules?**
  _Cohesion score 0.0467687074829932 - nodes in this community are weakly interconnected._
- **Should `Demo Data & Book Components` be split into smaller, more focused modules?**
  _Cohesion score 0.0953058321479374 - nodes in this community are weakly interconnected._