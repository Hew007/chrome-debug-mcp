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
  "attach_by_url",
  "按 URL 或标题关键词查找页面并直接开始监听，替代 list_pages + attach_to_page 两步操作",
  {
    urlPattern: z.string().describe("URL 或页面标题的关键词，如 'localhost:3000' 或 '我的应用'"),
  },
  async ({ urlPattern }) => {
    try {
      const page = await manager.attachByUrl(urlPattern);
      return {
        content: [
          {
            type: "text",
            text: `已连接到页面：\n  id: ${page.id}\n  标题: ${page.title}\n  URL: ${page.url}\n\n控制台日志开始捕获。`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: String(err) }],
      };
    }
  }
);

server.tool(
  "reload_and_check",
  "刷新指定页面并等待加载完成，返回刷新后是否还有控制台报错，用于验证 bug 是否修复",
  {
    targetId: z.string().describe("页面的 CDP target ID"),
    waitMs: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .default(2000)
      .describe("页面 load 事件触发后额外等待的毫秒数，用于捕获异步报错，默认 2000"),
  },
  async ({ targetId, waitMs }) => {
    try {
      const { errors, hasErrors } = await manager.reloadAndCheck(targetId, waitMs);
      if (!hasErrors) {
        return {
          content: [{ type: "text", text: "✓ 页面刷新完成，未发现控制台报错。bug 已修复。" }],
        };
      }
      const text = errors
        .map((entry) => {
          const time = new Date(entry.timestamp).toISOString().slice(11, 23);
          const location =
            entry.url ? ` (${entry.url}${entry.lineNumber != null ? `:${entry.lineNumber}` : ""})` : "";
          return `[${time}] [ERROR] ${entry.text}${location}`;
        })
        .join("\n");
      return {
        content: [
          {
            type: "text",
            text: `✗ 页面刷新后仍有 ${errors.length} 条报错：\n\n${text}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `执行失败: ${String(err)}` }],
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
