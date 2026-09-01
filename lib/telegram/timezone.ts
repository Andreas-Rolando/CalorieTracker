const TIMEZONE_ALIASES: Record<string, string> = {
  wib: "Asia/Jakarta",
  wita: "Asia/Makassar",
  wit: "Asia/Jayapura",
  jakarta: "Asia/Jakarta",
  makassar: "Asia/Makassar",
  jayapura: "Asia/Jayapura",
  bali: "Asia/Makassar",
  denpasar: "Asia/Makassar",
};

/**
 * Accepts loose input (bare city names, WIB/WITA/WIT, mixed case, missing
 * "Asia/" prefix) instead of requiring an exact IANA zone name.
 */
export function normalizeTimezone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const supported = Intl.supportedValuesOf("timeZone");
  if (supported.includes(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (TIMEZONE_ALIASES[lower]) return TIMEZONE_ALIASES[lower];

  const caseInsensitiveMatch = supported.find((tz) => tz.toLowerCase() === lower);
  return caseInsensitiveMatch ?? null;
}
