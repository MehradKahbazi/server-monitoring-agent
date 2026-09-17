import { config } from "../config/config.js";

import type { ServiceConfig } from "../config/config.js";

import type { ServiceType } from "../types/metrics.js";

export interface MonitoredService {
  name: string;
  type: ServiceType;

  systemdName?: string;

  host?: string;
  port?: number;

  url?: string;
}

const defaultServiceDefinitions: Record<string, MonitoredService> = {
  nginx: {
    name: "nginx",
    type: "systemd",
    systemdName: "nginx",
  },

  apache: {
    name: "apache",
    type: "systemd",
    systemdName: "apache2",
  },

  apache2: {
    name: "apache2",
    type: "systemd",
    systemdName: "apache2",
  },

  mysql: {
    name: "mysql",
    type: "tcp",
    host: "127.0.0.1",
    port: 3306,
  },

  mariadb: {
    name: "mariadb",
    type: "tcp",
    host: "127.0.0.1",
    port: 3306,
  },

  postgresql: {
    name: "postgresql",
    type: "tcp",
    host: "127.0.0.1",
    port: 5432,
  },

  postgres: {
    name: "postgres",
    type: "tcp",
    host: "127.0.0.1",
    port: 5432,
  },

  mongodb: {
    name: "mongodb",
    type: "tcp",
    host: "127.0.0.1",
    port: 27017,
  },

  mongo: {
    name: "mongo",
    type: "tcp",
    host: "127.0.0.1",
    port: 27017,
  },

  mssql: {
    name: "mssql",
    type: "tcp",
    host: "127.0.0.1",
    port: 1433,
  },

  sqlserver: {
    name: "sqlserver",
    type: "tcp",
    host: "127.0.0.1",
    port: 1433,
  },

  redis: {
    name: "redis",
    type: "tcp",
    host: "127.0.0.1",
    port: 6379,
  },
};

function fromConfig(service: ServiceConfig): MonitoredService {
  return {
    name: service.name,
    type: service.type,
    ...(service.systemdName ? { systemdName: service.systemdName } : {}),
    ...(service.host ? { host: service.host } : {}),
    ...(service.port !== undefined ? { port: service.port } : {}),
    ...(service.url ? { url: service.url } : {}),
  };
}

export function getServiceDefinition(
  serviceName: string,
): MonitoredService | null {
  const normalized = serviceName.trim().toLowerCase();

  const configured = config.checks.servicesConfig.find(
    (service) => service.name.toLowerCase() === normalized,
  );

  if (configured) {
    return fromConfig(configured);
  }

  return defaultServiceDefinitions[normalized] ?? null;
}

export function getServiceDefinitions(
  serviceNames: readonly string[],
): MonitoredService[] {
  return serviceNames
    .map((name) => getServiceDefinition(name))
    .filter((service): service is MonitoredService => service !== null);
}
