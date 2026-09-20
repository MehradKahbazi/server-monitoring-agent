import { config } from "./config/config.js";
import { getEnvironment } from "./environment/environment.service.js";

import { MonitorService } from "./services/monitor.service.js";

import { TelegramService } from "./telegram/telegram.service.js";

async function bootstrap(): Promise<void> {
  const telegram = new TelegramService();

  const monitor = new MonitorService(telegram);

  monitor.start();

  const shutdown = (): void => {
    monitor.stop();

    process.exit(0);
  };

  process.once("SIGINT", shutdown);

  process.once("SIGTERM", shutdown);

  console.log(
    [
      "",
      "=================================",
      "       SERVER MONITOR",
      "=================================",
      `Host: ${config.hostname}`,
      `Environment: ${config.nodeEnv}`,
      `Interval: ${config.monitorIntervalMs}ms`,
      `CPU threshold: ${config.thresholds.cpu}%`,
      `RAM threshold: ${config.thresholds.ram}%`,
      `Disk threshold: ${config.thresholds.disk}%`,
      "=================================",
      "",
    ].join("\n"),
  );

  console.log("Environment:", getEnvironment());
}

bootstrap().catch((error) => {
  console.error("Failed to start server monitor:", error);

  process.exit(1);
});
