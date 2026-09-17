import os from "node:os";

import si from "systeminformation";

import { getEnvironment } from "../environment/environment.service.js";

import { collectRuntimeMetrics } from "../runtime/runtime.service.js";

import type { DiskMetric, SystemMetrics } from "../types/metrics.js";

export async function collectSystemMetrics(
  filesystems: readonly string[],
): Promise<SystemMetrics> {
  const [memory, cpuTemperature, filesystemSize, systemTime, runtime] =
    await Promise.all([
      si.mem(),
      si.cpuTemperature(),
      si.fsSize(),
      si.time(),
      collectRuntimeMetrics(),
    ]);

  const load = os.loadavg() as [number, number, number];

  const disks: DiskMetric[] = filesystemSize
    .filter((disk) => filesystems.includes(disk.mount))
    .map((disk) => ({
      filesystem: disk.fs,
      mount: disk.mount,
      totalBytes: disk.size,
      usedBytes: disk.used,
      availableBytes: disk.available,
      usagePercent: disk.use,
    }));

  const environment = getEnvironment();

  const runtimeMemory = runtime.metrics;

  const memoryUsage =
    runtimeMemory.memoryUsageBytes !== null &&
    runtimeMemory.memoryLimitBytes !== null &&
    runtimeMemory.memoryLimitBytes > 0
      ? (runtimeMemory.memoryUsageBytes / runtimeMemory.memoryLimitBytes) * 100
      : 0;

  const swapUsage =
    memory.swaptotal > 0 ? (memory.swapused / memory.swaptotal) * 100 : 0;

  return {
    hostname: environment.hostname,

    uptimeSeconds: systemTime.uptime,

    processCount: runtimeMemory.processCount ?? 0,

    environment,

    cpu: {
      usagePercent: runtimeMemory.cpuUsagePercent ?? 0,

      load,

      cores: os.cpus().length,

      temperatureC:
        Number.isFinite(cpuTemperature.main) && cpuTemperature.main > 0
          ? cpuTemperature.main
          : null,
    },

    memory: {
      totalBytes: runtimeMemory.memoryLimitBytes ?? memory.total,

      usedBytes: runtimeMemory.memoryUsageBytes ?? memory.used,

      availableBytes:
        runtimeMemory.memoryLimitBytes !== null &&
        runtimeMemory.memoryUsageBytes !== null
          ? Math.max(
              0,
              runtimeMemory.memoryLimitBytes - runtimeMemory.memoryUsageBytes,
            )
          : memory.available,

      usagePercent: memoryUsage,

      swapTotalBytes: memory.swaptotal,

      swapUsedBytes: memory.swapused,

      swapUsagePercent: swapUsage,
    },

    disks,

    collectedAt: new Date(),
  };
}
