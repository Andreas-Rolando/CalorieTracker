import "server-only";
import { env } from "@/lib/env";

/** Telegram caps bot file downloads at 20MB; we don't need photos anywhere near that. */
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export class PhotoDownloadError extends Error {}

/**
 * Downloads a Telegram file by its file_path into memory and base64-encodes
 * it. Never written to disk or any storage — the caller uses the bytes for
 * a single Gemini call and lets them go out of scope afterward (PRD
 * section 10: no permanent meal photo storage).
 */
export async function downloadTelegramFileAsBase64(filePath: string): Promise<string> {
  const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new PhotoDownloadError(`Failed to download Telegram file: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_PHOTO_BYTES) {
    throw new PhotoDownloadError("Photo exceeds the maximum allowed size");
  }

  return Buffer.from(arrayBuffer).toString("base64");
}
