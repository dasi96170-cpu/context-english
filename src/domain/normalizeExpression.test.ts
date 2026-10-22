import { describe, expect, it } from "vitest";

import { normalizeExpression } from "./normalizeExpression";

describe("normalizeExpression", () => {
  it("lowercases English text", () => {
    expect(normalizeExpression("Device")).toBe("device");
  });

  it("trims and collapses consecutive whitespace", () => {
    expect(normalizeExpression("  Device\t  Control\n ")).toBe("device control");
  });

  it("applies Unicode NFKC normalization", () => {
    expect(normalizeExpression("Ｄｅｖｉｃｅ")).toBe("device");
  });
});
