import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ServiceStatus } from "../types/metrics.js";
import type { MonitoredService } from "./service.registry.js";
import { checkTcp } from "./tcp.health.js";

const execFileAsync = promisify(execFile);

async function checkSystemdService(
  service: MonitoredService,
): Promise<ServiceStatus> {
  const systemdName = service.systemdName ?? service.name;

  try {
    const { stdout } = await execFileAsync(
      "systemctl",
      ["is-active", systemdName],
      {
        timeout: 5_000,
      },
    );

    const state = stdout.trim();

    return {
      name: service.name,
      type: "systemd",
      healthy: state === "active",
      systemdState: state,
    };
  } catch (error) {
    const err = error as {
      stdout?: string;
    };

    const state = err.stdout?.trim() || "inactive";

    return {
      name: service.name,
      type: "systemd",
      healthy: false,
      systemdState: state,
      error: `systemd state: ${state}`,
    };
  }
}

async function checkTcpService(
  service: MonitoredService,
): Promise<ServiceStatus> {
  if (!service.host || !service.port) {
    return {
      name: service.name,
      type: "tcp",
      healthy: false,
      error: "TCP host or port is not configured",
    };
  }

  const result = await checkTcp(service.host, service.port);

  return {
    name: service.name,
    type: "tcp",
    healthy: result.healthy,
    host: result.host,
    port: result.port,
    responseTimeMs: result.responseTimeMs,
    error: result.error,
  };
}

export async function checkService(
  service: MonitoredService,
): Promise<ServiceStatus> {
  if (service.type === "systemd") {
    return checkSystemdService(service);
  }

  if (service.type === "tcp") {
    return checkTcpService(service);
  }
  
  if (service.type === "http") {
    return checkHttpService(service);
  }

  return {
    name: service.name,
    type: service.type,
    healthy: false,
    error: "Unsupported service type",
  };
}
async function checkHttpService(
  service: MonitoredService,
): Promise<ServiceStatus> {
  if (!service.url) {
    return {
      name: service.name,
      type: "http",
      healthy: false,
      error: "HTTP URL is not configured",
    };
  }

  const started = performance.now();

  try {
    const response = await fetch(service.url, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
      redirect: "manual",
    });

    return {
      name: service.name,
      type: "http",
      healthy: response.status >= 200 && response.status < 500,
      url: service.url,
      statusCode: response.status,
      responseTimeMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      name: service.name,
      type: "http",
      healthy: false,
      url: service.url,
      statusCode: null,
      responseTimeMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
