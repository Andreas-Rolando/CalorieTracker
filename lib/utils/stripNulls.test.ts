import { describe, expect, it } from "vitest";
import { stripNulls } from "./stripNulls";

describe("stripNulls", () => {
  it("drops null-valued keys from objects", () => {
    expect(stripNulls({ a: 1, b: null, c: "x" })).toEqual({ a: 1, c: "x" });
  });

  it("recurses into nested objects and arrays", () => {
    expect(
      stripNulls({
        items: [
          { name: "a", sugar_g: null, calories: 10 },
          { name: "b", sugar_g: 5, calories: 20 },
        ],
      })
    ).toEqual({
      items: [
        { name: "a", calories: 10 },
        { name: "b", sugar_g: 5, calories: 20 },
      ],
    });
  });

  it("leaves non-null primitives untouched", () => {
    expect(stripNulls(5)).toBe(5);
    expect(stripNulls("x")).toBe("x");
    expect(stripNulls(undefined)).toBe(undefined);
  });
});
