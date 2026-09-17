import fs from "node:fs";

export function readTextFile(path: string): string | null {
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

export function readNumberFile(path: string): number | null {
  const value = readTextFile(path);

  if (value === null) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export function fileExists(path: string): boolean {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

export function parseKeyValueFile(path: string): Record<string, string> {
  const content = readTextFile(path);

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
