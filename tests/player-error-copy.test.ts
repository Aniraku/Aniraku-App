import { describe, expect, it } from "vitest";
import { humanPlayerError } from "../lib/watch-engine";

describe("humanPlayerError", () => {
  it("translates the common engine failures into one honest sentence", () => {
    expect(humanPlayerError("ExoPlayer error code: BAD_HTTP_STATUS, http status: 403")).toMatch(/refused the stream/);
    expect(humanPlayerError("proxy target not allowed")).toMatch(/refused the stream/);
    expect(humanPlayerError("Source error: java.net.SocketTimeoutException: ETIMEDOUT")).toMatch(/took too long|connection/);
    expect(humanPlayerError("Manifest parsing error")).toMatch(/Switching servers/);
    expect(humanPlayerError("Video codec unsupported")).toMatch(/can't decode/);
    expect(humanPlayerError("DRM session required")).toMatch(/protected/);
  });

  it("returns null for unknown details so raw text stays in diagnostics", () => {
    expect(humanPlayerError("Some entirely new engine panic")).toBeNull();
    expect(humanPlayerError(null)).toBeNull();
    expect(humanPlayerError(undefined)).toBeNull();
  });
});
