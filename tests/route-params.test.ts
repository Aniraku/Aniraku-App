import { describe, expect, it } from "vitest";
import { parseRouteEpisode, parseRouteId } from "../lib/route-params";

describe("parseRouteId", () => {
  it("accepts positive integers", () => {
    expect(parseRouteId("21")).toBe(21);
    expect(parseRouteId("1")).toBe(1);
  });

  it("rejects missing and malformed ids", () => {
    expect(parseRouteId(undefined)).toBeNull();
    expect(parseRouteId(null)).toBeNull();
    expect(parseRouteId("")).toBeNull();
    expect(parseRouteId("abc")).toBeNull();
    expect(parseRouteId("0")).toBeNull();
    expect(parseRouteId("-5")).toBeNull();
    expect(parseRouteId("21abc")).toBeNull();
    expect(parseRouteId("3.5")).toBeNull();
  });

  it("tolerates expo-router's string[] shape", () => {
    expect(parseRouteId(["21"])).toBe(21);
    expect(parseRouteId([])).toBeNull();
  });
});

describe("parseRouteEpisode", () => {
  it("parses and clamps episodes", () => {
    expect(parseRouteEpisode("3")).toBe(3);
    expect(parseRouteEpisode("0")).toBe(1);
    expect(parseRouteEpisode("-2")).toBe(1);
    expect(parseRouteEpisode("3.9")).toBe(3);
  });

  it("falls back on garbage", () => {
    expect(parseRouteEpisode(undefined)).toBe(1);
    expect(parseRouteEpisode("abc")).toBe(1);
    expect(parseRouteEpisode("abc", 5)).toBe(5);
    expect(parseRouteEpisode(["7"])).toBe(7);
  });
});
