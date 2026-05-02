import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./migrate";

const port = Number(process.env["PORT"] ?? "8080");

if (Number.isNaN(port) || port <= 0) {
  logger.error({ port: process.env["PORT"] }, "Invalid PORT value");
  process.exit(1);
}

async function main() {
  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, "Database migration failed — continuing anyway");
  }

  app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
