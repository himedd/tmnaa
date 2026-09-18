import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { startPolling } from "./lib/followerCounter";

const rawPort = process.env["PORT"] ?? "7000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  startPolling();
  logger.info({ port }, "Server listening");
});
