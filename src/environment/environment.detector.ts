import fs from "node:fs";
import os from "node:os";

import type {
  EnvironmentContext,
  EnvironmentType,
} from "./environment.types.js";

const KUBERNETES_SERVICE_HOST = "KUBERNETES_SERVICE_HOST";

const KUBERNETES_SERVICE_ACCOUNT_PATH =
  "/var/run/secrets/kubernetes.io/serviceaccount";

const DOCKER_ENV_FILE = "/.dockerenv";

const CGROUP_FILE = "/proc/1/cgroup";

function fileExists(path: string): boolean {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

function isKubernetes(): boolean {
  return (
    process.env[KUBERNETES_SERVICE_HOST] !== undefined ||
    fileExists(KUBERNETES_SERVICE_ACCOUNT_PATH)
  );
}

function isDocker(): boolean {
  if (fileExists(DOCKER_ENV_FILE)) {
    return true;
  }

  if (!fileExists(CGROUP_FILE)) {
    return false;
  }

  try {
    const content = fs.readFileSync(CGROUP_FILE, "utf8");

    return (
      content.includes("docker") ||
      content.includes("containerd") ||
      content.includes("kubepods")
    );
  } catch {
    return false;
  }
}

function detectType(): EnvironmentType {
  if (isKubernetes()) {
    return "kubernetes";
  }

  if (isDocker()) {
    return "docker";
  }

  return "host";
}

function readFirstExistingEnv(names: readonly string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

function detectContainerId(): string | null {
  if (!fileExists(CGROUP_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(CGROUP_FILE, "utf8");

    const matches = content.match(/[a-f0-9]{64}/gi);

    return matches?.[0] ?? null;
  } catch {
    return null;
  }
}

export function detectEnvironment(): EnvironmentContext {
  const type = detectType();

  return {
    type,

    hostname: process.env.HOST_NAME?.trim() || os.hostname(),

    containerId: type === "host" ? null : detectContainerId(),

    podName:
      type === "kubernetes"
        ? readFirstExistingEnv(["POD_NAME", "HOSTNAME"])
        : null,

    namespace:
      type === "kubernetes"
        ? readFirstExistingEnv(["POD_NAMESPACE", "NAMESPACE"])
        : null,

    nodeName:
      type === "kubernetes" ? readFirstExistingEnv(["NODE_NAME"]) : null,
  };
}
