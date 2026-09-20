import { getEnvironment } from "../environment/environment.service.js";

import { collectHostRuntime } from "./host.runtime.js";

import { collectDockerRuntime } from "./docker.runtime.js";

import { collectKubernetesRuntime } from "./kubernetes.runtime.js";

import type { RuntimeContext } from "./runtime.types.js";

export async function collectRuntimeMetrics(): Promise<RuntimeContext> {
  const environment = getEnvironment();

  switch (environment.type) {
    case "docker":
      return collectDockerRuntime();

    case "kubernetes":
      return collectKubernetesRuntime();

    case "host":
    default:
      return collectHostRuntime();
  }
}
