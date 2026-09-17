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

  return {
    name: service.name,
    type: service.type,
    healthy: false,
    error: "Unsupported service type",
  };
}
