import type { RuntimeContext } from "./runtime.types.js";

export async function collectDockerRuntime(): Promise<RuntimeContext> {
  /*
   * Docker cgroup metrics will be implemented here.
   *
   * This is intentionally kept separate from host metrics so
   * Docker-specific logic does not leak into system.metrics.ts.
   */

  return {
    metrics: {
      cpuUsagePercent: null,
      memoryUsageBytes: null,
      memoryLimitBytes: null,
      processCount: null,
    },
  };
}
