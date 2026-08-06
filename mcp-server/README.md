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
