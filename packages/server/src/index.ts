import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { zhCN } from "@webbox/shared";

const config = loadConfig();
const logger = createLogger({ logFile: config.logFile });
const app = await createApp({ ...config, logger });

app.listen(config.port, config.host, () => {
  logger.info("server.start", {
    message: zhCN.server.logs.serverStart,
    host: config.host,
    port: config.port,
    url: config.publicUrl
  });
});
