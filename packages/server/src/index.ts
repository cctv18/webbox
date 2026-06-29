import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await createApp(config);

app.listen(config.port, "127.0.0.1", () => {
  console.log(`Webbox server listening at http://127.0.0.1:${config.port}`);
});
