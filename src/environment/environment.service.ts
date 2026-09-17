import { detectEnvironment } from "./environment.detector.js";

import type { EnvironmentContext } from "./environment.types.js";

let environment: EnvironmentContext | null = null;

export function getEnvironment(): EnvironmentContext {
  if (!environment) {
    environment = detectEnvironment();
  }

  return environment;
}
