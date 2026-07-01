const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(value: number | undefined | null): string {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${bytes}B`;
  return `${size.toFixed(1)}${UNITS[unit]}`;
}

export function formatBytesWithExact(value: number | undefined | null): string {
  const bytes = Number(value ?? 0);
  return `${formatBytes(bytes)}（${Math.max(0, bytes)}字节）`;
}
