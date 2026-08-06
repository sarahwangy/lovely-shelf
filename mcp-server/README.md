# Lovely Shelf MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the Lovely Shelf book library as tools any MCP-compatible AI client (Claude Desktop, Claude Code) can query directly — no need to open the web app.

## What it does

Lovely Shelf's web app lets you photograph a book cover and have Claude Vision catalogue it into a Notion database. This MCP server gives AI clients direct, structured access to that same Notion database, so you can ask Claude Desktop things like:

> "Do I already have a book by this author in my shelf?"
> "Show me the details and quotes for [book title]."

...and get a real answer sourced from your actual library, instead of Claude guessing.

## Tools

| Tool | Description |
|---|---|
| `search_books` | Search the shelf by title or author keyword (fuzzy match) |
| `get_book_by_id` | Get full details for one book by its Notion page ID — genres, description, quotes |

## Architecture

This is a standalone Node process, separate from the Next.js web app — it communicates with MCP clients over stdio, not HTTP. It reuses the same Notion field mapping (`notion-fields.ts`) and REST API query patterns as the main app's `src/lib/notion.ts`, reimplemented standalone since MCP servers run as independent processes and can't import the Next.js app's path aliases directly.

## How this relates to the web app (important)

This server is **not part of the deployed web app** and has no runtime connection to it — visiting the Lovely Shelf website does not start or use this server in any way. The only thing they share is the same underlying Notion database:

```
Claude Desktop / Claude Code (local, on your machine)
   ↓ launched on demand, per its own config file
mcp-server/index.ts (local process, talks over stdio)
   ↓ calls the Notion API
Your real Notion book database
```

- **Who can use it**: only people running an MCP-capable AI client — currently Claude Desktop or Claude Code. There is no way to use it from a browser or from the regular Lovely Shelf website.
- **What "using it" requires**: the user must add this server's launch command (plus their own `NOTION_TOKEN` / `NOTION_DATABASE_ID`) to their client's own config file (e.g. `claude_desktop_config.json`), then restart the client. It is not something a visitor can turn on themselves from the site.
- **When it runs**: the client starts this process on demand each time it launches, per its config — it is not a persistent background service, and it doesn't run at all unless a client is configured to start it.
- **Why it exists alongside the web app**: the website is the general-purpose entry point (photograph a cover, browse the gallery); the MCP server is a parallel, developer-facing channel that lets an AI client query the same data with natural language (e.g. "do I already have a book by this author?"). Neither one calls the other — they're two independent doors into the same Notion database.

```
mcp-server/
  index.ts           # server entry point — registers tools, handles MCP protocol
  notion-fields.ts    # Notion field name mapping (kept in sync with the main app)
  package.json
  tsconfig.json
```

## Setup

```bash
cd mcp-server
npm install
```

Requires `NOTION_TOKEN` and `NOTION_DATABASE_ID` (same values as the main app's `.env.local`).

## Running locally

```bash
npm start
```

## Connecting to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lovely-shelf": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/1-lovely-shelf/mcp-server/index.ts"],
      "env": {
        "NOTION_TOKEN": "your-notion-token",
        "NOTION_DATABASE_ID": "your-database-id"
      }
    }
  }
}
```

Restart Claude Desktop, then ask it about your book shelf directly.

## Verification

Tested end-to-end with a scripted MCP client that connects over stdio, lists the registered tools, and calls `search_books` against the real production Notion database — confirmed it returns actual book records, not mocked data.
