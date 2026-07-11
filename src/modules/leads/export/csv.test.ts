import { describe, expect, it } from "vitest";
import { csvLeadExportProvider } from "./csv";
import type { LeadExportRecord } from "./types";

function record(overrides: Partial<LeadExportRecord> = {}): LeadExportRecord {
  return {
    id: "lead-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: null,
    company: null,
    location: null,
    stage: "New",
    priority: "medium",
    score: 42,
    tags: [],
    summary: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("csvLeadExportProvider", () => {
  it("declares itself as csv, never a vendor CRM integration", () => {
    expect(csvLeadExportProvider.format).toBe("csv");
    expect(csvLeadExportProvider.contentType).toBe("text/csv");
  });

  it("writes a header row even with zero records", () => {
    const out = csvLeadExportProvider.export([]);
    expect(out).toBe(
      "Name,Email,Phone,Company,Location,Stage,Priority,Score,Tags,Next Action,Created At",
    );
  });

  it("renders null fields as empty, not the string 'null'", () => {
    const out = csvLeadExportProvider.export([record()]);
    const [, row] = out.split("\r\n");
    expect(row).toBe("Ada Lovelace,ada@example.com,,,,New,medium,42,,,2026-01-01T00:00:00.000Z");
  });

  it("joins multiple tags with a semicolon inside one field", () => {
    const out = csvLeadExportProvider.export([record({ tags: ["hot", "enterprise"] })]);
    expect(out).toContain("hot; enterprise");
  });

  it("quotes and escapes a field containing a comma", () => {
    const out = csvLeadExportProvider.export([record({ company: "Acme, Inc." })]);
    expect(out).toContain('"Acme, Inc."');
  });

  it("quotes and escapes a field containing an embedded double quote", () => {
    const out = csvLeadExportProvider.export([record({ name: 'Bob "The Builder" Smith' })]);
    expect(out).toContain('"Bob ""The Builder"" Smith"');
  });

  it("quotes a field containing a newline", () => {
    const out = csvLeadExportProvider.export([record({ location: "Line1\nLine2" })]);
    expect(out).toContain('"Line1\nLine2"');
  });

  it("pulls the recommended next action out of a structured AI summary", () => {
    const out = csvLeadExportProvider.export([
      record({
        summary: {
          whoIsThisPerson: "",
          whatDoTheyNeed: "",
          budget: null,
          timeline: null,
          painPoints: [],
          productsDiscussed: [],
          recommendedNextAction: "Schedule a demo",
          intentScore: 5,
          urgencyScore: 5,
          buyingSignalsScore: 5,
          supportSignalsScore: 0,
          budgetMentioned: false,
          generatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    ]);
    expect(out).toContain("Schedule a demo");
  });
});
