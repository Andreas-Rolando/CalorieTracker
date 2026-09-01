import { describe, expect, it } from "vitest";
import { normalizeTimezone } from "./timezone";

describe("normalizeTimezone", () => {
  it("accepts an exact IANA zone name", () => {
    expect(normalizeTimezone("Asia/Jakarta")).toBe("Asia/Jakarta");
  });

  it("is case-insensitive for full IANA names", () => {
    expect(normalizeTimezone("asia/jakarta")).toBe("Asia/Jakarta");
    expect(normalizeTimezone("ASIA/JAKARTA")).toBe("Asia/Jakarta");
  });

  it("accepts bare Indonesian city names", () => {
    expect(normalizeTimezone("jakarta")).toBe("Asia/Jakarta");
    expect(normalizeTimezone("Makassar")).toBe("Asia/Makassar");
    expect(normalizeTimezone("JAYAPURA")).toBe("Asia/Jayapura");
  });

  it("accepts WIB/WITA/WIT abbreviations in any case", () => {
    expect(normalizeTimezone("wib")).toBe("Asia/Jakarta");
    expect(normalizeTimezone("WITA")).toBe("Asia/Makassar");
    expect(normalizeTimezone("Wit")).toBe("Asia/Jayapura");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeTimezone("  jakarta  ")).toBe("Asia/Jakarta");
  });

  it("returns null for unrecognized input", () => {
    expect(normalizeTimezone("Mars/OlympusMons")).toBeNull();
    expect(normalizeTimezone("")).toBeNull();
  });
});
