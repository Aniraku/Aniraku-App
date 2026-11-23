import { describe, expect, it } from "vitest";
import { USDT_ASSET, USDT_BEP20_ADDRESS, USDT_NETWORK_SHORT } from "../lib/support";

describe("Aniraku support surface logic", () => {
  it("publishes the supplied optional USDT BEP20 donation identity without network ambiguity", () => {
    expect(USDT_ASSET).toBe("USDT");
    expect(USDT_NETWORK_SHORT).toBe("BEP20");
    expect(USDT_BEP20_ADDRESS).toBe("0x0dc085fc880f2f67b4e200f125bc0de352da904e");
  });
});
