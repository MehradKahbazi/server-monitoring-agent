import TelegramBot from "node-telegram-bot-api";

import { config } from "../config/config.js";

import { collectHealth } from "../health/health.service.js";

import { collectSystemMetrics } from "../metrics/system.metrics.js";

import type { HealthSnapshot, SystemMetrics } from "../types/metrics.js";

import { bytes, duration, percent } from "../utils/format.js";

export class TelegramService {
  private readonly bot: TelegramBot;

  private readonly chatId = config.telegram.chatId;

  constructor() {
    this.bot = new TelegramBot(config.telegram.token, {
      polling: true,
    });

    this.registerCommands();

    this.bot.on("polling_error", (error) => {
      console.error("Telegram polling error:", error.message);
    });
  }

  private registerCommands(): void {
    this.bot.onText(
      /^\/(status|services|disk|help)(?:@\w+)?$/,
      async (message) => {
        console.log("COMMAND HANDLER:", message.text);

        if (String(message.chat.id) !== this.chatId) {
          console.log(
            "Unauthorized chat:",
            message.chat.id,
            "expected:",
            this.chatId,
          );
          return;
        }

        console.log("CHAT AUTHORIZED");

        try {
          const command = message.text?.split(" ")[0];

          switch (command) {
            case "/status":
              console.log("Collecting system metrics...");

              const metrics = await collectSystemMetrics(config.filesystems);

              await this.sendMessage(formatStatus(metrics));

              break;

            case "/services":
              await this.sendMessage(formatHealth(await collectHealth()));
              break;

            case "/disk":
              await this.sendMessage(
                formatDisk(await collectSystemMetrics(config.filesystems)),
              );
              break;

            case "/help":
            default:
              await this.sendMessage(
                [
                  "🤖 <b>SERVER MONITOR</b>",
                  "",
                  "/status — server status",
                  "/services — service health",
                  "/disk — disk usage",
                  "/help — show commands",
                ].join("\n"),
              );
              break;
          }
        } catch (error) {
          console.error("Telegram command error:", error);

          await this.sendMessage("❌ Failed to collect the requested status.");
        }
      },
    );
  }

  async sendMessage(text: string): Promise<void> {
    await this.bot.sendMessage(this.chatId, text, {
      parse_mode: "HTML",

      disable_web_page_preview: true,
    });
  }

  async sendAlert(
    metrics: SystemMetrics,

    reasons: string[],

    health: HealthSnapshot,
  ): Promise<void> {
    await this.sendMessage(formatAlert(metrics, reasons, health));
  }

  async sendRecovery(
    metrics: SystemMetrics,

    recovered: string[],
  ): Promise<void> {
    await this.sendMessage(
      [
        "✅ <b>SERVER RECOVERED</b>",
        "",
        `<b>Host:</b> ${escapeHtml(metrics.hostname)}`,
        `<b>Recovered:</b> ${recovered.join(", ")}`,
        `<b>CPU:</b> ${percent(metrics.cpu.usagePercent)}`,
        `<b>RAM:</b> ${percent(metrics.memory.usagePercent)}`,
        `<b>Time:</b> ${metrics.collectedAt.toISOString()}`,
      ].join("\n"),
    );
  }
}

function formatStatus(metrics: SystemMetrics): string {
  const lines: string[] = [];

  const environment = metrics.environment;

  if (environment.type === "host") {
    lines.push(`🖥 <b>${escapeHtml(environment.hostname)}</b>`);
  }

  if (environment.type === "docker") {
    lines.push(`🐳 <b>Docker</b> — ${escapeHtml(environment.hostname)}`);

    if (environment.containerId) {
      lines.push(
        `📦 Container: <code>${escapeHtml(
          environment.containerId.slice(0, 12),
        )}</code>`,
      );
    }
  }

  if (environment.type === "kubernetes") {
    lines.push("☸️ <b>Kubernetes</b>");

    if (environment.podName) {
      lines.push(`📦 Pod: <code>${escapeHtml(environment.podName)}</code>`);
    }

    if (environment.namespace) {
      lines.push(
        `🏷 Namespace: <code>${escapeHtml(environment.namespace)}</code>`,
      );
    }

    if (environment.nodeName) {
      lines.push(`🖥 Node: <code>${escapeHtml(environment.nodeName)}</code>`);
    }
  }

  lines.push(
    "",
    `⏱ Uptime: ${duration(metrics.uptimeSeconds)}`,

    "",

    "🔥 <b>CPU</b>",

    `Usage: <b>${percent(metrics.cpu.usagePercent)}</b>`,

    `Load: ${metrics.cpu.load.map((value) => value.toFixed(2)).join(" / ")}`,

    `Host Cores: ${metrics.cpu.cores}${
      metrics.cpu.limitCores !== null
        ? `\nContainer Limit: ${metrics.cpu.limitCores.toFixed(2)}`
        : ""
    }`,

    `Temperature: ${
      metrics.cpu.temperatureC === null
        ? "N/A"
        : `${metrics.cpu.temperatureC.toFixed(1)}°C`
    }`,

    "",

    "🧠 <b>RAM</b>",

    `Usage: <b>${percent(metrics.memory.usagePercent)}</b>`,

    `${bytes(metrics.memory.usedBytes)} / ${bytes(metrics.memory.totalBytes)}`,

    `Available: ${bytes(metrics.memory.availableBytes)}`,

    "",

    "🔄 <b>SWAP</b>",

    `Usage: <b>${percent(metrics.memory.swapUsagePercent)}</b>`,

    `${bytes(metrics.memory.swapUsedBytes)} / ${bytes(
      metrics.memory.swapTotalBytes,
    )}`,

    "",

    `⚙️ Processes: ${metrics.processCount}`,

    `⏰ ${metrics.collectedAt.toISOString()}`,
  );

  return lines.join("\n");
}

