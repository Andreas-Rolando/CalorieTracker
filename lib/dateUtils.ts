/** Formats a date as YYYY-MM-DD in the given IANA timezone. */
export function getLocalDateString(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which matches Postgres `date` literals.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
