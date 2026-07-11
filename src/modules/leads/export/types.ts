import type { LeadAiSummary } from "../ai-summary";

/**
 * The seam every future CRM integration plugs into (module spec §14: "Do
 * NOT integrate Salesforce, HubSpot, Zoho, or Pipedrive. Instead create:
 * LeadExportProvider, CRMAdapter."). This phase implements one concrete,
 * real LeadExportProvider (CSV — see ./csv.ts) and defines CRMAdapter as
 * the interface a real vendor integration would implement later; no vendor
 * SDK, API key, or network call exists anywhere in this module.
 */
export type LeadExportRecord = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  location: string | null;
  stage: string;
  priority: string;
  score: number;
  tags: string[];
  summary: LeadAiSummary | null;
  createdAt: string;
};

/** A format-specific way of turning lead records into an exportable
 * artifact (a file, a payload) — CSV today, could be XLSX/JSON later. */
export interface LeadExportProvider {
  readonly format: string;
  readonly contentType: string;
  export(records: LeadExportRecord[]): string;
}

/**
 * A future real CRM integration (Salesforce, HubSpot, ...) implements
 * this — pushing one lead record to that vendor's API and returning
 * whatever id it assigned. Nothing in this codebase implements it yet;
 * it exists purely as the documented seam.
 */
export interface CRMAdapter {
  readonly id: string;
  exportLead(record: LeadExportRecord): Promise<{ externalId: string }>;
}
