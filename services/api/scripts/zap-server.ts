import { serve } from "@hono/node-server";

import { app } from "../src/index.js";

const port = 8787;
const server = serve({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  port,
});

console.log(`ZAP test API listening on http://127.0.0.1:${port}`);

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
