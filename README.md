# chrome-mcp-debug

An MCP (Model Context Protocol) server that lets AI agents debug Chrome pages via CDP — capture console logs, evaluate JavaScript, and automatically verify bug fixes by reloading pages.

## Features

- **`attach_by_url`** — find and attach to a page by URL or title keyword (no need to copy-paste target IDs)
- **`reload_and_check`** — reload the page and report whether errors are gone, for one-step bug verification
- **`get_console_logs`** — fetch captured logs filtered by level (`error`, `warn`, `info`, etc.)
- **`evaluate`** — run any JavaScript expression in the page context
- **`list_pages`** / **`attach_to_page`** / **`detach_from_page`** / **`clear_console_logs`** — full manual control

## Requirements

- Node.js 18+
- Google Chrome
- An MCP-compatible client (Claude Code, Cursor, etc.)

## Setup

**1. Install dependencies**

```bash
git clone https://github.com/hew-f/chrome-mcp-debug.git
cd chrome-mcp-debug
npm install
```

**2. Start Chrome in remote debugging mode**

```powershell
# Windows (PowerShell)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=C:\temp\chrome-debug-profile
```

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile
```

Verify Chrome is ready: open `http://localhost:9222/json/version` — it should return JSON.

**3. Configure your MCP client**

Add to `~/.claude.json` (Claude Code) or `~/.cursor/mcp.json` (Cursor):

```json
{
  "mcpServers": {
    "chrome-debug": {
      "command": "/path/to/chrome-mcp-debug/node_modules/.bin/tsx",
      "args": ["/path/to/chrome-mcp-debug/src/index.ts"]
    }
  }
}
```

Restart your client after saving.

## Typical workflow

```
1. attach_by_url("localhost:3000")     → connects and starts capturing logs
2. [trigger the bug in the browser]
3. get_console_logs(targetId, "error") → see what broke
4. [fix the code]
5. reload_and_check(targetId)          → ✓ no errors / ✗ still N errors
```

## Testing

```bash
# MCP Inspector (recommended)
npx @modelcontextprotocol/inspector npx tsx src/index.ts

# Quick smoke test
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' | npx tsx src/index.ts
```

## License

MIT
