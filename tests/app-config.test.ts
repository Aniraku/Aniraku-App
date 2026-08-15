import { afterEach, describe, expect, it, vi } from "vitest";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

afterEach(() => {
  vi.resetModules();
  if (originalWindow) {
    Object.defineProperty(globalThis, "window", originalWindow);
  } else {
    delete (globalThis as { window?: unknown }).window;
  }
});

describe("native app configuration", () => {
  it("uses the production API when React Native defines window without browser location", async () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    const { APP_CONFIG } = await import("../lib/app-config");
    expect(APP_CONFIG.apiBaseUrl).toBe("https://api.aniraku.tech");
  });
});
