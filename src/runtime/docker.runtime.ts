import {
  fileExists,
  parseKeyValueFile,
  readNumberFile,
  readTextFile,
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

function readV2Memory(): {
  usage: number | null;
  limit: number | null;
} {
  const usage = readNumberFile("/sys/fs/cgroup/memory.current");

  const maxRaw = readTextFile("/sys/fs/cgroup/memory.max");

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

function readV1Memory(): {
  usage: number | null;
  limit: number | null;
} {
  const usage = readNumberFile("/sys/fs/cgroup/memory/memory.usage_in_bytes");

  const limit = readNumberFile("/sys/fs/cgroup/memory/memory.limit_in_bytes");

  return {
    usage,
    limit: limit !== null && limit < Number.MAX_SAFE_INTEGER ? limit : null,
  };
}

function readV2CpuUsage(): number | null {
  const stats = parseKeyValueFile("/sys/fs/cgroup/cpu.stat");

  const usageUsec = Number(stats.usage_usec);

  return Number.isFinite(usageUsec) ? usageUsec : null;
}

function readV1CpuUsage(): number | null {
  const nanoseconds = readNumberFile("/sys/fs/cgroup/cpuacct/cpuacct.usage");

  if (nanoseconds === null) {
    return null;
  }

  return nanoseconds / 1_000;
}

function readV2CpuLimitCores(): number | null {
  const value = readTextFile("/sys/fs/cgroup/cpu.max");

  console.log("[docker-runtime] cpu.max:", value);

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

  const limit = quota / period;

  console.log("[docker-runtime] CPU limit cores:", limit);

  return limit;
}

function readV1CpuLimitCores(): number | null {
  const quota = readNumberFile("/sys/fs/cgroup/cpu/cpu.cfs_quota_us");

  const period = readNumberFile("/sys/fs/cgroup/cpu/cpu.cfs_period_us");

  if (quota === null || period === null || quota <= 0 || period <= 0) {
    return null;
  }

  return quota / period;
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

function readV2ProcessCount(): number | null {
  return readNumberFile("/sys/fs/cgroup/pids.current");
}

function readV1ProcessCount(): number | null {
  return readNumberFile("/sys/fs/cgroup/pids/pids.current");
}

export async function collectDockerRuntime(): Promise<RuntimeContext> {
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

  const memory = version === 2 ? readV2Memory() : readV1Memory();

  const cpuUsageUsec = version === 2 ? readV2CpuUsage() : readV1CpuUsage();

  const cpuLimitCores =
    version === 2 ? readV2CpuLimitCores() : readV1CpuLimitCores();

  const processCount =
    version === 2 ? readV2ProcessCount() : readV1ProcessCount();

  console.log("[docker-runtime] metrics:", {
    version,
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
