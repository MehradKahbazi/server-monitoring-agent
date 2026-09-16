import os from "node:os";

import si from "systeminformation";

import type { DiskMetric, SystemMetrics } from "../types/metrics.js";

export async function collectSystemMetrics(
  filesystems: readonly string[],
): Promise<SystemMetrics> {
  const [
    cpuLoad,
    cpuTemperature,
    memory,
    filesystemSize,
    processes,
    systemTime,
  ] = await Promise.all([
    si.currentLoad(),

    si.cpuTemperature(),

    si.mem(),

    si.fsSize(),

    si.processes(),

    si.time(),
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

  const memoryUsage = memory.total > 0 ? (memory.used / memory.total) * 100 : 0;

  const swapUsage =
    memory.swaptotal > 0 ? (memory.swapused / memory.swaptotal) * 100 : 0;

  return {
    hostname: os.hostname(),

    uptimeSeconds: systemTime.uptime,

    processCount: processes.all,

    cpu: {
      usagePercent: cpuLoad.currentLoad,

      load,

      cores: os.cpus().length,

      temperatureC:
        Number.isFinite(cpuTemperature.main) && cpuTemperature.main > 0
          ? cpuTemperature.main
          : null,
    },

    memory: {
      totalBytes: memory.total,

      usedBytes: memory.used,

      availableBytes: memory.available,

      usagePercent: memoryUsage,

      swapTotalBytes: memory.swaptotal,

      swapUsedBytes: memory.swapused,

      swapUsagePercent: swapUsage,
    },

    disks,

    collectedAt: new Date(),
  };
}
