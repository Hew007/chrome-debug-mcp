import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ChromeManager } from "./chrome.js";

const manager = new ChromeManager();

const server = new McpServer({
  name: "chrome-mcp-debug",
  version: "1.0.0",
});

server.tool(
  "list_pages",
  "列出当前 Chrome 中所有打开的页面标签（需要 Chrome 以 --remote-debugging-port=9222 启动）",
  {},
  async () => {
    try {
      const pages = await manager.listPages();
      if (pages.length === 0) {
        return {
          content: [{ type: "text", text: "没有找到任何页面标签。" }],
        };
      }
      const text = pages
        .map(
          (p, i) =>
            `[${i + 1}] id: ${p.id}\n    标题: ${p.title}\n    URL: ${p.url}`
        )
        .join("\n\n");
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `连接 Chrome 失败。请确认 Chrome 以如下方式启动：\nchrome.exe --remote-debugging-port=9222\n\n错误: ${String(err)}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "attach_to_page",
  "开始监听指定页面的控制台事件（console.log/warn/error 及浏览器级别日志）",
  { targetId: z.string().describe("页面的 CDP target ID，来自 list_pages") },
  async ({ targetId }) => {
    try {
      await manager.attachToPage(targetId);
      return {
        content: [
          {
            type: "text",
            text: `已连接到页面 ${targetId}，控制台日志开始捕获。`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `连接失败: ${String(err)}` }],
      };
    }
  }
);

server.tool(
  "detach_from_page",
  "停止监听指定页面的控制台事件（已捕获的日志仍然保留）",
  { targetId: z.string() },
  async ({ targetId }) => {
    await manager.detachFromPage(targetId);
    return {
      content: [{ type: "text", text: `已断开与页面 ${targetId} 的连接。` }],
    };
  }
);

server.tool(
  "get_console_logs",
  "获取指定页面已捕获的控制台日志，可按级别过滤",
  {
    targetId: z.string(),
    level: z
      .enum(["all", "log", "info", "warn", "error", "debug"])
      .default("all")
      .describe("日志级别过滤"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .default(100)
      .describe("返回最近 N 条日志"),
  },
  async ({ targetId, level, limit }) => {
    const logs = manager.getConsoleLogs(targetId, level, limit);
    if (logs.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `没有找到日志（targetId=${targetId}, level=${level}）。请确认已调用 attach_to_page。`,
          },
        ],
      };
    }
    const text = logs
      .map((entry) => {
        const time = new Date(entry.timestamp).toISOString().slice(11, 23);
        const location =
          entry.url ? ` (${entry.url}${entry.lineNumber != null ? `:${entry.lineNumber}` : ""})` : "";
        return `[${time}] [${entry.level.toUpperCase()}] ${entry.text}${location}`;
      })
      .join("\n");
    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "clear_console_logs",
  "清空指定页面的控制台日志缓冲区",
  { targetId: z.string() },
  async ({ targetId }) => {
    manager.clearConsoleLogs(targetId);
    return {
      content: [{ type: "text", text: `页面 ${targetId} 的日志缓冲区已清空。` }],
    };
  }
);

server.tool(
  "evaluate",
  "在指定页面的上下文中执行 JavaScript 表达式并返回结果",
  {
    targetId: z.string(),
    expression: z.string().describe("要执行的 JavaScript 表达式"),
  },
  async ({ targetId, expression }) => {
    try {
      const result = await manager.evaluate(targetId, expression);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2) ?? "undefined",
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `执行出错: ${String(err)}` }],
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write("chrome-mcp-debug server started\n");
