import { execFile } from "node:child_process";

import { promisify } from "node:util";

import type { ServiceStatus } from "../types/metrics.js";

const execFileAsync = promisify(execFile);

export async function checkService(name: string): Promise<ServiceStatus> {
  try {
    const { stdout } = await execFileAsync("systemctl", ["is-active", name], {
      timeout: 5_000,
    });

    const state = stdout.trim();

    return {
      name,

      active: state === "active",

      state,
    };
  } catch (error) {
    const err = error as {
      stdout?: string;
    };

    const state = err.stdout?.trim() || "inactive";

    return {
      name,

      active: false,

      state,
    };
  }
}
