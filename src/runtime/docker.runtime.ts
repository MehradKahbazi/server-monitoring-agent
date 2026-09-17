import {
  fileExists,
  parseKeyValueFile,
  readNumberFile,
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

    if (Number.isFinite(parsed)) {
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

function calculateCpuUsagePercent(usageUsec: number | null): number | null {
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

  /*
   * 100% means one fully utilized CPU core.
   *
   * Example:
   * 30 ms CPU time used during a 100 ms interval
   * = 30% CPU.
   */
  const cpuPercent = (usageDelta / (timeDeltaMs * 1_000)) * 100;

  return Number.isFinite(cpuPercent) ? Math.max(0, cpuPercent) : null;
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
        memoryUsageBytes: null,
        memoryLimitBytes: null,
        processCount: null,
      },
    };
  }

  const memory = version === 2 ? readV2Memory() : readV1Memory();

  const cpuUsageUsec = version === 2 ? readV2CpuUsage() : readV1CpuUsage();

  const processCount =
    version === 2 ? readV2ProcessCount() : readV1ProcessCount();

  return {
    metrics: {
      cpuUsagePercent: calculateCpuUsagePercent(cpuUsageUsec),

      memoryUsageBytes: memory.usage,

      memoryLimitBytes: memory.limit,

      processCount,
    },
  };
}
