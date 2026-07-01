import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { zhCN } from "@webbox/shared";

const config = loadConfig();
const logger = createLogger({ logFile: config.logFile });
const app = await createApp({ ...config, logger });

const server = app.listen(config.port, config.host, () => {
  logger.info("server.start", {
    message: zhCN.server.logs.serverStart,
    host: config.host,
    port: config.port,
    url: config.publicUrl
  });
});

let shuttingDown = false;

function shutdown(exitCode = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => {
    process.exit(exitCode);
  });
  setTimeout(() => process.exit(exitCode), 3000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const parentPid = Number(process.env.WEBBOX_PARENT_PID ?? 0);
if (Number.isInteger(parentPid) && parentPid > 0 && parentPid !== process.pid) {
  const parentWatcher = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      shutdown(0);
    }
  }, 1000);
  parentWatcher.unref();
}
