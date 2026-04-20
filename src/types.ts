export type LogLevel = "log" | "warn" | "error" | "info" | "debug";

export interface LogEntry {
  level: LogLevel;
  text: string;
  url?: string;
  lineNumber?: number;
  timestamp: number;
}

export interface PageInfo {
  id: string;
  url: string;
  title: string;
  type: string;
}
