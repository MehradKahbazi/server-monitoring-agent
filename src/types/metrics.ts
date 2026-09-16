export interface CpuMetrics {
  usagePercent: number;
  load: [number, number, number];
  cores: number;
  temperatureC: number | null;
}

export interface MemoryMetrics {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;

  swapTotalBytes: number;
  swapUsedBytes: number;
  swapUsagePercent: number;
}

export interface DiskMetric {
  filesystem: string;
  mount: string;

  totalBytes: number;
  usedBytes: number;
  availableBytes: number;

  usagePercent: number;
}

export interface SystemMetrics {
  hostname: string;

  uptimeSeconds: number;

  processCount: number;

  cpu: CpuMetrics;

  memory: MemoryMetrics;

  disks: DiskMetric[];

  collectedAt: Date;
}

export interface ServiceStatus {
  name: string;
  active: boolean;
  state: string;
}

export interface EndpointStatus {
  name: string;
  url: string;

  healthy: boolean;

  statusCode: number | null;

  responseTimeMs: number | null;

  error?: string;
}

export interface HealthSnapshot {
  services: ServiceStatus[];

  endpoints: EndpointStatus[];
}

export type AlertMetric =
  | "cpu"
  | "ram"
  | "swap"
  | "disk"
  | "load"
  | "temperature";

export interface AlertState {
  active: boolean;

  consecutiveFailures: number;

  lastAlertAt: number;

  lastValue: number | null;
}
