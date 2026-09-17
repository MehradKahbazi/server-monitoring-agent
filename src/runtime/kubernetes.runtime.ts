import type { RuntimeContext } from "./runtime.types.js";

export async function collectKubernetesRuntime(): Promise<RuntimeContext> {
  /*
   * Kubernetes/cgroup metrics will be implemented here.
   *
   * Pod/container resource limits and usage will be read
   * independently from host metrics.
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
