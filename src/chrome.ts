import CDP from "chrome-remote-interface";
import type { LogEntry, LogLevel, PageInfo } from "./types.js";

const MAX_BUFFER = 500;

export class ChromeManager {
  private logBuffers = new Map<string, LogEntry[]>();
  private clients = new Map<string, CDP.Client>();
  private host: string;
  private port: number;

  constructor(host = "localhost", port = 9222) {
    this.host = host;
    this.port = port;
  }

  async listPages(): Promise<PageInfo[]> {
    const targets = await CDP.List({ host: this.host, port: this.port });
    return targets
      .filter((t) => t.type === "page")
      .map((t) => ({
        id: t.id,
        url: t.url,
        title: t.title,
        type: t.type,
      }));
  }

  async attachToPage(targetId: string): Promise<void> {
    if (this.clients.has(targetId)) return;

    const client = await CDP({
      host: this.host,
      port: this.port,
      target: targetId,
    });

    this.logBuffers.set(targetId, []);

    await client.Runtime.enable();
    await client.Log.enable();

    client.Runtime.consoleAPICalled((event) => {
      const level = mapRuntimeLevel(event.type);
      const text = event.args
        .map((a) => {
          if (a.value !== undefined) return String(a.value);
          if (a.description) return a.description;
          return a.type;
        })
        .join(" ");

      this.pushLog(targetId, {
        level,
        text,
        timestamp: Date.now(),
      });
    });

    client.Log.entryAdded((event) => {
      const e = event.entry;
      this.pushLog(targetId, {
        level: mapLogLevel(e.level),
        text: e.text,
        url: e.url,
        lineNumber: e.lineNumber,
        timestamp: Date.now(),
      });
    });

    client.on("disconnect", () => {
      this.clients.delete(targetId);
    });

    this.clients.set(targetId, client);
  }

  async attachByUrl(urlPattern: string): Promise<PageInfo> {
    const pages = await this.listPages();
    const matched = pages.find(
      (p) => p.url.includes(urlPattern) || p.title.includes(urlPattern)
    );
    if (!matched) {
      throw new Error(
        `未找到匹配 "${urlPattern}" 的页面。当前页面：\n${pages.map((p) => `  ${p.url}`).join("\n")}`
      );
    }
    await this.attachToPage(matched.id);
    return matched;
  }

  async reloadAndCheck(
    targetId: string,
    waitMs = 2000
  ): Promise<{ errors: LogEntry[]; hasErrors: boolean }> {
    const client = this.clients.get(targetId);
    if (!client) throw new Error("未连接到该页面，请先调用 attach_to_page 或 attach_by_url。");

    this.clearConsoleLogs(targetId);

    await client.Page.enable();

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), waitMs + 3000);
      client.Page.loadEventFired(() => {
        clearTimeout(timer);
        setTimeout(resolve, waitMs);
      });
      client.Page.reload({}).catch(reject);
    });

    const errors = this.getConsoleLogs(targetId, "error", 500);
    return { errors, hasErrors: errors.length > 0 };
  }

  async detachFromPage(targetId: string): Promise<void> {
    const client = this.clients.get(targetId);
    if (!client) return;
    await client.close();
    this.clients.delete(targetId);
  }

  getConsoleLogs(targetId: string, level: string, limit: number): LogEntry[] {
    const buffer = this.logBuffers.get(targetId) ?? [];
    const filtered =
      level === "all" ? buffer : buffer.filter((e) => e.level === level);
    return filtered.slice(-limit);
  }

  clearConsoleLogs(targetId: string): void {
    this.logBuffers.set(targetId, []);
  }

  async evaluate(targetId: string, expression: string): Promise<unknown> {
    const client = this.clients.get(targetId);
    if (!client) throw new Error("未连接到该页面，请先调用 attach_to_page。");

    const result = await client.Runtime.evaluate({
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    if (result.exceptionDetails) {
      const msg =
        result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text;
      throw new Error(msg);
    }

    return result.result.value;
  }

  private pushLog(targetId: string, entry: LogEntry): void {
    let buffer = this.logBuffers.get(targetId);
    if (!buffer) {
      buffer = [];
      this.logBuffers.set(targetId, buffer);
    }
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER) {
      buffer.splice(0, buffer.length - MAX_BUFFER);
    }
  }
}

function mapRuntimeLevel(type: string): LogLevel {
  switch (type) {
    case "error":
      return "error";
    case "warning":
      return "warn";
    case "info":
      return "info";
    case "debug":
      return "debug";
    default:
      return "log";
  }
}

function mapLogLevel(level: string): LogLevel {
  switch (level) {
    case "error":
      return "error";
    case "warning":
      return "warn";
    case "info":
      return "info";
    case "verbose":
      return "debug";
    default:
      return "log";
  }
}
