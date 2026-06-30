import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { zhCN } from "@webbox/shared";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface WebboxLogger {
  debug(event: string, details?: Record<string, unknown>): void;
  info(event: string, details?: Record<string, unknown>): void;
  warn(event: string, details?: Record<string, unknown>): void;
  error(event: string, details?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): WebboxLogger;
  flush(): Promise<void>;
}

interface LoggerOptions {
  context?: Record<string, unknown>;
  logFile?: string;
}

function timestamp() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join(":");
  return `${date} ${time}.${String(now.getMilliseconds()).padStart(3, "0")}`;
}

function serialize(details: Record<string, unknown>) {
  const entries = Object.entries(details).filter(([, value]) => value !== undefined);
  return entries.length ? ` ${JSON.stringify(Object.fromEntries(entries))}` : "";
}

export function createLogger(options: LoggerOptions = {}): WebboxLogger {
  const context = options.context ?? {};
  const logFile = options.logFile;

  const write = (level: LogLevel, event: string, details: Record<string, unknown> = {}) => {
    const line = `[${timestamp()}] [${level.toUpperCase()}] ${event}${serialize({ ...context, ...details })}`;
    const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    consoleMethod(line);
    if (!logFile) return;
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `${line}\n`, "utf8");
  };

  return {
    debug: (event, details) => write("debug", event, details),
    info: (event, details) => write("info", event, details),
    warn: (event, details) => write("warn", event, details),
    error: (event, details) => write("error", event, details),
    child: (childContext) => createLogger({ logFile, context: { ...context, ...childContext } }),
    flush: async () => undefined
  };
}

export function requestLogger(logger: WebboxLogger) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    logger.info("request.start", {
      message: zhCN.server.logs.requestStart,
      summary: `${req.method} ${req.path}`,
      method: req.method,
      path: req.originalUrl
    });
    res.on("finish", () => {
      logger.info("request.complete", {
        message: zhCN.server.logs.requestComplete,
        summary: `${req.method} ${req.path}`,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    });
    next();
  };
}
