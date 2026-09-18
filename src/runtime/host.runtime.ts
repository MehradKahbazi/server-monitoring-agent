import si from "systeminformation";

import type { RuntimeContext } from "./runtime.types.js";

export async function collectHostRuntime(): Promise<RuntimeContext> {
  const [cpuLoad, memory, processes] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.processes(),
  ]);

  return {
    metrics: {
      cpuUsagePercent: Number.isFinite(cpuLoad.currentLoad)
        ? cpuLoad.currentLoad
        : null,

      cpuLimitCores: null,

      memoryUsageBytes: Number.isFinite(memory.used) ? memory.used : null,

      memoryLimitBytes: Number.isFinite(memory.total) ? memory.total : null,

      processCount: Number.isFinite(processes.all) ? processes.all : null,
    },
  };
}
