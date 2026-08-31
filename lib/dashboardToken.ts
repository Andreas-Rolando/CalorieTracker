import "server-only";
import { randomBytes } from "node:crypto";

/** Opaque token for /dashboard/[dashboard_token] — never the Telegram ID. */
export function generateDashboardToken(): string {
  return randomBytes(24).toString("base64url");
}
