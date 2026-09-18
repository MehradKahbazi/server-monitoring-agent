import type { RuntimeContext } from "./runtime.types.js";

export async function collectKubernetesRuntime(): Promise<RuntimeContext> {
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
