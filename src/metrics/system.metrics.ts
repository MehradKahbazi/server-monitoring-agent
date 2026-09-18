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
    .filter((disk: si.Systeminformation.FsSizeData) =>
      filesystems.includes(disk.mount),
    )
    .map((disk: si.Systeminformation.FsSizeData) => ({
      filesystem: disk.fs,
      mount: disk.mount,
      totalBytes: disk.size,
      usedBytes: disk.used,
      availableBytes: disk.available,
      usagePercent: disk.use,
    }));

  const environment = getEnvironment();

  const runtimeMetrics = runtime.metrics;

  const memoryUsage =
    runtimeMetrics.memoryUsageBytes !== null &&
    runtimeMetrics.memoryLimitBytes !== null &&
    runtimeMetrics.memoryLimitBytes > 0
      ? (runtimeMetrics.memoryUsageBytes / runtimeMetrics.memoryLimitBytes) *
        100
      : memory.total > 0
        ? (memory.used / memory.total) * 100
        : 0;

  const swapUsage =
    memory.swaptotal > 0 ? (memory.swapused / memory.swaptotal) * 100 : 0;

  return {
    hostname: environment.hostname,

    uptimeSeconds: systemTime.uptime,

    processCount: runtimeMetrics.processCount ?? 0,

    environment,

    cpu: {
      usagePercent: runtimeMetrics.cpuUsagePercent ?? 0,

      load,

      cores: os.cpus().length,

      limitCores: runtimeMetrics.cpuLimitCores,

      temperatureC:
        Number.isFinite(cpuTemperature.main) && cpuTemperature.main > 0
          ? cpuTemperature.main
          : null,
    },

    memory: {
      totalBytes: runtimeMetrics.memoryLimitBytes ?? memory.total,

      usedBytes: runtimeMetrics.memoryUsageBytes ?? memory.used,

      availableBytes:
        runtimeMetrics.memoryLimitBytes !== null &&
        runtimeMetrics.memoryUsageBytes !== null
          ? Math.max(
              0,
              runtimeMetrics.memoryLimitBytes - runtimeMetrics.memoryUsageBytes,
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
