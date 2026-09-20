import {
  fileExists,
  getCgroupPath,
  readNumberFile,
  readTextFile,
  parseKeyValueFile,
  resolveCgroupFile,
} from "./cgroup.utils.js";

import type { RuntimeContext } from "./runtime.types.js";

interface CpuSample {
  usageUsec: number;
  timestampMs: number;
}

let previousCpuSample: CpuSample | null = null;

function getCgroupVersion(): 1 | 2 | null {
  if (fileExists("/sys/fs/cgroup/cgroup.controllers")) {
    return 2;
  }

  if (fileExists("/sys/fs/cgroup/cpu/cpuacct.usage")) {
    return 1;
  }

  return null;
}

function readMemory(
  version: 1 | 2,
  cgroupPath: string | null,
): {
  usage: number | null;
  limit: number | null;
} {
  if (version === 2) {
    const usageFile = resolveCgroupFile(2, cgroupPath, "memory.current");

    const limitFile = resolveCgroupFile(2, cgroupPath, "memory.max");

    const usage = usageFile ? readNumberFile(usageFile) : null;

    const maxRaw = limitFile ? readTextFile(limitFile) : null;

    let limit: number | null = null;

    if (maxRaw !== null && maxRaw !== "max") {
      const parsed = Number(maxRaw);

      if (Number.isFinite(parsed) && parsed > 0) {
        limit = parsed;
      }
    }

    return {
      usage,
      limit,
    };
  }

  const usageFile = resolveCgroupFile(
    1,
    cgroupPath,
    "memory.usage_in_bytes",
    "memory",
  );

  const limitFile = resolveCgroupFile(
    1,
    cgroupPath,
    "memory.limit_in_bytes",
    "memory",
  );

  const usage = usageFile ? readNumberFile(usageFile) : null;

  const rawLimit = limitFile ? readNumberFile(limitFile) : null;

  return {
    usage,
    limit:
      rawLimit !== null && rawLimit < Number.MAX_SAFE_INTEGER ? rawLimit : null,
  };
}

function readCpuUsage(
  version: 1 | 2,
  cgroupPath: string | null,
): number | null {
  if (version === 2) {
    const cpuStatFile = resolveCgroupFile(2, cgroupPath, "cpu.stat");

    if (!cpuStatFile) {
      return null;
    }

    const stats = parseKeyValueFile(cpuStatFile);

    const usageUsec = Number(stats.usage_usec);

    return Number.isFinite(usageUsec) ? usageUsec : null;
  }

  const cpuUsageFile = resolveCgroupFile(
    1,
    cgroupPath,
    "cpuacct.usage",
    "cpuacct",
  );

  const nanoseconds = cpuUsageFile ? readNumberFile(cpuUsageFile) : null;

  if (nanoseconds === null) {
    return null;
  }

  return nanoseconds / 1_000;
}

function readCpuLimitCores(
  version: 1 | 2,
  cgroupPath: string | null,
): number | null {
  if (version === 2) {
    const cpuMaxFile = resolveCgroupFile(2, cgroupPath, "cpu.max");

    if (!cpuMaxFile) {
      return null;
    }

    const value = readTextFile(cpuMaxFile);

    if (!value) {
      return null;
    }

    const parts = value.split(/\s+/);

    if (parts.length < 2) {
      return null;
    }

    if (parts[0] === "max") {
      return null;
    }

    const quota = Number(parts[0]);

    const period = Number(parts[1]);

    if (
      !Number.isFinite(quota) ||
      !Number.isFinite(period) ||
      quota <= 0 ||
      period <= 0
    ) {
      return null;
    }

    return quota / period;
  }

  const quotaFile = resolveCgroupFile(1, cgroupPath, "cpu.cfs_quota_us", "cpu");

  const periodFile = resolveCgroupFile(
    1,
    cgroupPath,
    "cpu.cfs_period_us",
    "cpu",
  );

  const quota = quotaFile ? readNumberFile(quotaFile) : null;

  const period = periodFile ? readNumberFile(periodFile) : null;

  if (quota === null || period === null || quota <= 0 || period <= 0) {
    return null;
  }

  return quota / period;
}

function readProcessCount(
  version: 1 | 2,
  cgroupPath: string | null,
): number | null {
  if (version === 2) {
    const file = resolveCgroupFile(2, cgroupPath, "pids.current");

    return file ? readNumberFile(file) : null;
  }

  const file = resolveCgroupFile(1, cgroupPath, "pids.current", "pids");

  return file ? readNumberFile(file) : null;
}

function calculateCpuUsagePercent(
  usageUsec: number | null,
  cpuLimitCores: number | null,
): number | null {
  if (usageUsec === null) {
    return null;
  }

  const now = Date.now();

  const current: CpuSample = {
    usageUsec,
    timestampMs: now,
  };

  if (!previousCpuSample) {
    previousCpuSample = current;
    return null;
  }

  const usageDelta = usageUsec - previousCpuSample.usageUsec;

  const timeDeltaMs = now - previousCpuSample.timestampMs;

  previousCpuSample = current;

  if (usageDelta < 0 || timeDeltaMs <= 0) {
    return null;
  }

  const usageOfOneCore = usageDelta / (timeDeltaMs * 1_000);

  const normalizedUsage =
    cpuLimitCores !== null && cpuLimitCores > 0
      ? usageOfOneCore / cpuLimitCores
      : usageOfOneCore;

  return Math.min(100, Math.max(0, normalizedUsage * 100));
}

export async function collectKubernetesRuntime(): Promise<RuntimeContext> {
  const version = getCgroupVersion();

  if (version === null) {
    return {
      metrics: {
        cpuUsagePercent: null,
        cpuLimitCores: null,
        memoryUsageBytes: null,
        memoryLimitBytes: null,
        processCount: null,
      },
    };
  }

  const cgroupPath = getCgroupPath(version === 2 ? "unified" : null);

  const memory = readMemory(version, cgroupPath);

  const cpuUsageUsec = readCpuUsage(version, cgroupPath);

  const cpuLimitCores = readCpuLimitCores(version, cgroupPath);

  const processCount = readProcessCount(version, cgroupPath);

  console.log("[kubernetes-runtime] metrics:", {
    version,
    cgroupPath,
    cpuUsageUsec,
    cpuLimitCores,
    memoryUsage: memory.usage,
    memoryLimit: memory.limit,
    processCount,
  });

  return {
    metrics: {
      cpuUsagePercent: calculateCpuUsagePercent(cpuUsageUsec, cpuLimitCores),

      cpuLimitCores,

      memoryUsageBytes: memory.usage,

      memoryLimitBytes: memory.limit,

      processCount,
    },
  };
}
