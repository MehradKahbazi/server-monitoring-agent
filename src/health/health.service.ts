import { config } from "../config/config.js";

import { checkEndpoint } from "./endpoint.health.js";

import { checkService } from "./service.health.js";

import type { HealthSnapshot } from "../types/metrics.js";

export async function collectHealth(): Promise<HealthSnapshot> {
  const [services, endpoints] = await Promise.all([
    config.checks.services
      ? Promise.all(
          config.checks.serviceNames.map((serviceName) =>
            checkService(serviceName),
          ),
        )
      : Promise.resolve([]),

    config.checks.endpoints
      ? Promise.all(
          config.checks.endpointConfigs.map((endpoint) =>
            checkEndpoint(endpoint.name, endpoint.url),
          ),
        )
      : Promise.resolve([]),
  ]);

  return {
    services,
    endpoints,
  };
}
