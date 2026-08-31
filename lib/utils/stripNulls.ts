/**
 * Recursively drops `null`-valued object keys, turning them into "absent"
 * instead. Gemini structured output sometimes emits `null` for fields our
 * Zod schema declares as merely optional (no `.nullable()`) — this lets a
 * single, simpler schema validate both shapes.
 */
export function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripNulls(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== null) result[key] = stripNulls(v);
    }
    return result as T;
  }
  return value;
}