function formatDisk(metrics: SystemMetrics): string {
  const lines = ["💾 <b>DISK STATUS</b>", ""];

  if (metrics.disks.length === 0) {
    lines.push("No monitored filesystems found.");

    return lines.join("\n");
  }

  for (const disk of metrics.disks) {
    lines.push(
      `<b>${escapeHtml(disk.mount)}</b>: ${percent(disk.usagePercent)}`,

      `${bytes(disk.usedBytes)} / ${bytes(disk.totalBytes)}`,

      `Available: ${bytes(disk.availableBytes)}`,

      "",
    );
  }

  return lines.join("\n");
}

function formatHealth(health: HealthSnapshot): string {
  const lines: string[] = ["🏥 <b>Service Health</b>", ""];

  if (health.services.length > 0) {
    lines.push("⚙️ <b>Services</b>");

    for (const service of health.services) {
      if (service.type === "systemd") {
        lines.push(
          `${service.healthy ? "🟢" : "🔴"} ` +
            `<b>${escapeHtml(service.name)}</b>` +
            ` — ${escapeHtml(service.systemdState ?? "unknown")}`,
        );

        continue;
      }

      if (service.type === "tcp") {
        const address = `${service.host}:${service.port}`;

        if (service.healthy) {
          lines.push(
            `🟢 <b>${escapeHtml(service.name)}</b>` +
              ` — ${escapeHtml(address)}` +
              ` (${service.responseTimeMs ?? 0} ms)`,
          );
        } else {
          lines.push(
            `🔴 <b>${escapeHtml(service.name)}</b>` +
              ` — ${escapeHtml(address)}`,
          );

          if (service.error) {
            lines.push(`   ${escapeHtml(service.error)}`);
          }
        }
      }
    }

    lines.push("");
  } else {
    lines.push("ℹ️ No services configured.");
    lines.push("");
  }

  if (health.endpoints.length > 0) {
    lines.push("🌐 <b>HTTP Endpoints</b>");

    for (const endpoint of health.endpoints) {
      if (endpoint.healthy) {
        lines.push(
          `🟢 <b>${escapeHtml(endpoint.name)}</b>` +
            ` — ${endpoint.statusCode}` +
            ` (${endpoint.responseTimeMs} ms)`,
        );
      } else {
        lines.push(`🔴 <b>${escapeHtml(endpoint.name)}</b>` + ` — unavailable`);

        if (endpoint.error) {
          lines.push(`   ${escapeHtml(endpoint.error)}`);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function formatAlert(
  metrics: SystemMetrics,

  reasons: string[],

  health: HealthSnapshot,
): string {
  const lines: string[] = [
    "🚨 <b>SERVER RESOURCE ALERT</b>",
    "",
    `<b>Host:</b> ${escapeHtml(metrics.hostname)}`,
    `<b>Time:</b> ${metrics.collectedAt.toISOString()}`,
    "",
    "🔥 <b>CPU</b>",
    `Usage: <b>${percent(metrics.cpu.usagePercent)}</b>`,
    `Load: ${metrics.cpu.load.map((value) => value.toFixed(2)).join(" / ")}`,
    `Host Cores: ${metrics.cpu.cores}${
      metrics.cpu.limitCores !== null
        ? `\nContainer Limit: ${metrics.cpu.limitCores.toFixed(2)}`
        : ""
    }`,
    `Temperature: ${
      metrics.cpu.temperatureC === null
        ? "N/A"
        : `${metrics.cpu.temperatureC.toFixed(1)}°C`
    }`,
    "",
    "🧠 <b>MEMORY</b>",
    `Used: ${bytes(metrics.memory.usedBytes)} / ${bytes(metrics.memory.totalBytes)}`,
    `Usage: <b>${percent(metrics.memory.usagePercent)}</b>`,
    `Available: ${bytes(metrics.memory.availableBytes)}`,
    "",
    "🔄 <b>SWAP</b>",
    `Used: ${bytes(metrics.memory.swapUsedBytes)} / ${bytes(metrics.memory.swapTotalBytes)}`,
    `Usage: ${percent(metrics.memory.swapUsagePercent)}`,
    "",
    "💾 <b>DISK</b>",
  ];

  for (const disk of metrics.disks) {
    lines.push(
      `${escapeHtml(disk.mount)}: <b>${percent(disk.usagePercent)}</b>`,
      `${bytes(disk.usedBytes)} / ${bytes(disk.totalBytes)}`,
    );
  }

  lines.push("", "⚙️ <b>SERVICES</b>");

  if (health.services.length === 0) {
    lines.push("No service checks configured.");
  } else {
    for (const service of health.services) {
      lines.push(
        `${service.healthy ? "✅" : "❌"} ${escapeHtml(service.name)}`,
      );
    }
  }

  if (health.endpoints.length > 0) {
    lines.push("", "🌐 <b>ENDPOINTS</b>");

    for (const endpoint of health.endpoints) {
      lines.push(
        `${endpoint.healthy ? "✅" : "❌"} ${escapeHtml(endpoint.name)}`,
      );
    }
  }

  lines.push("", "⚠️ <b>REASONS</b>");

  for (const reason of reasons) {
    lines.push(`• ${escapeHtml(reason)}`);
  }

  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
