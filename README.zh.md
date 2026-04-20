# chrome-mcp-debug

通过 CDP（Chrome DevTools Protocol）让 AI agent 直接调试 Chrome 页面的 MCP 服务——捕获控制台日志、执行 JavaScript、修复 bug 后自动刷新验证。

## 功能

- **`attach_by_url`** — 按 URL 或标题关键词直接连接页面，无需手动复制 target ID
- **`reload_and_check`** — 刷新页面并报告报错是否消失，一步完成 bug 修复验证
- **`get_console_logs`** — 按级别（`error` / `warn` / `info` 等）过滤获取控制台日志
- **`evaluate`** — 在页面上下文中执行任意 JavaScript 表达式
- **`list_pages`** / **`attach_to_page`** / **`detach_from_page`** / **`clear_console_logs`** — 完整的手动控制工具

## 环境要求

- Node.js 18+
- Google Chrome
- 支持 MCP 协议的客户端（Claude Code、Cursor 等）

## 安装配置

**1. 安装依赖**

```bash
git clone https://github.com/hew-f/chrome-mcp-debug.git
cd chrome-mcp-debug
npm install
```

**2. 以远程调试模式启动 Chrome**

```powershell
# Windows（PowerShell）
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=C:\temp\chrome-debug-profile
```

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile
```

验证 Chrome 是否就绪：访问 `http://localhost:9222/json/version`，返回 JSON 即表示成功。

**3. 配置 MCP 客户端**

编辑 `~/.claude.json`（Claude Code）或 `~/.cursor/mcp.json`（Cursor）：

```json
{
  "mcpServers": {
    "chrome-debug": {
      "command": "/your/path/chrome-mcp-debug/node_modules/.bin/tsx",
      "args": ["/your/path/chrome-mcp-debug/src/index.ts"]
    }
  }
}
```

保存后重启客户端即可生效。

## 典型使用流程

```
1. attach_by_url("localhost:3000")      → 连接页面，开始捕获日志
2. [在浏览器中触发 bug]
3. get_console_logs(targetId, "error")  → 查看报错信息
4. [修复代码]
5. reload_and_check(targetId)           → ✓ 未发现报错，bug 已修复
                                           ✗ 仍有 N 条报错
```

## 本地测试

```bash
# MCP Inspector（推荐）
npx @modelcontextprotocol/inspector npx tsx src/index.ts

# 快速 smoke test
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' | npx tsx src/index.ts
```

## License

MIT
