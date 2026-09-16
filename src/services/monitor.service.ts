import pino from "pino";

import { config } from "../config/config.js";

import { collectHealth } from "../health/health.service.js";

import { collectSystemMetrics } from "../metrics/system.metrics.js";

import {
  evaluateThresholds,
  processRecoveries,
  resetFailureCounter,
  updateAlertState,
} from "../rules/threshold.engine.js";

import { TelegramService } from "../telegram/telegram.service.js";

const logger = pino({
  level: config.logLevel,
});

export class MonitorService {
  private timer: NodeJS.Timeout | undefined;

  private running = false;

  constructor(private readonly telegram: TelegramService) {}

  start(): void {
    void this.runOnce();

    this.timer = setInterval(() => {
      void this.runOnce();
    }, config.monitorIntervalMs);

    logger.info(
      {
        intervalMs: config.monitorIntervalMs,
      },
      "Server monitor started",
    );
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);

    this.timer = undefined;

    logger.info("Server monitor stopped");
  }

  async runOnce(): Promise<void> {
    if (this.running) {
      logger.warn("Previous monitoring cycle is still running");

      return;
    }

    this.running = true;

    try {
      const metrics = await collectSystemMetrics(config.filesystems);

      const violations = evaluateThresholds(metrics);

      const newlyAlerted: string[] = [];

      for (const violation of violations) {
        const decision = updateAlertState(violation);

        if (decision.alert) {
          newlyAlerted.push(violation.message);
        }
      }

      if (newlyAlerted.length > 0) {
        const health = await collectHealth();

        await this.telegram.sendAlert(
          metrics,

          newlyAlerted,

          health,
        );
      }

      const violatedMetrics = new Set(
        violations.map((violation) => violation.metric),
      );

      const allMetrics = [
        "cpu",
        "ram",
        "swap",
        "disk",
        "load",
        "temperature",
      ] as const;

      for (const metric of allMetrics) {
        if (!violatedMetrics.has(metric)) {
          resetFailureCounter(metric);
        }
      }

      const recovered = processRecoveries(metrics, violations);

      if (recovered.length > 0) {
        await this.telegram.sendRecovery(metrics, recovered);
      }

      logger.debug(
        {
          cpu: metrics.cpu.usagePercent,

          ram: metrics.memory.usagePercent,

          disk: metrics.disks.map((disk) => ({
            mount: disk.mount,

            usage: disk.usagePercent,
          })),

          violations: violations.length,
        },

        "Monitoring cycle completed",
      );
    } catch (error) {
      logger.error(
        {
          err: error,
        },

        "Monitoring cycle failed",
      );
    } finally {
      this.running = false;
    }
  }
}
