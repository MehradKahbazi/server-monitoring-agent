import "dotenv/config";
import os from "node:os";

import type { ServiceType } from "../types/metrics.js";

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isFinite(value) ? value : fallback;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export interface EndpointConfig {
  name: string;
  url: string;
}

export interface ServiceConfig {
  name: string;
  type: ServiceType;

  systemdName?: string;

  host?: string;
  port?: number;

  url?: string;
}

function parseEndpoints(): EndpointConfig[] {
  return (process.env.ENDPOINTS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const separator = item.indexOf("|");

      if (separator === -1) {
        return {
          name: item,
          url: item,
        };
      }

      return {
        name: item.slice(0, separator).trim(),
        url: item.slice(separator + 1).trim(),
      };
    });
}

function parseServiceType(value: string | undefined): ServiceType | null {
  switch (value?.trim().toLowerCase()) {
    case "systemd":
      return "systemd";

    case "tcp":
      return "tcp";

    case "http":
      return "http";

    default:
      return null;
  }
}

function parseServices(): ServiceConfig[] {
  const serviceNames = (process.env.SERVICES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return serviceNames.map((name) => {
    const key = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_");

    const type = parseServiceType(process.env[`SERVICE_${key}_TYPE`]) ?? "tcp";

    const systemdName = process.env[`SERVICE_${key}_SYSTEMD_NAME`]?.trim();

    const host = process.env[`SERVICE_${key}_HOST`]?.trim();

    const portValue = process.env[`SERVICE_${key}_PORT`];

    const port = portValue !== undefined ? Number(portValue) : undefined;

    const url = process.env[`SERVICE_${key}_URL`]?.trim();

    return {
      name,
      type,
      ...(systemdName ? { systemdName } : {}),
      ...(host ? { host } : {}),
      ...(Number.isInteger(port) ? { port } : {}),
      ...(url ? { url } : {}),
    };
  });
}

const services = parseServices();

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  hostname: process.env.HOST_NAME?.trim() || os.hostname(),

  monitorIntervalMs: numberEnv("MONITOR_INTERVAL_MS", 30_000),

  thresholds: {
    cpu: numberEnv("CPU_WARNING_THRESHOLD", 85),

    ram: numberEnv("RAM_WARNING_THRESHOLD", 85),

    swap: numberEnv("SWAP_WARNING_THRESHOLD", 50),

    disk: numberEnv("DISK_WARNING_THRESHOLD", 90),

    loadMultiplier: numberEnv("LOAD_WARNING_MULTIPLIER", 1.5),

    temperature: numberEnv("CPU_TEMP_WARNING_THRESHOLD", 80),
  },

  alerts: {
    consecutiveFailures: Math.max(
      1,
      numberEnv("ALERT_AFTER_CONSECUTIVE_FAILURES", 3),
    ),

    recoveryThreshold: numberEnv("RECOVERY_THRESHOLD", 75),

    cooldownMs: numberEnv("ALERT_COOLDOWN_MS", 900_000),
  },

  filesystems: (process.env.MONITORED_FILESYSTEMS ?? "/")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),

  telegram: {
    token: required("TELEGRAM_BOT_TOKEN"),
    chatId: required("TELEGRAM_CHAT_ID"),
  },

  checks: {
    services: booleanEnv("CHECK_SERVICES", true),

    endpoints: booleanEnv("CHECK_ENDPOINTS", true),

    servicesConfig: services,

    serviceNames: services.map((service) => service.name),

    endpointConfigs: parseEndpoints(),
  },

  logLevel: process.env.LOG_LEVEL ?? "info",
} as const;
