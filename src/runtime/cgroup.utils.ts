import fs from "node:fs";
import path from "node:path";

export function readTextFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return null;
  }
}

export function readNumberFile(filePath: string): number | null {
  const value = readTextFile(filePath);

  if (value === null) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function parseKeyValueFile(filePath: string): Record<string, string> {
  const content = readTextFile(filePath);

  if (!content) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const separator = line.indexOf(" ");

    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();

    const value = line.slice(separator + 1).trim();

    if (key && value) {
      result[key] = value;
    }
  }

  return result;
}

export function getCgroupPath(controller: string | null = null): string | null {
  const content = readTextFile("/proc/self/cgroup");

  if (!content) {
    return null;
  }

  for (const line of content.split("\n")) {
    const parts = line.split(":");

    if (parts.length !== 3) {
      continue;
    }

    const hierarchy = parts[0];

    const controllers = parts[1] ? parts[1].split(",") : [];

    const relativePath = parts[2];

    /*
     * cgroup v2:
     *
     * 0::/
     *
     * The controller field is intentionally
     * empty. Hierarchy "0" identifies the
     * unified cgroup hierarchy.
     */
    if (controller === "unified" && hierarchy === "0") {
      return relativePath;
    }

    /*
     * cgroup v1:
     *
     * 5:cpu,cpuacct:/docker/...
     */
    if (
      controller !== null &&
      controller !== "unified" &&
      controllers.includes(controller)
    ) {
      return relativePath;
    }

    /*
     * If no controller was requested, return
     * the first available cgroup path.
     */
    if (controller === null) {
      return relativePath;
    }
  }

  return null;
}

export function getCgroupMountPoint(version: 1 | 2): string | null {
  if (version === 2) {
    return fileExists("/sys/fs/cgroup/cgroup.controllers")
      ? "/sys/fs/cgroup"
      : null;
  }

  return fileExists("/sys/fs/cgroup") ? "/sys/fs/cgroup" : null;
}

export function resolveCgroupFile(
  version: 1 | 2,
  relativePath: string | null,
  fileName: string,
  controller?: string,
): string | null {
  const mountPoint = getCgroupMountPoint(version);

  if (!mountPoint) {
    return null;
  }

  if (version === 2) {
    return path.join(mountPoint, relativePath ?? "", fileName);
  }

  if (!controller) {
    return null;
  }

  return path.join(mountPoint, controller, relativePath ?? "", fileName);
}
