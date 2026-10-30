import { describe, expect, it } from "vitest";
import { AmountError, formatAmount, parseAmount, toUnits, tryParseAmount } from "../amount";

describe("parseAmount", () => {
  it("parses whole and fractional amounts into 7-decimal units", () => {
    expect(parseAmount("1")).toBe(10_000_000n);
    expect(parseAmount("0.0000001")).toBe(1n);
    expect(parseAmount("1,250.50")).toBe(12_505_000_000n);
  });

  it("rejects too many decimals, negatives and garbage", () => {
    expect(() => parseAmount("0.00000001")).toThrow(AmountError);
    expect(() => parseAmount("-5")).toThrow(AmountError);
    expect(() => parseAmount("1e5")).toThrow(AmountError);
    expect(() => parseAmount("")).toThrow(AmountError);
    expect(tryParseAmount("abc")).toBeNull();
  });

  it("avoids floating point errors", () => {
    expect(parseAmount("0.1") + parseAmount("0.2")).toBe(parseAmount("0.3"));
  });
});

describe("formatAmount", () => {
  it("groups thousands and trims trailing zeros", () => {
    expect(formatAmount(toUnits(20_000))).toBe("20,000");
    expect(formatAmount(parseAmount("1310.4"))).toBe("1,310.4");
    expect(formatAmount(parseAmount("1310.4"), { minFraction: 2 })).toBe("1,310.40");
  });

  it("rounds half up at the display precision", () => {
    expect(formatAmount(parseAmount("0.125"))).toBe("0.13");
    expect(formatAmount(parseAmount("0.124"))).toBe("0.12");
    expect(formatAmount(parseAmount("9.999"))).toBe("10");
  });

  it("supports compact notation and negatives", () => {
    expect(formatAmount(toUnits(1_250_000), { compact: true })).toBe("1.2M");
    expect(formatAmount(toUnits(20_000), { compact: true })).toBe("20K");
    expect(formatAmount(-toUnits(5))).toBe("-5");
  });

  it("round-trips through parseAmount without grouping", () => {
    const v = parseAmount("123456.7654321");
    expect(parseAmount(formatAmount(v, { grouping: false, maxFraction: 7 }))).toBe(v);
  });
});
