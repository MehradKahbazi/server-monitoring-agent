export function bytes(value: number): string {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  if (value === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];

  let size = value;

  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const decimals = unitIndex === 0 ? 0 : 2;

  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

export function percent(value: number): string {
  if (!Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

export function duration(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return "N/A";
  }

  const days = Math.floor(seconds / 86400);

  const hours = Math.floor((seconds % 86400) / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}
