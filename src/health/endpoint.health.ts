import type { EndpointStatus } from "../types/metrics.js";

export async function checkEndpoint(
  name: string,
  url: string,
): Promise<EndpointStatus> {
  const started = performance.now();

  try {
    const response = await fetch(url, {
      method: "GET",

      signal: AbortSignal.timeout(5_000),

      redirect: "manual",
    });

    const responseTimeMs = Math.round(performance.now() - started);

    return {
      name,

      url,

      healthy: response.status >= 200 && response.status < 500,

      statusCode: response.status,

      responseTimeMs,
    };
  } catch (error) {
    return {
      name,

      url,

      healthy: false,

      statusCode: null,

      responseTimeMs: Math.round(performance.now() - started),

      error: error instanceof Error ? error.message : String(error),
    };
  }
}
