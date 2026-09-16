import { config } from "../config/config.js";
import { checkEndpoint } from "./endpoint.health.js";
import { checkService } from "./service.health.js";
import { checkTcp } from "./tcp.health.js";
import type { HealthSnapshot } from "../types/metrics.js";

export async function collectHealth(): Promise<HealthSnapshot> {
  const [services, endpoints, mysql] = await Promise.all([
    config.checks.services
      ? Promise.all(
          config.checks.serviceNames
            .filter((serviceName) => serviceName !== "mysql")
            .map((serviceName) => checkService(serviceName)),
        )
      : Promise.resolve([]),

    config.checks.endpoints
      ? Promise.all(
          config.checks.endpointConfigs.map((endpoint) =>
            checkEndpoint(endpoint.name, endpoint.url),
          ),
        )
      : Promise.resolve([]),

    checkTcp("127.0.0.1", 3306),
  ]);

  return {
    services,
    endpoints,
    mysql,
  };
}
