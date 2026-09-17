export interface RuntimeMetrics {
  cpuUsagePercent: number | null;

  memoryUsageBytes: number | null;
  memoryLimitBytes: number | null;

  processCount: number | null;
}

export interface RuntimeContext {
  metrics: RuntimeMetrics;
}
