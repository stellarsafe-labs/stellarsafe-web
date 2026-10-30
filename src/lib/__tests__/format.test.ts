import { describe, expect, it } from "vitest";
import { fmtPeriod, fmtTtl, toCsv } from "../format";

describe("toCsv", () => {
  it("escapes quotes, commas and newlines", () => {
    expect(toCsv([{ a: 'say "hi"', b: "x,y", c: "l1\nl2" }])).toBe('a,b,c\r\n"say ""hi""","x,y","l1\nl2"');
  });
  it("neutralizes spreadsheet formula injection", () => {
    expect(toCsv([{ label: '=HYPERLINK("evil")' }]).split("\r\n")[1]).toMatch(/^"'=HYPERLINK/);
    expect(toCsv([{ label: "@SUM(A1)" }]).split("\r\n")[1]).toBe("'@SUM(A1)");
  });
  it("handles empty input", () => {
    expect(toCsv([])).toBe("");
  });
});

describe("formatting", () => {
  it("formats durations and periods", () => {
    expect(fmtTtl(86_400)).toBe("1 day");
    expect(fmtTtl(7 * 86_400)).toBe("7 days");
    expect(fmtTtl(7200)).toBe("2 hours");
    expect(fmtPeriod("2026-10")).toBe("October 2026");
  });
});
