import { requireNativeModule } from "expo-modules-core";

type AnirakuStreamPoolNativeModule = {
  /** Start a prefetch session (registers the driver against the live player). */
  begin(): void;
  /** End the session; in-flight prefetches self-ignore via generation. */
  end(): void;
};

function resolveNativeModule(): AnirakuStreamPoolNativeModule | null {
  try {
    return requireNativeModule<AnirakuStreamPoolNativeModule>("AnirakuStreamPool");
  } catch {
    return null;
  }
}

const nativeModule = resolveNativeModule();

/**
 * Binding to the AnirakuStreamPool native module (Android only). Absent on
 * web / iOS / older binaries → `available: false` and every call no-ops, so
 * callers never need platform checks.
 */
export const streamPoolNative = {
  available: nativeModule !== null,
  begin: () => {
    try {
      nativeModule?.begin();
    } catch {
      // the module can be torn down during fast source swaps — never fatal
    }
  },
  end: () => {
    try {
      nativeModule?.end();
    } catch {
      // ditto
    }
  },
};
