export type EnvironmentType = "host" | "docker" | "kubernetes";

export interface EnvironmentContext {
  type: EnvironmentType;

  hostname: string;

  containerId: string | null;

  podName: string | null;
  namespace: string | null;
  nodeName: string | null;
}
