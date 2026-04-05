import { createApp } from "./app.js";
import { ensureAppDirectories } from "./config/bootstrap.js";
import { env } from "./config/env.js";

await ensureAppDirectories();

const app = createApp();

app.listen(env.port, () => {
  console.log(`Meeting notes agent listening on ${env.appBaseUrl}`);
});
