export function toDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    value = new Date(value);
  }

  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Invalid date value");
  }

  return value.toISOString().slice(0, 10);
}
