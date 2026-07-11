import { describe, expect, it } from "vitest";
import { formatCell, toCsv } from "./export-service";

describe("formatCell", () => {
  it("renders null/undefined as an empty string, not the word 'null'", () => {
    expect(formatCell(null)).toBe("");
    expect(formatCell(undefined)).toBe("");
  });

  it("stringifies objects as JSON rather than '[object Object]'", () => {
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
  });

  it("passes through primitives as strings", () => {
    expect(formatCell(42)).toBe("42");
    expect(formatCell(true)).toBe("true");
    expect(formatCell("hi")).toBe("hi");
  });
});

describe("toCsv", () => {
  it("puts every scalar field into one Metric,Value table", () => {
    const csv = toCsv({ totalConversations: 12, conversionRate: 33.3, csat: null });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Metric,Value");
    expect(lines).toContain("totalConversations,12");
    expect(lines).toContain("conversionRate,33.3");
    expect(lines).toContain("csat,");
  });

  it("renders each array field as its own titled table below the scalars", () => {
    const csv = toCsv({
      totalConversations: 5,
      series: [
        { bucket: "2026-01-01", count: 3 },
        { bucket: "2026-01-02", count: 2 },
      ],
    });
    const lines = csv.split("\r\n");
    expect(lines).toContain("series");
    expect(lines).toContain("bucket,count");
    expect(lines).toContain("2026-01-01,3");
    expect(lines).toContain("2026-01-02,2");
  });

  it("escapes a field containing a comma", () => {
    const csv = toCsv({ series: [{ label: "Acme, Inc.", count: 1 }] });
    expect(csv).toContain('"Acme, Inc."');
  });

  it("handles an empty array field without crashing", () => {
    const csv = toCsv({ unusedDocuments: [] });
    const lines = csv.split("\r\n");
    expect(lines).toContain("unusedDocuments");
  });
});
